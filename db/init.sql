CREATE EXTENSION IF NOT EXISTS vector;

-- Core KB table
CREATE TABLE IF NOT EXISTS kb_items (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ,
  location TEXT,
  object TEXT,
  background TEXT,
  text TEXT,
  embedding vector(384)
);

-- KNN index (enable after you have a few hundred+ rows)
-- You can create it now; pgvector will still work with few rows.
CREATE INDEX IF NOT EXISTS kb_items_embedding_ivfflat
ON kb_items
USING ivfflat (embedding vector_cosine) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS kb_items_loc_ts ON kb_items (location, ts DESC);