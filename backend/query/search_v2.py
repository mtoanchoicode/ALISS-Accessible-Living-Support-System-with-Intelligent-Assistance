from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
EMBED_MODEL_NAME = os.getenv(
    "EMBED_MODEL_NAME",
    "sentence-transformers/all-MiniLM-L6-v2",
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
    history: List[Dict[str, str]] = field(default_factory=list)


# =========================================================
# Utilities
# =========================================================
def safe_json_extract(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None

    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    if not cleaned.startswith("{"):
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            return None
        cleaned = match.group(0)

    try:
        return json.loads(cleaned)
    except Exception:
        return None


def normalize_entity_phrase(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"\b(my|the|a|an)\b", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def choose_query_value(parsed: Dict[str, Any]) -> Optional[str]:
    return (
        parsed.get("object")
        or parsed.get("room")
        or parsed.get("surface")
        or parsed.get("raw_entity")
    )


def format_recent_history(state: ConversationState, max_messages: int = 6) -> str:
    if not state.history:
        return "(no recent conversation)"
    recent = state.history[-max_messages:]
    return "\n".join(
        f"{msg.get('role', 'unknown').upper()}: {msg.get('content', '').strip()}"
        for msg in recent
    )


def update_history(
    state: ConversationState,
    user_query: str,
    assistant_answer: str,
    max_messages: int = 8,
) -> None:
    state.history.append({"role": "user", "content": user_query})
    state.history.append({"role": "assistant", "content": assistant_answer})
    if len(state.history) > max_messages:
        state.history = state.history[-max_messages:]


def fmt_ts(ts: Optional[float]) -> str:
    if ts is None:
        return "unknown time"
    try:
        return datetime.fromtimestamp(float(ts)).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return "unknown time"


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

    def _object_candidates(self, obj_name: str) -> List[Tuple[str, Dict[str, Any]]]:
        canonical = obj_name.lower().strip()
        return [
            (nid, data)
            for nid, data in self.graph.nodes(data=True)
            if data.get("type") == "object" and data.get("name") == canonical
        ]

    def _latest_object_nid(self, obj_name: str) -> Optional[str]:
        candidates = self._object_candidates(obj_name)
        if not candidates:
            return None
        candidates.sort(key=lambda x: x[1].get("last_seen", 0), reverse=True)
        return candidates[0][0]

    def _resolve_object_nid(
        self,
        obj_name: str,
        object_id: Optional[str] = None,
    ) -> Optional[str]:
        if object_id and object_id in self.graph:
            return object_id
        return self._latest_object_nid(obj_name)

    def _surface_room_for_object(self, obj_nid: str) -> Tuple[Optional[str], Optional[str]]:
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

        surface = self.graph.nodes[surface_nid].get("name") if surface_nid else None
        room = self.graph.nodes[room_nid].get("name") if room_nid else None
        return surface, room

    def list_all_objects(self) -> List[str]:
        return sorted(
            {
                data.get("name", "unknown")
                for _, data in self.graph.nodes(data=True)
                if data.get("type") == "object"
            }
        )

    def list_all_rooms(self) -> List[str]:
        return sorted(
            {
                data.get("name", "unknown")
                for _, data in self.graph.nodes(data=True)
                if data.get("type") == "room"
            }
        )

    def list_all_surfaces(self) -> List[str]:
        return sorted(
            {
                data.get("name", "unknown")
                for _, data in self.graph.nodes(data=True)
                if data.get("type") == "surface"
            }
        )

    def has_exact_object(self, obj_name: str) -> bool:
        return self._latest_object_nid(obj_name) is not None

    def has_exact_room(self, room_name: str) -> bool:
        return self._node_id(room_name, "room") in self.graph

    def has_exact_surface(self, surface_name: str) -> bool:
        return self._node_id(surface_name, "surface") in self.graph

    def has_ambiguous_object(self, obj_name: str) -> bool:
        return len(self._object_candidates(obj_name)) > 1

    def get_object_instances(self, obj_name: str) -> List[Dict[str, Any]]:
        candidates = self._object_candidates(obj_name)
        candidates.sort(key=lambda x: x[1].get("last_seen", 0), reverse=True)

        instances = []
        for nid, data in candidates:
            surface, room = self._surface_room_for_object(nid)
            instances.append(
                {
                    "object_id": nid,
                    "name": data.get("name"),
                    "last_seen_raw": data.get("last_seen"),
                    "last_seen": fmt_ts(data.get("last_seen")),
                    "room": room,
                    "surface": surface,
                    "seen_by": data.get("seen_by"),
                    "image_uri": data.get("image_uri"),
                    "attributes": {
                        k: v
                        for k, v in data.items()
                        if k not in {"type", "name", "last_seen", "seen_by"}
                    },
                }
            )
        return instances

    def get_object_attributes(
        self,
        obj_name: str,
        object_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        obj_nid = self._resolve_object_nid(obj_name, object_id)
        if not obj_nid:
            return {}

        raw = dict(self.graph.nodes[obj_nid])
        cleaned = {}
        for key, value in raw.items():
            if key in {"type", "name"}:
                continue
            cleaned[key] = fmt_ts(value) if key == "last_seen" else value
        return cleaned

    def find_object_location(
        self,
        obj_name: str,
        object_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        obj_nid = self._resolve_object_nid(obj_name, object_id)
        if not obj_nid:
            return None

        obj_data = self.graph.nodes[obj_nid]
        surface, room = self._surface_room_for_object(obj_nid)

        return {
            "object": obj_data.get("name", obj_name.lower().strip()),
            "object_id": obj_nid,
            "surface": surface,
            "room": room,
            "last_seen": fmt_ts(obj_data.get("last_seen")),
            "seen_by": obj_data.get("seen_by"),
            "attributes": self.get_object_attributes(obj_name, obj_nid),
        }

    def find_nearby_objects(
        self,
        obj_name: str,
        object_id: Optional[str] = None,
    ) -> List[str]:
        obj_nid = self._resolve_object_nid(obj_name, object_id)
        if not obj_nid:
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
            u
            for u, v, d in self.graph.in_edges(room_nid, data=True)
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

    def summarize_object(
        self,
        obj_name: str,
        object_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        location = self.find_object_location(obj_name, object_id)
        if not location:
            return None

        return {
            "location": location,
            "nearby": self.find_nearby_objects(obj_name, object_id),
            "attributes": self.get_object_attributes(obj_name, object_id),
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

    def build_catalog(self) -> None:
        items: List[Dict[str, Any]] = []
        items += [{"type": "object", "name": name} for name in self.retriever.list_all_objects()]
        items += [{"type": "room", "name": name} for name in self.retriever.list_all_rooms()]
        items += [{"type": "surface", "name": name} for name in self.retriever.list_all_surfaces()]

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
        top_k: int = 3,
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
            scored.append(
                {
                    "type": self.catalog[i]["type"],
                    "name": self.catalog[i]["name"],
                    "score": round(score, 4),
                }
            )

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]


# =========================================================
# Intent Parser
# =========================================================
def llm_parse_query(query: str, state: ConversationState) -> Dict[str, Any]:
    prompt = f"""
You are an intent parser for a home-memory assistant.

Return ONLY valid JSON with this schema:
{{
  "intent": "<where_is|near|in_room|on_surface|describe_object|last_seen|attributes|followup_expand|list_objects|list_rooms|list_surfaces|help|unknown>",
  "raw_entity": "<string or null>",
  "object": "<string or null>",
  "room": "<string or null>",
  "surface": "<string or null>",
  "uses_context": true_or_false,
  "needs_clarification": true_or_false
}}

Rules:
- Use recent conversation and conversation state when the user says things like "it", "that", "there", "same room", "same surface".
- If the user asks about an object, prefer filling "object".
- If the user asks about a room, prefer filling "room".
- If the user asks about a surface, prefer filling "surface".
- If unsure, keep the specific slot null and put the original mention in "raw_entity".
- If the user says things like "can you be more specific", "be more specific", "tell me more", "more details", "elaborate", "expand on that", classify as "followup_expand".
- If the follow-up is too vague and there is no useful context, set "needs_clarification" to true.
- A query like "bottle in kitchen" usually means the object is "bottle" and the room is "kitchen", not the general intent "in_room".
- A query like "bottle on table" usually means the object is "bottle" and the surface is "table".
- Do not invent entities that are not implied by the user query or conversation state.
- No extra keys.
- No markdown.

Recent conversation:
{format_recent_history(state)}

Conversation state:
{json.dumps({
    "last_object": state.last_object,
    "last_room": state.last_room,
    "last_surface": state.last_surface,
    "last_intent": state.last_intent,
}, ensure_ascii=False)}

User query:
{query}
""".strip()

    response = client.responses.create(model=OPENAI_MODEL, input=prompt)
    parsed = safe_json_extract(response.output_text.strip())

    if not parsed or "intent" not in parsed:
        raise ValueError(f"LLM returned invalid JSON for query parse: {response.output_text}")

    for key in ["raw_entity", "object", "room", "surface"]:
        if isinstance(parsed.get(key), str):
            parsed[key] = normalize_entity_phrase(parsed[key])

    return parsed


# =========================================================
# Retrieval Logic
# =========================================================
def allowed_types_for_intent(intent: str) -> List[str]:
    if intent in {"where_is", "near", "describe_object", "last_seen", "attributes"}:
        return ["object"]
    if intent == "in_room":
        return ["room"]
    if intent == "on_surface":
        return ["surface"]
    return ["object", "room", "surface"]


def resolve_followup_from_state(state: ConversationState) -> Optional[Dict[str, str]]:
    if state.last_object:
        return {
            "effective_intent": "describe_object",
            "entity_type": "object",
            "entity_name": state.last_object,
        }
    if state.last_surface:
        return {
            "effective_intent": "on_surface",
            "entity_type": "surface",
            "entity_name": state.last_surface,
        }
    if state.last_room:
        return {
            "effective_intent": "in_room",
            "entity_type": "room",
            "entity_name": state.last_room,
        }
    return None


def exact_match_entity(
    retriever: GraphMemoryRetriever,
    intent: str,
    value: str,
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
    object_id: Optional[str] = None,
) -> Any:
    if intent == "where_is" and entity_name:
        return retriever.find_object_location(entity_name, object_id)

    if intent == "near" and entity_name:
        return {
            "object": entity_name,
            "nearby": retriever.find_nearby_objects(entity_name, object_id),
            "location": retriever.find_object_location(entity_name, object_id),
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
        return retriever.summarize_object(entity_name, object_id)

    if intent == "last_seen" and entity_name:
        loc = retriever.find_object_location(entity_name, object_id)
        if not loc:
            return None
        return {
            "object": entity_name,
            "object_id": loc.get("object_id"),
            "last_seen": loc.get("last_seen"),
            "room": loc.get("room"),
            "surface": loc.get("surface"),
        }

    if intent == "attributes" and entity_name:
        return {
            "object": entity_name,
            "attributes": retriever.get_object_attributes(entity_name, object_id),
            "location": retriever.find_object_location(entity_name, object_id),
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
            "can you be more specific",
            "tell me more about it",
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

    if intent == "followup_expand":
        followup = resolve_followup_from_state(state)
        if not followup:
            return {
                "intent": "followup_expand",
                "effective_intent": None,
                "query_value": None,
                "parsed": parsed,
                "resolved_entity": None,
                "alternatives": [],
                "data": None,
                "resolution_status": "no_context_for_followup",
            }

        return {
            "intent": "followup_expand",
            "effective_intent": followup["effective_intent"],
            "query_value": followup["entity_name"],
            "parsed": parsed,
            "resolved_entity": {
                "type": followup["entity_type"],
                "name": followup["entity_name"],
                "score": 1.0,
                "match_method": "context",
            },
            "alternatives": [],
            "data": retrieve_with_graph(
                retriever,
                followup["effective_intent"],
                followup["entity_name"],
            ),
            "resolution_status": "context_followup",
        }

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

    if intent in {"where_is", "near", "describe_object", "last_seen", "attributes"} and query_value:
        if retriever.has_ambiguous_object(query_value):
            candidates = retriever.get_object_instances(query_value)
            room_hint = parsed.get("room")
            surface_hint = parsed.get("surface")

            filtered = candidates
            if room_hint:
                filtered = [
                    c for c in filtered
                    if c.get("room") and c["room"].lower().strip() == room_hint.lower().strip()
                ]
            if surface_hint:
                filtered = [
                    c for c in filtered
                    if c.get("surface") and c["surface"].lower().strip() == surface_hint.lower().strip()
                ]

            if len(filtered) == 1:
                chosen = filtered[0]
                return {
                    "intent": intent,
                    "query_value": query_value,
                    "parsed": parsed,
                    "resolved_entity": {
                        "type": "object",
                        "name": chosen["name"],
                        "node_id": chosen["object_id"],
                        "score": 1.0,
                        "match_method": "disambiguated_by_context",
                    },
                    "alternatives": [],
                    "data": retrieve_with_graph(
                        retriever,
                        intent,
                        chosen["name"],
                        chosen["object_id"],
                    ),
                    "resolution_status": "disambiguated_object",
                }

            if len(filtered) > 1:
                return {
                    "intent": intent,
                    "query_value": query_value,
                    "parsed": parsed,
                    "resolved_entity": None,
                    "alternatives": [],
                    "data": {
                        "object_name": query_value,
                        "candidates": filtered,
                    },
                    "resolution_status": "ambiguous_object",
                }

            return {
                "intent": intent,
                "query_value": query_value,
                "parsed": parsed,
                "resolved_entity": None,
                "alternatives": [],
                "data": {
                    "object_name": query_value,
                    "candidates": candidates,
                },
                "resolution_status": "no_matching_instance",
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
# Answer Generation
# =========================================================
def llm_answer(
    query: str,
    facts: Dict[str, Any],
    state: Optional[ConversationState] = None,
) -> str:
    history_text = format_recent_history(state) if state else "(no recent conversation)"

    prompt = f"""
You are ALISS, a graph-memory assistant.

You must answer ONLY from the retrieved graph facts below.
Do not invent any object, room, surface, timestamp, nearby object, or attribute.
If the facts are missing or resolution is uncertain, clearly say you do not know or ask the user to be more specific.
If the resolved entity came from embedding with medium confidence, mention that you interpreted the query as that entity.
If the intent is unknown, say that you could not understand the question and briefly suggest supported query styles.
If the intent is "followup_expand", treat it as a request to provide more detail about the last discussed entity using the retrieved graph facts.
If the resolution_status is "no_context_for_followup", say that you need the user to mention the object, room, or surface again more specifically.
If the resolution_status is "ambiguous_object", do not answer the original question directly. Instead, ask the user to clarify which instance they mean, using the candidate summaries from the retrieved graph facts.
If the resolution_status is "no_matching_instance", say that you found objects with that name, but none matched the room or surface the user specified.

Recent conversation:
{history_text}

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

    response = client.responses.create(model=OPENAI_MODEL, input=prompt)
    answer = response.output_text.strip()
    if not answer:
        raise ValueError("LLM returned empty answer.")
    return answer


# =========================================================
# State Update
# =========================================================
def update_state(state: ConversationState, facts: Dict[str, Any]) -> None:
    state.turn += 1
    state.last_intent = facts.get("intent")

    resolved = facts.get("resolved_entity")
    if isinstance(resolved, dict):
        if resolved.get("type") == "object":
            state.last_object = resolved.get("name")
        elif resolved.get("type") == "room":
            state.last_room = resolved.get("name")
        elif resolved.get("type") == "surface":
            state.last_surface = resolved.get("name")

    data = facts.get("data")
    if isinstance(data, dict):
        if data.get("object"):
            state.last_object = data["object"]
        if data.get("room"):
            state.last_room = data["room"]
        if data.get("surface"):
            state.last_surface = data["surface"]

        location = data.get("location")
        if isinstance(location, dict):
            if location.get("object"):
                state.last_object = location["object"]
            if location.get("room"):
                state.last_room = location["room"]
            if location.get("surface"):
                state.last_surface = location["surface"]


# =========================================================
# Debug
# =========================================================
def print_debug(facts: Dict[str, Any], state: ConversationState) -> None:
    if not DEBUG:
        return

    print("\n[DEBUG]")
    print("parsed:", json.dumps(facts.get("parsed"), ensure_ascii=False, indent=2))
    print("intent:", facts.get("intent"))
    print("query_value:", facts.get("query_value"))
    print("resolution_status:", facts.get("resolution_status"))
    print("resolved_entity:", facts.get("resolved_entity"))
    print("alternatives:", facts.get("alternatives"))
    print(
        "state:",
        {
            "last_object": state.last_object,
            "last_room": state.last_room,
            "last_surface": state.last_surface,
            "last_intent": state.last_intent,
            "history_len": len(state.history),
        },
    )
    print("[/DEBUG]\n")


# =========================================================
# CLI
# =========================================================
def main() -> None:
    memory = load_graph(Path(GRAPH_SAVE_PATH))
    retriever = GraphMemoryRetriever(memory)
    resolver = GraphEntityResolver(retriever)
    state = ConversationState()

    print("ALISS Search v2")
    print("Type 'help' for examples, 'refresh' to reload graph, 'exit' to quit.\n")

    while True:
        query = input("You: ").strip()
        if not query:
            continue

        if query.lower() in {"exit", "quit"}:
            print("ALISS: Goodbye.")
            break

        if query.lower() == "refresh":
            memory = load_graph(Path(GRAPH_SAVE_PATH))
            retriever = GraphMemoryRetriever(memory)
            resolver = GraphEntityResolver(retriever)
            print("ALISS: Graph and embedding catalog refreshed.\n")
            continue

        try:
            facts = retrieve_facts_hybrid(retriever, resolver, query, state)
            print_debug(facts, state)
            answer = llm_answer(query, facts, state)
            print(f"ALISS: {answer}\n")
            update_state(state, facts)
            update_history(state, query, answer)
        except Exception as exc:
            print(f"ALISS: Error: {exc}\n")


if __name__ == "__main__":
    main()