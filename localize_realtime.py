# localize_realtime.py
import cv2, json, numpy as np
from chromadb import Client
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer, util
from PIL import Image
import torch
import time

# ---- Load models and database ----
device = "cuda" if torch.cuda.is_available() else "cpu"
model = SentenceTransformer("clip-ViT-B-32", device=device)

client = Client(Settings(
    is_persistent=True,
    persist_directory="CalibrationDB"
))
collection = client.get_or_create_collection("CalibrationDB")

# Load adjacency graph
with open("calibration/calibration_adjacency.json", "r") as f:
    adjacency = json.load(f)

def preprocess_frame(frame):
    frame = cv2.resize(frame, (224, 224))
    return frame

def generate_embedding(frame):
    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    emb = model.encode(image, convert_to_numpy=True, normalize_embeddings=True)
    return emb

def get_topk_rooms(embedding, k=11):
    results = collection.query(
        query_embeddings=[embedding.tolist()],
        n_results=k,
        include=["metadatas", "distances"]
    )
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]
    rooms = [m["room"] for m in metadatas]
    sims = [1 - d for d in distances]  # convert distance→similarity
    return list(zip(rooms, sims))

def decide_room(prev_room, topk, threshold=0.22):
    # top1 confidence check
    top_room, top_sim = topk[0]
    if top_sim < threshold and prev_room:
        return prev_room  # not confident

    # consensus check
    room_scores = {}
    for r, s in topk:
        room_scores[r] = room_scores.get(r, 0) + s
    best_room = max(room_scores, key=room_scores.get)

    # adjacency check
    if prev_room and best_room not in adjacency.get(prev_room, []):
        return prev_room
    return best_room

def main(camera_index=0):
    cap = cv2.VideoCapture(camera_index)
    prev_room = None
    print("Starting real-time localization... Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame = preprocess_frame(frame)
        emb = generate_embedding(frame)

        topk = get_topk_rooms(emb, k=11)
        current_room = decide_room(prev_room, topk)

        # Display room on frame
        cv2.putText(frame, f"Room: {current_room}", (30, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.imshow("MemPal Localization", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

        prev_room = current_room
        time.sleep(0.3)  # adjust speed if needed

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    import argparse
    a = argparse.ArgumentParser()
    a.add_argument("--camera", default="0", help="Webcam index (0) or path to a video file")
    args = a.parse_args()

    # Try to interpret camera argument
    camera_arg = args.camera
    if camera_arg.isdigit():
        camera_source = int(camera_arg)
    else:
        camera_source = camera_arg  # path to video

    main(camera_source)
