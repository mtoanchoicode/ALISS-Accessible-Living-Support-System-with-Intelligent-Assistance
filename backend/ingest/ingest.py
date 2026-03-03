# ingest/ingest.py

import os
import numpy as np
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

# --------------------------------------------------
# Environment
# --------------------------------------------------
load_dotenv()

DATABASE_URL = os.getenv("DB_URL")
MODEL_NAME = os.getenv(
    "SENTENCE_TRANSFORMER",
    "sentence-transformers/multi-qa-MiniLM-L6-cos-v1",
)
EMBED_DIM = int(os.getenv("EMBED_DIM", "384"))

if not DATABASE_URL:
    raise RuntimeError("DB_URL not set in environment")

# --------------------------------------------------
# Embedding Model (load once)
# --------------------------------------------------
model = SentenceTransformer(MODEL_NAME)

# --------------------------------------------------
# Database Connection (Supabase)
# --------------------------------------------------
conn = psycopg2.connect(
    DATABASE_URL,
    sslmode="require",
)
conn.autocommit = True
register_vector(conn)


# --------------------------------------------------
# Embedding Helper
# --------------------------------------------------
def embed_text(text: str) -> list[float]:
    """
    Convert text into normalized float32 embedding.
    """
    vec = model.encode(text, normalize_embeddings=True)
    vec = np.asarray(vec, dtype=np.float32)

    if vec.shape[0] != EMBED_DIM:
        raise ValueError(
            f"Embedding dimension mismatch: expected {EMBED_DIM}, got {vec.shape[0]}"
        )

    return vec.tolist()


# --------------------------------------------------
# Memory Insert
# --------------------------------------------------
def upsert_item(ts, location: str, obj: str, background: str, text: str):
    """
    Insert a new scene memory into Supabase.
    Embedding is computed from:
        location | object | background | text
    """
    combined = " | ".join(filter(None, [location, obj, background, text]))
    embedding = embed_text(combined)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.scene_memory
            (ts, location, object, background, text, embedding)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (ts, location, obj, background, text, embedding),
        )