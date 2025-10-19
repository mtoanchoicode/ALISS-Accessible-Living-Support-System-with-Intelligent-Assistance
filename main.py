import cv2
from embeddings import get_embedding
from vector_db import add_embedding, find_nearest
from preprocessing import is_blurry, similarity
from firebase_db import add_location
import datetime

cap = cv2.VideoCapture(0)
last_frame = None

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Skip blurry frames
    if is_blurry(frame):
        continue

    # Skip similar frames
    if last_frame is not None and similarity(frame, last_frame) > 0.9:
        continue

    # Get embedding and find location
    embedding = get_embedding(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
    result = find_nearest(embedding)

    # Identify most similar room
    if result["metadatas"]:
        room = result["metadatas"][0][0]["room"]
        print(f"User is likely in: {room}")

        # Log to Firebase
        add_location("user123", room, datetime.datetime.now().isoformat())

    last_frame = frame

cap.release()

