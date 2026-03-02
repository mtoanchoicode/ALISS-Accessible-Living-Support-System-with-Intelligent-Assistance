# query/search.py
import os
import re
import json
from datetime import datetime
from typing import Optional, Dict, Any, List

import numpy as np
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from openai import OpenAI

# -------------------------------------------------------------------
# Environment + setup
# -------------------------------------------------------------------
load_dotenv()

DB_NAME = os.getenv("POSTGRES_DB", "postgres")
DB_USER = os.getenv("POSTGRES_USER")
DB_PASS = os.getenv("POSTGRES_PASSWORD")
DB_HOST = os.getenv("POSTGRES_HOST")
DB_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
DB_SSLMODE = os.getenv("POSTGRES_SSLMODE", "require")

MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER", "sentence-transformers/multi-qa-MiniLM-L6-cos-v1")
EMBED_DIM = int(os.getenv("EMBED_DIM", "384"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

MIN_SIM = float(os.getenv("MIN_SIM_THRESHOLD", "0.75"))

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY missing in environment/.env")

# Vector encoder
model = SentenceTransformer(MODEL_NAME)

# DB connection (Supabase requires SSL)
DATABASE_URL = os.getenv("DB_URL")

conn = psycopg2.connect(
    DATABASE_URL,
    sslmode="require"
)
conn.autocommit = True
register_vector(conn)

# OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())

def safe_json_extract(text: str) -> Optional[Dict[str, Any]]:
    """Extract a JSON object from model output (supports fenced code blocks)."""
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

def ts_to_time_bucket(ts_str: str) -> str:
    """Convert timestamp string into a human-friendly bucket."""
    if not ts_str:
        return "unknown time"

    s = str(ts_str).strip()
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        hour = dt.hour
    except Exception:
        try:
            hour = int(s.split(" ")[1].split(":")[0])
        except Exception:
            return "unknown time"

    if 5 <= hour < 9:
        return "early morning"
    elif 9 <= hour < 12:
        return "morning"
    elif 12 <= hour < 15:
        return "early afternoon"
    elif 15 <= hour < 18:
        return "afternoon"
    elif 18 <= hour < 21:
        return "evening"
    elif 21 <= hour <= 23:
        return "night"
    else:
        return "late night"

def as_pgvector_literal(vec: np.ndarray) -> str:
    """Convert NumPy vector to pgvector literal format."""
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"

def embed(q: str) -> str:
    """Encode text into normalized float32 vector string."""
    v = model.encode(q, normalize_embeddings=True).astype("float32")
    assert v.shape[0] == EMBED_DIM
    return as_pgvector_literal(v)

# -------------------------------------------------------------------
# DB helpers: objects list + history
# -------------------------------------------------------------------
def get_distinct_objects() -> List[str]:
    """Used to validate that extracted object exists in DB."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT object
            FROM public.scene_memory
            WHERE object IS NOT NULL AND object <> ''
            ORDER BY object
            """
        )
        rows = cur.fetchall()
    return [r[0] for r in rows if r and r[0]]

def get_object_history(obj: str, n: int = 5):
    """
    Fetch latest n records for a specific object, newest first.
    Returns tuples:
      (id, ts, location, object, background, text)
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, ts, location, object, background, text
            FROM public.scene_memory
            WHERE object = %s
            ORDER BY ts DESC
            LIMIT %s
            """,
            (obj, n),
        )
        return cur.fetchall()

def movement_summary(history_rows) -> Optional[str]:
    """Grounded movement sentence using newest 2 rows if location changed."""
    if not history_rows or len(history_rows) < 2:
        return None

    latest = history_rows[0]
    prev = history_rows[1]

    # tuple: (id, ts, location, object, background, text)
    latest_ts, latest_loc = str(latest[1]), latest[2]
    prev_ts, prev_loc = str(prev[1]), prev[2]

    if not latest_loc or not prev_loc:
        return None
    if norm(latest_loc) == norm(prev_loc):
        return None

    return (
        f"It was earlier in {prev_loc} ({ts_to_time_bucket(prev_ts)}), "
        f"then it moved to {latest_loc} ({ts_to_time_bucket(latest_ts)})."
    )

