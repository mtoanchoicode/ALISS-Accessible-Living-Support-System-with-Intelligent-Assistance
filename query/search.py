import os
import numpy as np
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()
# Reading .env to capture information
DB_NAME = os.getenv("POSTGRES_DB", "ragdb")
DB_USER = os.getenv("POSTGRES_USER", "rag")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "ragpw")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER", "sentence-transformers/all-MiniLM-L6-v2")

model = SentenceTransformer(MODEL_NAME)

conn = psycopg2.connect(
    dbname=DB_NAME, user=DB_USER, password=DB_PASS, host=DB_HOST, port=DB_PORT
)
register_vector(conn) 

# Convert NumPy array into exact string format for pgvector 
def as_pgvector_literal(vec: np.ndarray) -> str:
    # pgvector expects [v1,v2,...] (no spaces required)
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"

# convert text into unit vector, and turn into float32 to match with PostgreSQL
def embed(q: str) -> str:
    v = model.encode(q, normalize_embeddings=True).astype("float32") 
    return as_pgvector_literal(v)

def search(query, k=5, location=None):
    qemb = embed(query)  # string like "[0.123,-0.456,...]"
    with conn.cursor() as cur:
        # "<=> in pgvector = cosine distance", 1 - (embedding <=> %s::vector) AS score -> similarity score
        if location:
            cur.execute("""
                SELECT id, ts, location, object, background, text,
                       1 - (embedding <=> %s::vector) AS score
                FROM kb_items
                WHERE location = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (qemb, location, qemb, k))
        else:
            cur.execute("""
                SELECT id, ts, location, object, background, text,
                       1 - (embedding <=> %s::vector) AS score
                FROM kb_items
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (qemb, qemb, k))
        return cur.fetchall()
    
# TINY RAG ANSWER
def answer(query):
    rows = search(query, k=3)
    if not rows:
        return "I don't have a record yet."
    id, ts, loc, obj, bg, text, score = rows[0]
    return f"{obj.capitalize()} likely at {loc}. Context: {bg} (seen {ts}, score={round(score,3)})."

if __name__ == "__main__":
    print(answer("Where did I leave my keys?"))

