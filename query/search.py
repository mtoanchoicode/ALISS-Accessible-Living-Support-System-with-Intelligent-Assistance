# query/search.py
import os
import numpy as np
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from openai import OpenAI

# Environment + setup
load_dotenv()

DB_NAME = os.getenv("POSTGRES_DB", "ragdb")
DB_USER = os.getenv("POSTGRES_USER", "rag")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "ragpw")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER", "sentence-transformers/all-MiniLM-L6-v2")

# Vector encoder
model = SentenceTransformer(MODEL_NAME)

# DB connection
conn = psycopg2.connect(
    dbname=DB_NAME, user=DB_USER, password=DB_PASS, host=DB_HOST, port=DB_PORT
)
register_vector(conn)

# OpenAI client
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
client = OpenAI(api_key=OPENAI_API_KEY)

MIN_SIM = float(os.getenv("MIN_SIM_THRESHOLD", "0.75"))


# Helper functions
def as_pgvector_literal(vec: np.ndarray) -> str:
    """Convert NumPy vector to pgvector literal format."""
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"


def embed(q: str) -> str:
    """Encode text into normalized float32 vector string."""
    v = model.encode(q, normalize_embeddings=True).astype("float32")
    return as_pgvector_literal(v)


# Vector search
def search(query: str, k: int = 5, location: str = None):
    qemb = embed(query)
    with conn.cursor() as cur:
        if location:
            cur.execute(
                """
                SELECT id, ts, location, object, background, text,
                       1 - (embedding <=> %s::vector) AS score
                FROM kb_items
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
                FROM kb_items
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (qemb, qemb, k),
            )
        return cur.fetchall()


# GPT-4o-mini Answer
def answer(query: str, k: int = 5):
    """Return GPT-4o-mini synthesized answer based on vector search evidence."""
    rows = search(query, k=k)
    if not rows:
        return "I don’t have any records for that yet."

    # Format retrieved evidence
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

    # Guardrail: low similarity = skip GPT
    if max(e["score"] for e in evidence) < MIN_SIM:
        return "I don’t have a reliable record yet. Try adding more details (e.g., location or time)."

    # Build context block
    context = "\n".join(
        f"[{e['ts']}] {e['location']} — {e['object']}. "
        f"{e.get('background') or ''} {e.get('text') or ''} "
        f"(score={e['score']:.3f})"
        for e in evidence
    )

    # Prompt for GPT
    prompt = f"""
        You are ALISS Response. Use ONLY the evidence below to answer the user query.

        Question: {query}

        EVIDENCE: {context}

        Instructions:
        - Be concise (1–2 sentences).
        - Always mention the location and timestamp of the most relevant evidence.
        - If uncertain, say you don’t know and suggest a next step.
        """

    # GPT call
    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=120,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        # fallback to top evidence snippet
        best = max(evidence, key=lambda x: x["score"])
        return (
            f"{(best['object'] or 'Item').capitalize()} likely at {best['location']}. "
            f"Context: {best['background'] or best['text'] or ''} (seen {best['ts']}). "
            f"(Fallback due to error: {e})"
        )


# Test run
if __name__ == "__main__":
    query = input("Ask ALISS: ").strip()

    # Retrieve evidence only
    print("\n🔍 Top retrievals:")
    results = search(query, k=5)
    for r in results:
        print(f"→ {r[3]} in {r[2]} (score={round(r[6], 3)}) - {r[4]}")

    # Generate GPT answer
    print("\n🤖 GPT Answer:")
    print(answer(query))

