# utils.py
import os
import numpy as np
from PIL import Image
import cv2
from skimage.metrics import structural_similarity as ssim
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
from typing import List, Tuple, Dict
import math

LAPLACIAN_THRESHOLD = 25          # frames with laplacian var < this are "blurry"
SSIM_THRESHOLD = 0.95             # consecutive frames with SSIM >= this are "too similar"
CHROMA_DIR = "./chroma_store"     # persistent choma store path
CHROMA_COLLECTION = "room_embeddings"
EMBEDDING_MODEL_NAME = "clip-ViT-B-32"  # sentence-transformers friendly
EMBEDDING_DIM = 512               # CLIP-ViT-B-32 embedding dim (sentence-transformers)


# Load CLIP model (sentence-transformers wrapper)
_model = None
def load_clip_model(force_reload=False):
    global _model
    if _model is None or force_reload:
        _model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _model

def get_embedding_from_pil(img: Image.Image) -> np.ndarray:
    """Return normalized 1D numpy array embedding (float32). Accepts PIL.Image."""
    model = load_clip_model()
    # sentence-transformers accepts PIL.Image
    emb = model.encode(img, convert_to_numpy=True)
    # normalize to unit length
    norm = np.linalg.norm(emb)
    if norm == 0:
        return emb.astype(np.float32)
    return (emb / norm).astype(np.float32)

def is_blurry(frame_bgr: np.ndarray, threshold: float = LAPLACIAN_THRESHOLD) -> bool:
    """Return True if frame is blurry (Laplacian variance below threshold). Frame is OpenCV BGR."""
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    return lap_var < threshold

def ssim_compare(frame_a_bgr: np.ndarray, frame_b_bgr: np.ndarray) -> float:
    """Return SSIM score between two BGR frames (0..1). Convert to grayscale before SSIM."""
    a_gray = cv2.cvtColor(frame_a_bgr, cv2.COLOR_BGR2GRAY)
    b_gray = cv2.cvtColor(frame_b_bgr, cv2.COLOR_BGR2GRAY)
    score = ssim(a_gray, b_gray)
    return float(score)

def bgr_to_pil(frame_bgr: np.ndarray) -> Image.Image:
    """Convert OpenCV BGR np array to PIL RGB Image."""
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)

_chroma_client = None
_chroma_collection = None

def get_chroma_collection():
    """
    Compatible with new Chroma versions (>=0.5).
    Creates or loads a persistent local database at ./chroma_store.
    """
    global _chroma_client, _chroma_collection
    if _chroma_collection is not None:
        return _chroma_collection

    # Use the new PersistentClient
    _chroma_client = chromadb.PersistentClient(path="./chroma_store")

    # Get or create a collection (vector database)
    try:
        _chroma_collection = _chroma_client.get_collection("room_embeddings")
    except Exception:
        _chroma_collection = _chroma_client.create_collection(
            name="room_embeddings",
            metadata={"hnsw:space": "cosine"}
        )

    return _chroma_collection

def add_embedding_to_db(embedding: np.ndarray, room_label: str, metadata: dict = None, id: str = None):
    """Add one normalized embedding (1D numpy) to chroma collection with metadata={'room': room_label}."""
    col = get_chroma_collection()
    vec = embedding.tolist()
    meta = {"room": room_label}
    if metadata:
        meta.update(metadata)
    if id is None:
        # unique id
        id = f"{room_label}_{np.random.randint(1_000_000_000)}"
    col.add(ids=[id], metadatas=[meta], documents=[None], embeddings=[vec])
    return id

def query_db_topk(embedding: np.ndarray, k: int = 11) -> Tuple[List[str], List[dict], List[float]]:
    """Query chroma top-k. Returns (ids, metadatas, distances) where distances are cosine distances (1 - cos_sim).
       Note: chroma returns distances in some format; to be safe we compute similarity by dot product with stored embeddings if needed.
    """
    col = get_chroma_collection()
    vec = embedding.tolist()
    # Chroma's query returns 'distances' which for some implementations may be cosine distances.
    # We'll rely on what chroma returns as 'distances'. Tests show these are small numbers for close vectors.
    results = col.query(query_embeddings=[vec], n_results=k)
    # results contains ids, distances, metadatas
    ids = results["ids"][0] if "ids" in results else []
    metadatas = results["metadatas"][0] if "metadatas" in results else []
    distances = results["distances"][0] if "distances" in results else []
    # Ensure floats:
    distances = [float(d) for d in distances]
    return ids, metadatas, distances

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two 1D numpy vectors (assume normalized OK)."""
    # safer: use dot
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))

def cosine_distance_from_similarity(sim: float) -> float:
    """Return 1 - sim (distance)."""
    return 1.0 - sim
