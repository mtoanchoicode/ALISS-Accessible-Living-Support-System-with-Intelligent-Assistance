import base64
import json
import re
import time
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Union, Any, Optional, Tuple

import networkx as nx
import matplotlib.pyplot as plt
from PIL import Image
from openai import OpenAI
import pickle
from datetime import datetime
import plotly.graph_objects as go
from collections import defaultdict
import shutil
from dotenv import load_dotenv
import os
load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

VISION_MODEL = "gpt-4o"

DESCRIPTION_PROMPT_TEMPLATE = """
You are an assistant that analyses images and returns structured JSON describing a specific object.

The target object is: **{object_name}**

Return ONLY a valid JSON object (no markdown fences, no extra text) with the following schema:
{{
  "name": "<canonical lowercase object name>",
  "attributes": {{
    "color": "<dominant color>",
    "material": "<primary material, e.g. ceramic, metal, wood>",
    "condition": "<new | good | worn | damaged>"
  }},
  "location": {{
    "surface": "<what the object is resting on. Chose from list: table, shelf, counter, floor>",
    "relative_position": "<brief spatial description, e.g. 'next to laptop', 'left side of table'>"
  }},
  "nearby_objects": ["<object1>", "<object2>"]
}}
Rules:
Known objects in memory:
*{known_objects}*
- Prefer reusing existing object names from memory when possible
- Do NOT introduce a new name if it likely refers to an existing object
- Be concise and factual. Use lowercase for all values.
""".strip()

SURFACE_MAP = {
    "desk": "table",
    "work desk": "table",
    "office desk": "table",
    "coffee table": "table",
    "dining table": "table",
    "glass": "cup",
}

def normalize_surface(name):
    name = name.lower().strip()
    return SURFACE_MAP.get(name, name)

