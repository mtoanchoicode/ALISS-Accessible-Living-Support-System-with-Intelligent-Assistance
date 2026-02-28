
import cv2
import numpy as np
from ultralytics import YOLO
import time

from context_builder import describe_and_save

MODEL_NAME   = "yolov8n.pt"   # smallest/fastest; change to yolov8s.pt etc.
CAMERA_INDEX = 0
CONF_THRESH  = 0.35           # minimum confidence to draw a box
PADDING_PX   = 40             # extra pixels around crop for context
WINDOW_NAME  = f"YOLO Camera – click a box"

model = YOLO(MODEL_NAME)
model.overrides["show"] = False

def main():
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open camera index {CAMERA_INDEX}")


    print("Camera running. Click inside a bounding box to describe it. Press Q to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame.")
            break

        # YOLO inference
        results = model(frame, verbose=False, conf=CONF_THRESH, classes=list(range(1, 80)))[0]
        current_dets = []
        display = frame.copy()

        for i, box in enumerate(results.boxes):
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf  = float(box.conf[0])
            cls   = int(box.cls[0])
            label = f"{i+1}: {model.names[cls]} {conf:.2f}"

            current_dets.append(dict(label=label, x1=x1, y1=y1, x2=x2, y2=y2))

            # Draw bounding box
            cv2.rectangle(display, (x1, y1), (x2, y2), (0, 255, 0), 2)
            tag = f"{label} {conf:.2f}"
            (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            cv2.rectangle(display, (x1, y1 - th - 6), (x1 + tw + 4, y1), (0, 255, 0), -1)
            cv2.putText(display, tag, (x1 + 2, y1 - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1)

        # Hint text
        cv2.putText(display, "Click a box to describe  |  Q = quit",
                    (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)


        cv2.imshow(WINDOW_NAME, display)

        key = cv2.waitKey(1) & 0xFF

        # Number keys 1–9
        if ord('1') <= key <= ord('9'):
            idx = key - ord('1')  # convert ASCII to index
            if idx < len(current_dets):
                det = current_dets[idx]

                h, w = frame.shape[:2]
                cx1 = max(0, det["x1"] - PADDING_PX)
                cy1 = max(0, det["y1"] - PADDING_PX)
                cx2 = min(w, det["x2"] + PADDING_PX)
                cy2 = min(h, det["y2"] + PADDING_PX)

                cropped = frame[cy1:cy2, cx1:cx2].copy()
                clean_name = det["label"].split(": ")[1].rsplit(" ", 1)[0]
                print(f"Selected: {clean_name}")
                result = describe_and_save(clean_name, cropped)
                print(result)

        if key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()