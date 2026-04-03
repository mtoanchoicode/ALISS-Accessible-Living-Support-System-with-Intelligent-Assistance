from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from sentence_transformers import SentenceTransformer

from vision.v2_graph_context_builder import HomeMemoryGraph, load_graph

load_dotenv()

# =========================================================
# Config
# =========================================================
GRAPH_SAVE_PATH = os.getenv("GRAPH_SAVE_PATH", "./home_memory_graph.pkl")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
EMBED_MODEL_NAME = os.getenv(
    "EMBED_MODEL_NAME",
    "sentence-transformers/all-MiniLM-L6-v2"
)
EMBED_EXACT_THRESHOLD = float(os.getenv("EMBED_EXACT_THRESHOLD", "0.80"))
EMBED_LOW_THRESHOLD = float(os.getenv("EMBED_LOW_THRESHOLD", "0.65"))
DEBUG = os.getenv("DEBUG_SEARCH_V2", "true").lower() == "true"

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set in environment variables.")

client = OpenAI(api_key=OPENAI_API_KEY)


# =========================================================
# Conversation State
# =========================================================
@dataclass
class ConversationState:
    turn: int = 0
    last_object: Optional[str] = None
    last_room: Optional[str] = None
    last_surface: Optional[str] = None
    last_intent: Optional[str] = None
    last_response_id: Optional[str] = None


# =========================================================
# Graph Retriever
# =========================================================
class GraphMemoryRetriever:
    def __init__(self, memory: HomeMemoryGraph):
        self.memory = memory
        self.graph = memory.graph

    @staticmethod
    def _node_id(name: str, node_type: str) -> str:
        return f"{node_type}::{name.lower().strip()}"

    @staticmethod
    def _fmt_ts(ts: Optional[float]) -> str:
        if ts is None:
            return "unknown time"
        try:
            return datetime.fromtimestamp(float(ts)).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            return "unknown time"

    @staticmethod
    def normalize_text(text: str) -> str:
        return re.sub(r"\s+", " ", (text or "").strip().lower())

    def list_all_objects(self) -> List[str]:
        result = []
        for _, data in self.graph.nodes(data=True):
            if data.get("type") == "object":
                result.append(data.get("name", "unknown"))
        return sorted(set(result))

    def list_all_rooms(self) -> List[str]:
        result = []
        for _, data in self.graph.nodes(data=True):
            if data.get("type") == "room":
                result.append(data.get("name", "unknown"))
        return sorted(set(result))

    def list_all_surfaces(self) -> List[str]:
        result = []
        for _, data in self.graph.nodes(data=True):
            if data.get("type") == "surface":
                result.append(data.get("name", "unknown"))
        return sorted(set(result))

    def has_exact_object(self, obj_name: str) -> bool:
        return self._node_id(obj_name, "object") in self.graph

    def has_exact_room(self, room_name: str) -> bool:
        return self._node_id(room_name, "room") in self.graph

    def has_exact_surface(self, surface_name: str) -> bool:
        return self._node_id(surface_name, "surface") in self.graph

    def get_object_attributes(self, obj_name: str) -> Dict[str, Any]:
        obj_nid = self._node_id(obj_name, "object")
        if obj_nid not in self.graph:
            return {}

        raw = dict(self.graph.nodes[obj_nid])
        cleaned = {}
        for k, v in raw.items():
            if k in {"type", "name"}:
                continue
            if k == "last_seen":
                cleaned[k] = self._fmt_ts(v)
            else:
                cleaned[k] = v
        return cleaned

    def find_object_location(self, obj_name: str) -> Optional[Dict[str, Any]]:
        obj_nid = self._node_id(obj_name, "object")
        if obj_nid not in self.graph:
            return None

        surface_nid = None
        for _, v, d in self.graph.out_edges(obj_nid, data=True):
            if d.get("relation") == "on":
                surface_nid = v
                break

        room_nid = None
        if surface_nid:
            for _, v, d in self.graph.out_edges(surface_nid, data=True):
                if d.get("relation") == "in":
                    room_nid = v
                    break

        obj_data = self.graph.nodes[obj_nid]
        return {
            "object": obj_data.get("name", obj_name.lower().strip()),
            "surface": self.graph.nodes[surface_nid].get("name") if surface_nid else None,
            "room": self.graph.nodes[room_nid].get("name") if room_nid else None,
            "last_seen": self._fmt_ts(obj_data.get("last_seen")),
            "seen_by": obj_data.get("seen_by"),
            "attributes": self.get_object_attributes(obj_name),
        }

    def find_nearby_objects(self, obj_name: str) -> List[str]:
        obj_nid = self._node_id(obj_name, "object")
        if obj_nid not in self.graph:
            return []

        result = []
        for _, v, d in self.graph.out_edges(obj_nid, data=True):
            if d.get("relation") == "next_to" and self.graph.nodes[v].get("type") == "object":
                result.append(self.graph.nodes[v].get("name", "unknown"))
        return sorted(set(result))

    def objects_in_room(self, room_name: str) -> List[str]:
        room_nid = self._node_id(room_name, "room")
        if room_nid not in self.graph:
            return []

        surface_nids = [
            u for u, v, d in self.graph.in_edges(room_nid, data=True)
            if d.get("relation") == "in" and self.graph.nodes[u].get("type") == "surface"
        ]

        result = []
        for surface_nid in surface_nids:
            for u, _, d in self.graph.in_edges(surface_nid, data=True):
                if d.get("relation") == "on" and self.graph.nodes[u].get("type") == "object":
                    result.append(self.graph.nodes[u].get("name", "unknown"))

        return sorted(set(result))

    def objects_on_surface(self, surface_name: str) -> List[str]:
        surface_nid = self._node_id(surface_name, "surface")
        if surface_nid not in self.graph:
            return []

        result = []
        for u, _, d in self.graph.in_edges(surface_nid, data=True):
            if d.get("relation") == "on" and self.graph.nodes[u].get("type") == "object":
                result.append(self.graph.nodes[u].get("name", "unknown"))

        return sorted(set(result))

    def summarize_object(self, obj_name: str) -> Optional[Dict[str, Any]]:
        location = self.find_object_location(obj_name)
        if not location:
            return None

        nearby = self.find_nearby_objects(obj_name)
        attrs = self.get_object_attributes(obj_name)

        return {
            "location": location,
            "nearby": nearby,
            "attributes": attrs,
        }