class HomeMemoryGraph:
    def __init__(self):
        self.graph: nx.digraph = nx.DiGraph()
        self.object_instance_counters: Dict[str, int] = defaultdict(int)

    def _rebuild_object_counters(self):
        """Call after unpickling a saved graph to keep instance counters correct."""
        self.object_instance_counters.clear()
        for nid, data in self.graph.nodes(data=True):
            if data.get("type") == "object" and data.get("name"):
                name = data["name"]
                if nid.startswith(f"object::{name}::"):
                    try:
                        inst_str = nid.rsplit("::", 1)[-1]
                        if inst_str.isdigit():
                            self.object_instance_counters[name] = max(
                                self.object_instance_counters[name], int(inst_str)
                            )
                            continue
                    except:
                        pass
                # legacy node or fallback
                self.object_instance_counters[name] = max(self.object_instance_counters[name], 1)

    @staticmethod
    def node_id(name: str, node_type: str) -> str:
        return f"{node_type}::{name.lower().strip()}"
    
    @staticmethod
    def _attribute_similarity(new_attrs: Dict[str, Any], existing_attrs: Dict[str, Any]) -> float:
        """80% threshold logic. Placeholders (no attrs) = 100% match."""
        keys = ["color", "material", "condition"]
        if not new_attrs:
            return 0.0

        # No prior attributes (nearby placeholder) → treat as same object
        if not existing_attrs or not any(k in existing_attrs for k in keys):
            return 100.0

        # Compare only keys that exist in BOTH
        matches = 0
        comparable = 0
        for k in keys:
            nv = new_attrs.get(k)
            ev = existing_attrs.get(k)
            if nv is not None and ev is not None:
                comparable += 1
                if nv == ev:
                    matches += 1
        if comparable == 0:
            return 100.0
        return (matches / comparable) * 100
    
    def _get_or_create_object(
        self, name: str, attributes: Dict[str, Any], user_id: str, timestamp: float, room_nid: str = None
    ) -> str:
        """Core deduplication logic (replaces old _get_or_create_object)."""
        canonical_name = normalize_surface(name)
        candidates = []
        for nid, data in self.graph.nodes(data=True):
            if data.get("type") == "object" and data.get("name") == canonical_name:
                
                # Check 1: Find which room this existing object is in
                current_room_of_object = None
                for _, surface_target, edge_data in self.graph.out_edges(nid, data=True):
                    if edge_data.get("relation") == "on":
                        # Follow surface to room
                        for _, room_target, room_edge in self.graph.out_edges(surface_target, data=True):
                            if room_edge.get("relation") == "in":
                                current_room_of_object = room_target
                                break
                
                # Logic: Only allow candidate if it's in the SAME room or has NO room yet
                if room_nid:
                    if current_room_of_object == room_nid or current_room_of_object is None:
                        candidates.append((nid, data))
                else:
                    candidates.append((nid, data))

        if not attributes:  # Nearby placeholder mode
            if candidates:
                candidates.sort(key=lambda x: x[1].get("last_seen", 0), reverse=True)
                return candidates[0][0]
            
            # Create new placeholder
            self.object_instance_counters[canonical_name] += 1
            instance_num = self.object_instance_counters[canonical_name]
            nid = f"object::{canonical_name}::{instance_num}"
            self.graph.add_node(
                nid,
                type="object",
                name=canonical_name,
                last_seen=timestamp,
                seen_by=user_id,
            )
            return nid
        
        # Full observation (has attributes) → deduplication
        if candidates:
            best_nid = None
            best_score = -1.0
            for nid, data in candidates:
                existing_attrs = {
                    k: data.get(k)
                    for k in ["color", "material", "condition"]
                    if data.get(k) is not None
                }
                score = self._attribute_similarity(attributes, existing_attrs)
                if score > best_score:
                    best_score = score
                    best_nid = nid

            if best_score == 100.0:
                # Same physical object (or placeholder) → update
                self.graph.nodes[best_nid].update(attributes)
                self.graph.nodes[best_nid]["last_seen"] = timestamp
                self.graph.nodes[best_nid]["seen_by"] = user_id
                return best_nid
            # Different object (attributes differ too much) → new instance

        # No good match or no candidates → create new instance
        self.object_instance_counters[canonical_name] += 1
        instance_num = self.object_instance_counters[canonical_name]
        nid = f"object::{canonical_name}::{instance_num}"
        node_data = {
            "type": "object",
            "name": canonical_name,
            "last_seen": timestamp,
            "seen_by": user_id,
            **attributes,
        }
        self.graph.add_node(nid, **node_data)
        return nid

    def _get_or_create_room(self, room_name: str) -> str:
        nid = self.node_id(room_name, "room")
        if nid not in self.graph:
            self.graph.add_node(nid, type="room", name=room_name.lower().strip())
        return nid
    
    def _get_or_create_surface(self, surface_name: str, room_nid: str, user_id: str, timestamp: float) -> str:
        normalized_name = normalize_surface(surface_name)
    
        # Use a composite ID: surface::room_id::surface_name
        nid = f"surface::{room_nid}::{normalized_name}"
        
        if nid not in self.graph:
            self.graph.add_node(nid, 
                                type="surface", 
                                name=normalized_name,
                                added_by=user_id,
                                created_at=timestamp)
            self.graph.add_edge(nid, room_nid, relation="in")
        elif not self.graph.has_edge(nid, room_nid):
            self.graph.add_edge(nid, room_nid, relation="in")
        return nid

    def _clear_old_on_edges(self, obj_nid: str):
        out_edges = list(self.graph.out_edges(obj_nid, data=True))
        to_remove = [(u, v) for u, v, d in out_edges if d.get("relation") == "on"]
        self.graph.remove_edges_from(to_remove)

    def add_observation(self, description: Dict[str, Any], room_name: str, user_id: str, timestamp: float):
        obj_name = description.get("name", "").strip()
        if not obj_name:
            return

        attrs = description.get("attributes", {})
        loc = description.get("location", {})
        surface = loc.get("surface", "unknown").strip()
        nearby = [n.strip() for n in description.get("nearby_objects", []) if n.strip()]

        room_nid    = self._get_or_create_room(room_name)
        surface_nid = self._get_or_create_surface(surface, room_nid, user_id, timestamp)
        obj_nid     = self._get_or_create_object(obj_name, attrs, user_id, timestamp, room_nid)

        # Object location
        self._clear_old_on_edges(obj_nid)
        self.graph.add_edge(obj_nid, surface_nid, relation="on")

        # Nearby objects (undirected next_to)
        for nb_name in nearby:
            nb_nid = self._get_or_create_object(nb_name, {}, user_id, timestamp, room_nid)   # ← empty = nearby mode
            has_surface = any(d.get("relation") == "on" for _, _, d in self.graph.out_edges(nb_nid, data=True))
            if not has_surface:
                self.graph.add_edge(nb_nid, surface_nid, relation="on")

            if not self.graph.has_edge(obj_nid, nb_nid):
                self.graph.add_edge(obj_nid, nb_nid, relation="next_to")
            if not self.graph.has_edge(nb_nid, obj_nid):
                self.graph.add_edge(nb_nid, obj_nid, relation="next_to")
        return obj_nid

    def print_summary(self):
        print("\n=== GRAPH SUMMARY ===")

        print("\nNodes:")
        for nid, data in self.graph.nodes(data=True):
            print(f"{nid}: {data}")

        print("\nEdges:")
        for u, v, data in self.graph.edges(data=True):
            print(f"{u} -> {v} [{data.get('relation')}]")

    def update_node(self, nid: str, updates: Dict[str, Any]) -> bool:
        """Update attributes of an existing node."""
        if nid not in self.graph:
            return False

        # Update node data
        self.graph.nodes[nid].update(updates)

        # Optional: auto-update last_seen if provided
        if "last_seen" in updates:
            self.graph.nodes[nid]["last_seen"] = updates["last_seen"]

        return True

    def delete_node(self, nid: str) -> bool:
        """Delete a node and its edges safely."""
        if nid not in self.graph:
            return False

        node_data = self.graph.nodes[nid]
        name = node_data.get("name")
        node_type = node_data.get("type")

        # Remove node (also removes all edges automatically)
        self.graph.remove_node(nid)

        # Optional: adjust counter (not strictly required but cleaner)
        if node_type == "object" and name in self.object_instance_counters:
            # Note: we DON'T decrement to avoid ID reuse bugs
            pass

        return True
    
    def list_nodes(self, node_type: str = None) -> List[Tuple[str, Dict[str, Any]]]:
        """Return all nodes, optionally filtered by type."""
        if node_type:
            return [
                (nid, data)
                for nid, data in self.graph.nodes(data=True)
                if data.get("type") == node_type
            ]
        return list(self.graph.nodes(data=True))

    def plot_graph(self):
        # 1. Calculate positions using networkx
        pos = nx.spring_layout(self.graph, seed=42)
        
        edge_x = []
        edge_y = []
        for edge in self.graph.edges():
            x0, y0 = pos[edge[0]]
            x1, y1 = pos[edge[1]]
            edge_x.extend([x0, x1, None])
            edge_y.extend([y0, y1, None])

        # 2. Create Edge Trace
        edge_trace = go.Scatter(
            x=edge_x, y=edge_y,
            line=dict(width=1, color='#888'),
            hoverinfo='none',
            mode='lines')

        # 3. Create Node Trace
        node_x = []
        node_y = []
        node_text = []
        node_colors = []

        for node, data in self.graph.nodes(data=True):
            x, y = pos[node]
            node_x.append(x)
            node_y.append(y)
            
            # --- BUILD THE HOVER METADATA ---
            # We format the dictionary nicely for the hover popup
            metadata_str = f"<b>ID:</b> {node}<br>"
            for key, value in data.items():
                if key == 'last_seen' or key == 'created_at':
                    # Convert timestamp to readable date
                    value = datetime.fromtimestamp(value).strftime('%Y-%m-%d %H:%M:%S')
                metadata_str += f"<b>{key}:</b> {value}<br>"
            node_text.append(metadata_str)

            # Assign colors based on type
            ntype = data.get("type")
            if ntype == "room": node_colors.append("lightblue")
            elif ntype == "surface": node_colors.append("lightgreen")
            elif ntype == "object": node_colors.append("salmon")
            else: node_colors.append("gray")

        node_trace = go.Scatter(
            x=node_x, y=node_y,
            mode='markers+text',
            hoverinfo='text',
            text=[data.get("name", "") for _, data in self.graph.nodes(data=True)], # Visible label
            textposition="top center",
            hovertext=node_text, # Hover popup content
            marker=dict(
                size=20,
                color=node_colors,
                line_width=2))

        # 4. Create the Figure
        fig = go.Figure(data=[edge_trace, node_trace],
                    layout=go.Layout(
                        title='Home Memory Graph (Interactive)',
                        showlegend=False,
                        hovermode='closest',
                        margin=dict(b=20, l=5, r=5, t=40),
                        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False))
                    )

        fig.show()


