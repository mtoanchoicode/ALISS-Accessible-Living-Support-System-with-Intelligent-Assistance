import psycopg2
import numpy as np
from datetime import datetime

DB_URL = "postgresql://postgres:nguyenngoclamdan@db.ysiezbzodybmnkhcznyy.supabase.co:5432/postgres"

EMBED_DIM = 384   # change if needed


# =========================
# Connection
# =========================
def get_conn():
    return psycopg2.connect(DB_URL)


# =========================
# Enable pgvector + CREATE TABLE
# =========================
def create_table():
    conn = get_conn()
    cur = conn.cursor()

    # enable extension
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS scene_memory (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP,
            object TEXT,
            background TEXT,
            text TEXT,
            embedding VECTOR({EMBED_DIM})
        );
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("✅ Table created")


# =========================
# Helper: convert list → vector string
# =========================
def to_vector(vec):
    return "[" + ",".join(map(str, vec)) + "]"


# =========================
# INSERT
# =========================
def insert_row(obj, background, text ="", embedding ="", who="User"):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO scene_memory (ts, object, background, text, who, embedding)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        datetime.utcnow(),
        obj,
        background,
        text,
        who,
        to_vector(embedding)
    ))

    conn.commit()
    cur.close()
    conn.close()
    print("✅ Inserted")


# =========================
# READ
# =========================
def get_all():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT id, object, background, text FROM scene_memory")
    rows = cur.fetchall()

    cur.close()
    conn.close()
    return rows


# =========================
# UPDATE
# =========================
def update_text(row_id, new_text):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        UPDATE scene_memory
        SET text = %s
        WHERE id = %s
    """, (new_text, row_id))

    conn.commit()
    cur.close()
    conn.close()
    print("✅ Updated")


# =========================
# DELETE
# =========================
def delete_row(row_id):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("DELETE FROM scene_memory WHERE id = %s", (row_id,))

    conn.commit()
    cur.close()
    conn.close()
    print("✅ Deleted")


# =========================
# VECTOR SEARCH (important 🔥)
# =========================
def similarity_search(query_embedding, top_k=3):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(f"""
        SELECT id, object, text,
        embedding <-> %s AS distance
        FROM scene_memory
        ORDER BY embedding <-> %s
        LIMIT %s
    """, (to_vector(query_embedding), to_vector(query_embedding), top_k))

    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


# =========================
# TEST
# =========================
if __name__ == "__main__":
    create_table()

    fake_embedding = np.random.rand(EMBED_DIM).tolist()

    insert_row(
        obj="car",
        background="street",
        text="A red car on the street",
        embedding=fake_embedding
    )

    print("📌 Rows:", get_all())

    print("🔎 Similar:", similarity_search(fake_embedding))