# -------------------------------------------------------------------
# LLM: extract object (Option B)
# -------------------------------------------------------------------
def extract_object_from_query(query: str) -> Optional[str]:
    """
    Use the LLM to extract a canonical object name from the user query.
    Output must be JSON: {"object": "<string or null>"}
    Validate against DB objects list.
    """
    objects = get_distinct_objects()
    if not objects:
        return None

    vocab = ", ".join(objects)

    prompt = f"""
You extract a referenced household object from a user question.

Return ONLY valid JSON:
{{"object": string_or_null}}

Rules:
- Choose the SINGLE best matching object from this allowed list:
[{vocab}]
- If none match, return {{"object": null}}.
- Do not add any extra keys or text.

Question: {query}
""".strip()

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=80,
        )
        raw = resp.choices[0].message.content.strip()
        parsed = safe_json_extract(raw)
        if not parsed:
            return None
        obj = parsed.get("object")
        if not obj:
            return None

        obj_norm = norm(obj)
        for o in objects:
            if norm(o) == obj_norm:
                return o
        return None
    except Exception:
        return None

# -------------------------------------------------------------------
# Vector search
# -------------------------------------------------------------------
def search(query: str, k: int = 5, location: str = None):
    """
    Returns tuples:
      (id, ts, location, object, background, text, score)
    """
    qemb = embed(query)
    with conn.cursor() as cur:
        if location:
            cur.execute(
                """
                SELECT id, ts, location, object, background, text,
                       1 - (embedding <=> %s::vector) AS score
                FROM public.scene_memory
                WHERE location = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (qemb, location, qemb, k),
            )
        else:
            cur.execute(
                """
                SELECT id, ts, location, object, background, text,
                       1 - (embedding <=> %s::vector) AS score
                FROM public.scene_memory
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (qemb, qemb, k),
            )
        return cur.fetchall()

# -------------------------------------------------------------------
# RAG Answer (movement-aware, grounded)
# -------------------------------------------------------------------
def answer(query: str, k: int = 5, location: str = None):
    rows = search(query, k=k, location=location)
    if not rows:
        return "I don’t have any records for that yet."

    evidence = [
        {
            "id": r[0],
            "ts": str(r[1]),
            "location": r[2],
            "object": r[3],
            "background": r[4],
            "text": r[5],
            "score": float(r[6]),
        }
        for r in rows
    ]

    if max(e["score"] for e in evidence) < MIN_SIM:
        return "I don’t have a reliable record yet. Try adding more details (e.g., location or time)."

    context = "\n".join(
        f"[{ts_to_time_bucket(e['ts'])}] {e['location']} — {e['object']}. "
        f"{(e.get('background') or '').strip()} {(e.get('text') or '').strip()} "
        f"(score={e['score']:.3f})"
        for e in evidence
    )

    prompt = f"""
You are ALISS Response. Use ONLY the evidence below to answer the user query.

Question: {query}

EVIDENCE:
{context}

Instructions:
- Be concise (1–2 sentences).
- Always mention the location and time-of-day of the MOST relevant evidence.
- Do NOT invent any new locations or objects.
- If uncertain, say you don’t know and suggest a next step.
""".strip()

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=140,
        )
        base_answer = resp.choices[0].message.content.strip()
    except Exception:
        best = max(evidence, key=lambda x: x["score"])
        base_answer = (
            f"Your {(best['object'] or 'item')} was last seen in {best['location']} "
            f"({ts_to_time_bucket(best['ts'])})."
        )

    obj = extract_object_from_query(query)
    if obj:
        hist = get_object_history(obj, n=5)
        move_sent = movement_summary(hist)
        if move_sent:
            return f"{base_answer} {move_sent}"

    return base_answer