# =========================================================
# Embedding Resolver
# =========================================================
class GraphEntityResolver:
    def __init__(self, retriever: GraphMemoryRetriever, model_name: str = EMBED_MODEL_NAME):
        self.retriever = retriever
        self.model = SentenceTransformer(model_name)
        self.catalog: List[Dict[str, Any]] = []
        self.catalog_embeddings: Optional[np.ndarray] = None
        self.build_catalog()

    def build_catalog(self):
        items: List[Dict[str, Any]] = []

        for name in self.retriever.list_all_objects():
            items.append({"type": "object", "name": name})

        for name in self.retriever.list_all_rooms():
            items.append({"type": "room", "name": name})

        for name in self.retriever.list_all_surfaces():
            items.append({"type": "surface", "name": name})

        self.catalog = items

        if not items:
            self.catalog_embeddings = np.array([])
            return

        texts = [item["name"] for item in items]
        self.catalog_embeddings = self.model.encode(texts, normalize_embeddings=True)

    def resolve(
        self,
        text: str,
        allowed_types: Optional[List[str]] = None,
        top_k: int = 3
    ) -> List[Dict[str, Any]]:
        if not self.catalog or self.catalog_embeddings is None or len(self.catalog_embeddings) == 0:
            return []

        candidate_indices = list(range(len(self.catalog)))
        if allowed_types:
            candidate_indices = [
                i for i, item in enumerate(self.catalog)
                if item["type"] in allowed_types
            ]

        if not candidate_indices:
            return []

        query_emb = self.model.encode([text], normalize_embeddings=True)[0]

        scored = []
        for i in candidate_indices:
            score = float(np.dot(query_emb, self.catalog_embeddings[i]))
            scored.append({
                "type": self.catalog[i]["type"],
                "name": self.catalog[i]["name"],
                "score": round(score, 4),
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]


# =========================================================
# Utilities
# =========================================================
def safe_json_extract(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None

    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)

    if not t.startswith("{"):
        m = re.search(r"\{.*\}", t, flags=re.DOTALL)
        if not m:
            return None
        t = m.group(0)

    try:
        return json.loads(t)
    except Exception:
        return None


def choose_query_value(parsed: Dict[str, Any]) -> Optional[str]:
    return (
        parsed.get("object")
        or parsed.get("room")
        or parsed.get("surface")
        or parsed.get("raw_entity")
    )


def normalize_entity_phrase(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"\b(my|the|a|an)\b", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


# =========================================================
# OpenAI Intent Parser
# =========================================================
def llm_parse_query(query: str, state: ConversationState) -> Dict[str, Any]:
    prompt = f"""
You are an intent parser for a home-memory assistant.

Return ONLY valid JSON with this schema:
{{
  "intent": "<where_is|near|in_room|on_surface|describe_object|last_seen|attributes|list_objects|list_rooms|list_surfaces|help|unknown>",
  "raw_entity": "<string or null>",
  "object": "<string or null>",
  "room": "<string or null>",
  "surface": "<string or null>",
  "uses_context": true_or_false,
  "needs_clarification": true_or_false
}}

Rules:
- Use conversation state when the user says things like "it", "that", "there", "same room", "same surface".
- If the user asks about an object, prefer filling "object".
- If the user asks about a room, prefer filling "room".
- If the user asks about a surface, prefer filling "surface".
- If unsure, keep the specific slot null and put the original mention in "raw_entity".
- Do not invent entities that are not implied by the user query or conversation state.
- No extra keys.
- No markdown.

Conversation state:
{json.dumps({
    "last_object": state.last_object,
    "last_room": state.last_room,
    "last_surface": state.last_surface,
    "last_intent": state.last_intent
}, ensure_ascii=False)}

User query:
{query}
""".strip()

    response = client.responses.create(
        model=OPENAI_MODEL,
        input=prompt,
    )

    text = response.output_text.strip()
    parsed = safe_json_extract(text)

    if not parsed:
        raise ValueError(f"LLM returned invalid JSON for query parse: {text}")

    for key in ["raw_entity", "object", "room", "surface"]:
        if isinstance(parsed.get(key), str):
            parsed[key] = normalize_entity_phrase(parsed[key])

    if "intent" not in parsed:
        raise ValueError(f"Parsed JSON missing 'intent': {parsed}")

    return parsed


# =========================================================
# Hybrid Retrieval
# =========================================================
def allowed_types_for_intent(intent: str) -> List[str]:
    if intent in {"where_is", "near", "describe_object", "last_seen", "attributes"}:
        return ["object"]
    if intent == "in_room":
        return ["room"]
    if intent == "on_surface":
        return ["surface"]
    return ["object", "room", "surface"]


def exact_match_entity(
    retriever: GraphMemoryRetriever,
    intent: str,
    value: str
) -> Optional[Dict[str, Any]]:
    if not value:
        return None

    if intent in {"where_is", "near", "describe_object", "last_seen", "attributes"}:
        if retriever.has_exact_object(value):
            return {"type": "object", "name": value, "score": 1.0, "match_method": "exact"}

    if intent == "in_room":
        if retriever.has_exact_room(value):
            return {"type": "room", "name": value, "score": 1.0, "match_method": "exact"}

    if intent == "on_surface":
        if retriever.has_exact_surface(value):
            return {"type": "surface", "name": value, "score": 1.0, "match_method": "exact"}

    return None


def retrieve_with_graph(
    retriever: GraphMemoryRetriever,
    intent: str,
    entity_name: Optional[str],
) -> Any:
    if intent == "where_is" and entity_name:
        return retriever.find_object_location(entity_name)

    if intent == "near" and entity_name:
        return {
            "object": entity_name,
            "nearby": retriever.find_nearby_objects(entity_name),
            "location": retriever.find_object_location(entity_name),
        }

    if intent == "in_room" and entity_name:
        return {
            "room": entity_name,
            "objects": retriever.objects_in_room(entity_name),
        }

    if intent == "on_surface" and entity_name:
        return {
            "surface": entity_name,
            "objects": retriever.objects_on_surface(entity_name),
        }

    if intent == "describe_object" and entity_name:
        return retriever.summarize_object(entity_name)

    if intent == "last_seen" and entity_name:
        loc = retriever.find_object_location(entity_name)
        if not loc:
            return None
        return {
            "object": entity_name,
            "last_seen": loc.get("last_seen"),
            "room": loc.get("room"),
            "surface": loc.get("surface"),
        }

    if intent == "attributes" and entity_name:
        attrs = retriever.get_object_attributes(entity_name)
        loc = retriever.find_object_location(entity_name)
        return {
            "object": entity_name,
            "attributes": attrs,
            "location": loc,
        }

    if intent == "list_objects":
        return retriever.list_all_objects()

    if intent == "list_rooms":
        return retriever.list_all_rooms()

    if intent == "list_surfaces":
        return retriever.list_all_surfaces()

    if intent == "help":
        return [
            "where is the lamp",
            "what is near it",
            "what is in the bedroom",
            "what is on the table",
            "describe the lamp",
            "when did you last see the lamp",
            "what color is the bottle",
            "list objects",
            "list rooms",
            "list surfaces",
        ]

    return None


def retrieve_facts_hybrid(
    retriever: GraphMemoryRetriever,
    resolver: GraphEntityResolver,
    query: str,
    state: ConversationState,
) -> Dict[str, Any]:
    parsed = llm_parse_query(query, state)
    intent = parsed.get("intent", "unknown")
    query_value = choose_query_value(parsed)

    if intent in {"list_objects", "list_rooms", "list_surfaces", "help"}:
        return {
            "intent": intent,
            "query_value": query_value,
            "parsed": parsed,
            "resolved_entity": None,
            "alternatives": [],
            "data": retrieve_with_graph(retriever, intent, None),
            "resolution_status": "not_needed",
        }

    if intent == "unknown":
        return {
            "intent": "unknown",
            "query_value": query_value,
            "parsed": parsed,
            "resolved_entity": None,
            "alternatives": [],
            "data": None,
            "resolution_status": "unknown_intent",
        }

    if parsed.get("needs_clarification") is True:
        return {
            "intent": intent,
            "query_value": query_value,
            "parsed": parsed,
            "resolved_entity": None,
            "alternatives": [],
            "data": None,
            "resolution_status": "needs_clarification",
        }

    exact = exact_match_entity(retriever, intent, query_value or "")
    if exact:
        return {
            "intent": intent,
            "query_value": query_value,
            "parsed": parsed,
            "resolved_entity": exact,
            "alternatives": [],
            "data": retrieve_with_graph(retriever, intent, exact["name"]),
            "resolution_status": "exact_match",
        }

    matches = resolver.resolve(
        text=query_value or "",
        allowed_types=allowed_types_for_intent(intent),
        top_k=3,
    )

    if not matches:
        return {
            "intent": intent,
            "query_value": query_value,
            "parsed": parsed,
            "resolved_entity": None,
            "alternatives": [],
            "data": None,
            "resolution_status": "no_candidates",
        }

    best = dict(matches[0])
    best["match_method"] = "embedding"

    if best["score"] < EMBED_LOW_THRESHOLD:
        return {
            "intent": intent,
            "query_value": query_value,
            "parsed": parsed,
            "resolved_entity": best,
            "alternatives": matches[1:],
            "data": None,
            "resolution_status": "low_confidence",
        }

    status = (
        "embedding_high_confidence"
        if best["score"] >= EMBED_EXACT_THRESHOLD
        else "embedding_medium_confidence"
    )

    return {
        "intent": intent,
        "query_value": query_value,
        "parsed": parsed,
        "resolved_entity": best,
        "alternatives": matches[1:],
        "data": retrieve_with_graph(retriever, intent, best["name"]),
        "resolution_status": status,
    }


# =========================================================
# OpenAI Answer Generation
# =========================================================
def llm_answer(query: str, facts: Dict[str, Any]) -> str:
    prompt = f"""
You are ALISS, a graph-memory assistant.

You must answer ONLY from the retrieved graph facts below.
Do not invent any object, room, surface, timestamp, nearby object, or attribute.
If the facts are missing or resolution is uncertain, clearly say you do not know or ask the user to be more specific.
If the resolved entity came from embedding with medium confidence, mention that you interpreted the query as that entity.
If the intent is unknown, say that you could not understand the question and briefly suggest supported query styles.

User question:
{query}

Retrieved graph facts (JSON):
{json.dumps(facts, ensure_ascii=False, indent=2)}

Instructions:
- Be concise: 1 to 3 sentences.
- Prefer natural wording.
- Do not mention implementation details like regex, embeddings, graph traversal, or JSON.
- If there is no reliable answer, do not guess.
""".strip()

    response = client.responses.create(
        model=OPENAI_MODEL,
        input=prompt,
    )

    answer = response.output_text.strip()
    if not answer:
        raise ValueError("LLM returned empty answer.")
    return answer


# =========================================================
# State Update
# =========================================================
def update_state(state: ConversationState, facts: Dict[str, Any]):
    state.turn += 1
    state.last_intent = facts.get("intent")

    resolved = facts.get("resolved_entity")
    if resolved:
        if resolved["type"] == "object":
            state.last_object = resolved["name"]
        elif resolved["type"] == "room":
            state.last_room = resolved["name"]
        elif resolved["type"] == "surface":
            state.last_surface = resolved["name"]

    data = facts.get("data")
    if isinstance(data, dict):
        if data.get("object"):
            state.last_object = data["object"]
        if data.get("room"):
            state.last_room = data["room"]
        if data.get("surface"):
            state.last_surface = data["surface"]

        if data.get("location"):
            loc = data["location"]
            if isinstance(loc, dict):
                if loc.get("object"):
                    state.last_object = loc["object"]
                if loc.get("room"):
                    state.last_room = loc["room"]
                if loc.get("surface"):
                    state.last_surface = loc["surface"]


# =========================================================
# Debug
# =========================================================
def print_debug(facts: Dict[str, Any], state: ConversationState):
    if not DEBUG:
        return

    print("\n[DEBUG]")
    print("parsed:", json.dumps(facts.get("parsed"), ensure_ascii=False, indent=2))
    print("intent:", facts.get("intent"))
    print("query_value:", facts.get("query_value"))
    print("resolution_status:", facts.get("resolution_status"))
    print("resolved_entity:", facts.get("resolved_entity"))
    print("alternatives:", facts.get("alternatives"))
    print("state:", {
        "last_object": state.last_object,
        "last_room": state.last_room,
        "last_surface": state.last_surface,
        "last_intent": state.last_intent,
    })
    print("[/DEBUG]\n")


# =========================================================
# Main
# =========================================================
def main():
    memory = load_graph(Path(GRAPH_SAVE_PATH))
    retriever = GraphMemoryRetriever(memory)
    resolver = GraphEntityResolver(retriever)
    state = ConversationState()

    print("ALISS Search v2 - OpenAI Parse + Embedding Resolve + Graph Retrieval + OpenAI Answer")
    print("Type 'help' to see examples.")
    print("Type 'refresh' to rebuild the graph and embedding catalog.")
    print("Type 'exit' to quit.\n")

    while True:
        q = input("You: ").strip()

        if not q:
            continue

        if q.lower() in {"exit", "quit"}:
            print("ALISS: Goodbye.")
            break

        if q.lower() == "refresh":
            memory = load_graph(Path(GRAPH_SAVE_PATH))
            retriever = GraphMemoryRetriever(memory)
            resolver = GraphEntityResolver(retriever)
            print("ALISS: Graph and embedding catalog refreshed.\n")
            continue

        try:
            facts = retrieve_facts_hybrid(retriever, resolver, q, state)
            print_debug(facts, state)
            answer = llm_answer(q, facts)
            print(f"ALISS: {answer}\n")
            update_state(state, facts)

        except Exception as e:
            print(f"ALISS: Error: {e}\n")


if __name__ == "__main__":
    main()