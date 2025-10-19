from sentence_transformers import SentenceTransformer
from PIL import Image
import chromadb
import numpy as np
import os

# Initialize CLIP model
model = SentenceTransformer("sentence-transformers/clip-ViT-B-32")

# Initialize persistent Chroma database
client = chromadb.PersistentClient(path="./chroma_store")

# Use cosine similarity instead of Euclidean distance
collection = client.get_or_create_collection(
    name="room_embeddings",
    metadata={"hnsw:space": "cosine"}
)

def encode_image(image_path):
    """Convert image to a normalized embedding vector."""
    image = Image.open(image_path).convert("RGB")
    emb = model.encode(image)
    emb = emb / np.linalg.norm(emb)
    return emb.tolist()

def add_room_image(room_name, image_path):
    """Add an example image of a room to the database."""
    emb = encode_image(image_path)
    collection.add(
        ids=[os.path.basename(image_path)],
        embeddings=[emb],
        metadatas=[{"room": room_name}]
    )
    print(f"Added '{room_name}' from {image_path}")

def predict_room(image_path, top_k=3):
    """Predict the most similar stored room for a new image."""
    emb = encode_image(image_path)
    result = collection.query(query_embeddings=[emb], n_results=top_k)

    if not result["metadatas"] or len(result["metadatas"][0]) == 0:
        print("No matching room found.")
        return None

    print(f"\n🔍 Similar Rooms for: {image_path}")
    for i in range(len(result["ids"][0])):
        room = result["metadatas"][0][i]["room"]
        distance = result["distances"][0][i]
        similarity = 1 - distance  # since cosine distance = 1 - cosine similarity
        print(f"{i+1}. {room} → similarity: {similarity:.3f}")

    # Return top prediction
    best_room = result["metadatas"][0][0]["room"]
    print(f"\nPredicted room: {best_room}")
    return best_room