# -------------------------------------------------------------------
# Multi-turn chat (history-based)
# -------------------------------------------------------------------
def chat():
    print("🧠 ALISS Multi-turn Terminal Mode")
    print("(type 'exit' to quit)\n")

    state = {
        "turn": 0,
        "last_question": None,
        "last_object": None,
        "history_rows": [],
        "focus_row": None,
    }

    while True:
        q = input("You: ").strip()
        if q.lower() == "exit":
            break

        state["turn"] += 1

        obj = extract_object_from_query(q)

        if obj is None:
            rows = search(q, k=5)
            if not rows:
                print("ALISS:", "I don’t have any records for that yet.\n")
                continue

            evidence_lines = []
            for r in rows[:5]:
                evidence_lines.append(
                    f"[{ts_to_time_bucket(str(r[1]))}] {r[2]} — {r[3]}. "
                    f"{(r[4] or '').strip()} {(r[5] or '').strip()} (score={float(r[6]):.3f})"
                )
            ev_block = "\n".join(evidence_lines)

            system_prompt = (
                "You are ALISS, a memory and object-location assistant.\n"
                "Use ONLY the evidence provided.\n"
                "Answer with ONE best location only.\n"
                "Be concise (1–2 sentences). Mention location and time-of-day.\n"
            )
            user_prompt = f"Current question: {q}\n\nEVIDENCE:\n{ev_block}\n\nReturn the single best answer."

            resp = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[{"role": "system", "content": system_prompt},
                          {"role": "user", "content": user_prompt}],
                temperature=0.2,
                max_tokens=180,
            )
            answer_text = resp.choices[0].message.content.strip()

            print("ALISS:", answer_text, "\n")
            state["last_question"] = q
            continue

        if state["turn"] == 1 or state["last_object"] != obj or not state["history_rows"]:
            hist = get_object_history(obj, n=5)
            if not hist:
                print("ALISS:", "I don’t have any records for that object yet.\n")
                state["last_question"] = q
                state["last_object"] = obj
                state["history_rows"] = []
                state["focus_row"] = None
                continue

            state["history_rows"] = hist
            state["last_object"] = obj
            state["focus_row"] = hist[0]

        evidence_lines = []
        for r in state["history_rows"]:
            evidence_lines.append(
                f"[{ts_to_time_bucket(str(r[1]))}] {r[2]} — {r[3]}. "
                f"{(r[4] or '').strip()} {(r[5] or '').strip()}"
            )
        ev_block = "\n".join(evidence_lines)

        system_prompt = (
            "You are ALISS, a memory and object-location assistant.\n"
            "Use ONLY the evidence provided; do not invent locations or events.\n"
            "Report the MOST RECENT (latest timestamp) location for the object.\n"
            "Answer in 1–2 sentences and mention time-of-day.\n"
        )
        user_prompt = f"Object: {obj}\nCurrent question: {q}\n\nEVIDENCE (newest first):\n{ev_block}\n\nReturn the best answer from the latest record."

        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_prompt}],
            temperature=0.2,
            max_tokens=180,
        )
        answer_text = resp.choices[0].message.content.strip()

        move_sent = movement_summary(state["history_rows"])
        if move_sent:
            answer_text = f"{answer_text} {move_sent}"

        print("ALISS:", answer_text, "\n")
        state["last_question"] = q

# -------------------------------------------------------------------
# CLI
# -------------------------------------------------------------------
if __name__ == "__main__":
    mode = input("Mode? (1=single-turn, 2=multi-turn): ").strip()

    if mode == "1":
        query = input("Ask ALISS: ").strip()
        print("\n🔍 Retrievals:")
        results = search(query, k=5)
        for r in results:
            # tuple: id, ts, location, object, background, text, score
            print(f"→ {r[3]} in {r[2]} (score={round(float(r[6]), 3)}) - {r[4]}")

        print("\n🤖 GPT Answer:")
        print(answer(query))

    else:
        chat()