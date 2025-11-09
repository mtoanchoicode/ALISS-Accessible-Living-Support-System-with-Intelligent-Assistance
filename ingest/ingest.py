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
    (datetime(2025, 11, 6, 7, 45), "bedroom", "phone",
     "Charging on the nightstand beside a stack of books.",
     "Smartphone connected to charger on the nightstand next to a small pile of books."),
    
    (datetime(2025, 11, 6, 8, 10), "kitchen", "glasses",
     "Left near the fruit bowl on the counter.",
     "Reading glasses resting beside the fruit bowl on the kitchen counter."),
    
    (datetime(2025, 11, 6, 8, 35), "living_room", "remote",
     "Placed on the armrest of the recliner.",
     "TV remote lying on the right armrest of the recliner chair."),
    
    (datetime(2025, 11, 6, 9, 00), "office", "keys",
     "Next to the coffee mug near the keyboard.",
     "House keys beside the coffee mug on the office desk."),
    
    (datetime(2025, 11, 6, 9, 20), "garage", "toolbox",
     "Under the wooden shelf near the ladder.",
     "Red toolbox stored beneath the wooden shelf beside the ladder."),
    
    (datetime(2025, 11, 6, 9, 45), "bathroom", "toothpaste",
     "Next to the electric toothbrush on the sink counter.",
     "Toothpaste tube placed beside the electric toothbrush on the sink."),
    
    (datetime(2025, 11, 6, 10, 00), "garden", "watering can",
     "Behind the potted ferns close to the fence.",
     "Metal watering can resting behind the large potted ferns near the fence."),
    
    (datetime(2025, 11, 6, 10, 30), "kitchen", "mug",
     "On the drying rack beside the sink.",
     "Blue ceramic mug drying on the rack beside the kitchen sink."),
    
    (datetime(2025, 11, 6, 10, 55), "living_room", "book",
     "On the coffee table under the lamp.",
     "Hardcover book titled 'AI for Everyone' sitting on the coffee table under the lamp."),
    
    (datetime(2025, 11, 6, 11, 10), "bedroom", "wallet",
     "Inside the drawer of the dressing table.",
     "Brown leather wallet tucked inside the dressing table drawer."),
    
    (datetime(2025, 11, 6, 11, 35), "office", "notebook",
     "Open next to the mouse pad.",
     "Spiral notebook lying open beside the mouse pad on the office desk."),
    
    (datetime(2025, 11, 6, 12, 00), "garage", "bicycle helmet",
     "Hanging from the handlebar of the bicycle.",
     "Black bicycle helmet dangling from the bike handlebar near the garage door."),
    
    (datetime(2025, 11, 6, 12, 30), "living_room", "tablet",
     "On the sofa cushion beside a throw blanket.",
     "Tablet resting on the sofa cushion next to a folded blanket."),
    
    (datetime(2025, 11, 6, 13, 00), "kitchen", "knife",
     "Drying on the rack near the cutting board.",
     "Chef’s knife placed on the drying rack beside the wooden cutting board."),
    
    (datetime(2025, 11, 6, 13, 45), "bedroom", "earphones",
     "Coiled near the edge of the bed.",
     "White earphones coiled neatly near the edge of the bedspread."),
    
    (datetime(2025, 11, 6, 14, 10), "office", "pen",
     "Next to the notepad under the desk lamp.",
     "Blue ink pen lying beside the notepad under the office desk lamp."),
    
    (datetime(2025, 11, 6, 14, 45), "garden", "gloves",
     "Hanging from the edge of a flowerpot.",
     "Pair of gardening gloves hanging over the rim of a large flowerpot."),
    
    (datetime(2025, 11, 6, 15, 15), "bathroom", "towel",
     "Hung on the back of the door.",
     "Clean white towel hanging on the hook behind the bathroom door."),
    
    (datetime(2025, 11, 6, 15, 45), "living_room", "laptop",
     "Closed on the side table near the sofa.",
     "Laptop computer closed and placed on the small side table beside the sofa."),
    
    (datetime(2025, 11, 6, 16, 10), "kitchen", "water bottle",
     "On the top shelf of the fridge door.",
     "Reusable stainless-steel water bottle kept on the top rack of the refrigerator door.")
     ]
    
    for r in rows:
        upsert_item(*r)
    print(f"Ingested {len(rows)} rows.")