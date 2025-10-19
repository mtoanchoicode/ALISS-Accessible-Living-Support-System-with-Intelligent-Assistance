import os, cv2, json, numpy as np
from tqdm import tqdm
from skimage.metrics import structural_similarity as ssim
from chromadb import Client
from chromadb.config import Settings
from PIL import Image
from sentence_transformers import SentenceTransformer

# Load CLIP model from SentenceTransformers
model = SentenceTransformer("clip-ViT-B-32")

# Initialize ChromaDB (modern config)
client = Client(Settings(
    is_persistent=True,
    persist_directory="CalibrationDB"
))
collection = client.get_or_create_collection("CalibrationDB")

def is_blurry(frame, threshold=100):
    """Check if the frame is blurry using Laplacian variance."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    return lap_var < threshold

def frame_similarity(f1, f2):
    """Compute SSIM similarity between two frames."""
    g1 = cv2.cvtColor(f1, cv2.COLOR_BGR2GRAY)
    g2 = cv2.cvtColor(f2, cv2.COLOR_BGR2GRAY)
    return ssim(g1, g2)

def get_label_for_time(labels, t):
    """Return room label for the given time t."""
    for seg in labels:
        if seg["start"] <= t <= seg["end"]:
            return seg["room"]
    return "unlabeled"

def generate_embedding(frame):
    """Generate embedding using CLIP (SentenceTransformer)."""
    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    emb = model.encode(image, convert_to_numpy=True, normalize_embeddings=True)
    return emb.tolist()

def main(video_path, labels_path="calibration/calibration_labels.json", frame_interval=1):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps

    with open(labels_path, "r") as f:
        labels = json.load(f)

    print(f"🎥 Processing {total_frames} frames (~{duration:.1f}s)...")
    prev_frame = None
    embeddings_added = 0
    last_room = None
    adjacency = {}

    for t in tqdm(np.arange(0, duration, frame_interval)):
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ret, frame = cap.read()
        if not ret:
            print(f"⚠️ Could not read frame at {t:.2f}s")
            continue

        room = get_label_for_time(labels, t)
        if room == "unlabeled":
            print(f"{t:.2f}s → unlabeled (skipping)")
            continue

        # Check blurriness
        lap_var = cv2.Laplacian(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()
        if lap_var < 30:  # relaxed threshold
            print(f"💤 {t:.2f}s → {room} skipped (blurry: {lap_var:.1f})")
            continue

        # Check similarity
        if prev_frame is not None:
            sim = frame_similarity(prev_frame, frame)
            if sim > 0.99:  # more tolerant
                print(f"{t:.2f}s → {room} skipped (too similar, ssim={sim:.3f})")
                continue

        # Encode
        emb = generate_embedding(frame)
        collection.add(
            embeddings=[emb],
            metadatas=[{"room": room, "time": float(t)}],
            ids=[f"{room}_{t:.2f}"]
        )
        embeddings_added += 1
        print(f"Added frame @ {t:.2f}s → {room}")

        # Build adjacency
        if last_room and last_room != room:
            adjacency.setdefault(last_room, set()).add(room)
            adjacency.setdefault(room, set()).add(last_room)
        last_room = room
        prev_frame = frame

    cap.release()

    # Save adjacency map
    adj_path = os.path.splitext(video_path)[0] + "_adjacency.json"
    adjacency = {k: list(v) for k, v in adjacency.items()}
    with open(adj_path, "w") as f:
        json.dump(adjacency, f, indent=2)

    print(f"\nAdded {embeddings_added} embeddings to CalibrationDB")
    print(f"Saved adjacency map to {adj_path}")

if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser()
    a.add_argument("--video", required=True)
    a.add_argument("--labels", default="calibration/calibration_labels.json")
    args = a.parse_args()
    main(args.video, labels_path=args.labels)
