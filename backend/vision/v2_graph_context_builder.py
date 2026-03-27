import base64
import json
import re
import time
from io import BytesIO
from pathlib import Path
from typing import Dict, Union, Any, Optional

import networkx as nx
import matplotlib.pyplot as plt
from PIL import Image
from openai import OpenAI
import pickle
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
    "surface": "<what the object is resting on, e.g. table, shelf, counter, floor>",
    "relative_position": "<brief spatial description, e.g. 'next to laptop', 'left side of table'>"
  }},
  "nearby_objects": ["<object1>", "<object2>"]
}}

Be concise and factual. Use lowercase for all values.
""".strip()

SURFACE_MAP = {
    "desk": "table",
    "work desk": "table",
    "office desk": "table",
    "coffee table": "table",
    "dining table": "table",
}

def normalize_surface(name):
    name = name.lower().strip()
    return SURFACE_MAP.get(name, name)

class HomeMemoryGraph:
    def __init__(self):
        self.graph: nx.digraph = nx.DiGraph()

    @staticmethod
    def node_id(name: str, node_type: str) -> str:
        return f"{node_type}::{name.lower().strip()}"
    
    def _get_or_create_room(self, room_name: str) -> str:
        nid = self.node_id(room_name, "room")
        if nid not in self.graph:
            self.graph.add_node(nid, type="room", name=room_name.lower().strip())
        return nid

    def _get_or_create_surface(self, surface_name: str, room_nid: str) -> str:
        nid = self.node_id(surface_name, "surface")
        if nid not in self.graph:
            self.graph.add_node(nid, type="surface", name=normalize_surface(surface_name))
            self.graph.add_edge(nid, room_nid, relation="in")
        elif not self.graph.has_edge(nid, room_nid):
            self.graph.add_edge(nid, room_nid, relation="in")
        return nid

    def _get_or_create_object(self, name: str, attributes: Dict[str, Any]) -> str:
        nid = self.node_id(name, "object")
        ts = time.time()

        if nid not in self.graph:
            node_data = {
                "type": "object",
                "name": name.lower().strip(),
                "last_seen": ts,
                **attributes
            }
            self.graph.add_node(nid, **node_data)
        else:
            self.graph.nodes[nid].update(attributes)
            self.graph.nodes[nid]["last_seen"] = ts

        return nid

    def _clear_old_on_edges(self, obj_nid: str):
        out_edges = list(self.graph.out_edges(obj_nid, data=True))
        to_remove = [(u, v) for u, v, d in out_edges if d.get("relation") == "on"]
        self.graph.remove_edges_from(to_remove)

    def add_observation(self, description: Dict[str, Any], room_name: str):
        """
        Integrate one structured object description into the graph memory.
        """
        obj_name = description.get("name", "").strip()
        if not obj_name:
            return

        attrs = description.get("attributes", {})
        loc = description.get("location", {})
        surface = loc.get("surface", "unknown").strip()
        nearby = [n.strip() for n in description.get("nearby_objects", []) if n.strip()]

        room_nid    = self._get_or_create_room(room_name)
        surface_nid = self._get_or_create_surface(surface, room_nid)
        obj_nid     = self._get_or_create_object(obj_name, attrs)

        # Object location
        self._clear_old_on_edges(obj_nid)
        self.graph.add_edge(obj_nid, surface_nid, relation="on")

        # Nearby objects (undirected next_to)
        for nb_name in nearby:
            nb_nid = self.node_id(nb_name, "object")
            if nb_nid not in self.graph:
                self.graph.add_node(nb_nid, type="object", name=nb_name.lower().strip(),
                                    last_seen=time.time())

            if not self.graph.has_edge(obj_nid, nb_nid):
                self.graph.add_edge(obj_nid, nb_nid, relation="next_to")
            if not self.graph.has_edge(nb_nid, obj_nid):
                self.graph.add_edge(nb_nid, obj_nid, relation="next_to")

    def print_summary(self):
        print("\n=== GRAPH SUMMARY ===")

        print("\nNodes:")
        for nid, data in self.graph.nodes(data=True):
            print(f"{nid}: {data}")

        print("\nEdges:")
        for u, v, data in self.graph.edges(data=True):
            print(f"{u} -> {v} [{data.get('relation')}]")

    def plot_graph(self):
        plt.figure()
        pos = nx.spring_layout(self.graph, seed=42)

        node_colors = []
        for _, data in self.graph.nodes(data=True):
            ntype = data.get("type")

            if ntype == "room":
                node_colors.append("lightblue")
            elif ntype == "surface":
                node_colors.append("lightgreen")
            elif ntype == "object":
                node_colors.append("salmon")
            else:
                node_colors.append("gray")

        # Draw nodes with colors
        nx.draw_networkx_nodes(self.graph, pos, node_color=node_colors)

        # Draw edges
        nx.draw_networkx_edges(self.graph, pos)

        # Labels
        labels = {
            nid: data.get("name", nid)
            for nid, data in self.graph.nodes(data=True)
        }
        nx.draw_networkx_labels(self.graph, pos, labels=labels)

        # Edge labels
        edge_labels = {
            (u, v): d.get("relation", "")
            for u, v, d in self.graph.edges(data=True)
        }
        nx.draw_networkx_edge_labels(self.graph, pos, edge_labels=edge_labels)

        plt.title("Home Memory Graph")
        plt.show()
        

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
    object_name: str,
    prompt_template: str = DESCRIPTION_PROMPT_TEMPLATE
) -> Dict[str, Any]:
    b64_image = image_to_base64(image)

    prompt = prompt_template.format(object_name=object_name)

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
    save_path: Optional[Union[str, Path]] = None
) -> Dict[str, Any]:
    description = describe_object(image, object_name)

    graph.add_observation(description, room_name)

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