def image_to_base64(image_input: Union[str, Path, Image.Image, bytes]) -> str:
    if isinstance(image_input, (str, Path)):
        img = Image.open(image_input).convert("RGB")
    elif isinstance(image_input, Image.Image):
        img = image_input.convert("RGB")
    elif isinstance(image_input, bytes):
        img = Image.open(BytesIO(image_input)).convert("RGB")
    else:
        raise TypeError(f"Unsupported image input type: {type(image_input)}")

    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=82, optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def describe_object(
    image: Union[str, Path, Image.Image, bytes],
    graph: HomeMemoryGraph,
    object_name: str,
    prompt_template: str = DESCRIPTION_PROMPT_TEMPLATE
) -> Dict[str, Any]:
    b64_image = image_to_base64(image)

    prompt = prompt_template.format(object_name=object_name, known_objects = ", ".join(sorted({data["name"].strip().lower() for _, data in graph.graph.nodes(data=True) if data.get("type") == "object" and data.get("name")})))

    response = client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64_image}", "detail": "high"}
                    },
                    {"type": "text", "text": prompt}
                ]
            }
        ],
        max_tokens=400,
        temperature=0.15,
    )

    text = response.choices[0].message.content.strip()

    # Cleanup common model mistakes
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*```$', '', text)

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Vision model returned invalid JSON:\n{text}\n\nError: {e}")  
    
def save_graph(graph: HomeMemoryGraph, path: Union[str, Path]):
    """Quick & dirty persistence for development – not production ready"""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(graph.graph, f)
   

def load_graph(path: Union[str, Path]) -> HomeMemoryGraph:
    path = Path(path)
    if not path.exists():
        return HomeMemoryGraph()

    g = HomeMemoryGraph()
    with open(path, "rb") as f:
        g.graph = pickle.load(f)
    return g

def process_and_remember_observation(
    graph: HomeMemoryGraph,
    image: Union[str, Path, Image.Image, bytes],
    object_name: str,
    room_name: str,
    user_id: str,
    image_storage_dir: str,
    timestamp: Optional[float] = None,
    save_path: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    description = describe_object(image, graph, object_name)

    if timestamp is None:
        timestamp = time.time()

    obj_nid = graph.add_observation(description, room_name, user_id, timestamp)

    if obj_nid:
        os.makedirs(image_storage_dir, exist_ok=True)
        
        safe_filename = f"{obj_nid.replace('::', '_')}_{int(timestamp)}.jpg"
        full_image_path = os.path.join(image_storage_dir, safe_filename)
        
        # Save the image (assuming 'image' is bytes or path; if PIL, use .save())
        if isinstance(image, (str, Path)):
            shutil.copy(image, full_image_path)
        elif isinstance(image, Image.Image):
            image.save(full_image_path)
        else: # bytes
            with open(full_image_path, "wb") as f:
                f.write(image)
        
        # 4. Attach URI to the node so frontend can access it
        # You can use a relative path or a full URL here depending on your server
        graph.graph.nodes[obj_nid]["image_uri"] = f"/images/{safe_filename}"

    if save_path:
        save_graph(graph, save_path)

    return description

if __name__ == "__main__":
    # from dotenv import load_dotenv
    # import os

    # load_dotenv()
    # client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # In real API → load once at startup (or per user/session)
    GRAPH_SAVE_PATH = "./home_memory_graph.pkl"
    memory = load_graph(GRAPH_SAVE_PATH)
    memory.plot_graph()

    # Example call from FastAPI / your endpoint
    desc = process_and_remember_observation(
        graph=memory,
        image=Path("./lamp.jpg"),
        object_name="lamp",
        room_name="bedroom",
        save_path=GRAPH_SAVE_PATH
    )

    # print(json.dumps(desc, indent=2))

