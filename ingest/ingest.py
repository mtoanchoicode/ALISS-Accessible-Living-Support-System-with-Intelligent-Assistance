import os
from datetime import datetime, timezone
import numpy as np
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

DB_NAME = os.getenv("POSTGRES_DB", "ragdb")
DB_USER = os.getenv("POSTGRES_USER", "rag")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "ragpw")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = int(os.getenv("POSTGRES_PORT", "5432"))

# Loads the Sentence-BERT model
MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER", "sentence-transformers/all-MiniLM-L6-v2")
EMBED_DIM = int(os.getenv("EMBED_DIM", "384"))

model = SentenceTransformer(MODEL_NAME)

# Connects to Postgres and registers pgvector type adapters (so Python can send/receive vectors cleanly).
conn = psycopg2.connect(
    dbname=DB_NAME, user=DB_USER, password=DB_PASS, host=DB_HOST, port=DB_PORT
)
conn.autocommit = True
register_vector(conn)


def embed_text(text: str):
    v = model.encode(text, normalize_embeddings=True) # Using Sentence-BERT to encode text to a vector with 384 Dimension
    v = np.asarray(v, dtype=np.float32) # convert v into float32 type
    assert v.shape[0] == EMBED_DIM # Recheck the vector length = EMBED_DIM
    return v.tolist()

def upsert_item(ts, location, obj, background, text):
    combined = " | ".join(filter(None, [location, obj, background, text])) # combine ts, loc, obj, bg, text into a string with |
    e = embed_text(combined) # create vector embedding 
    with conn.cursor() as cur: # using cursor in PostgreSQL (connect to conn) to check query SQL
        cur.execute("""
            INSERT INTO kb_items (ts, location, object, background, text, embedding)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (ts, location, obj, background, text, e))

if __name__ == "__main__":
    rows = [
        (datetime.now(timezone.utc), "kitchen", "wallet", "Left on dining table near a blue notebook.", "Wallet near notebook on table."),
        (datetime.now(timezone.utc), "bedroom", "keys", "Hanging on the hook by the door.", "House keys on the wall hook by the door."),
        (datetime.now(timezone.utc), "living_room", "remote", "Between sofa cushions.", "TV remote wedged in sofa.")
    ]
    for r in rows:
        upsert_item(*r)
    print(f"Ingested {len(rows)} rows.")
