# vision/test_camera.py

import cv2
from ultralytics import YOLO
from dotenv import load_dotenv
from PIL import Image
# from vision.context_builder import describe_and_save
from vision.v2_graph_context_builder import process_and_remember_observation, load_graph
load_dotenv()

# ==========================================================
# Config
# ==========================================================
MODEL_NAME   = "yolov8n.pt"      # YOLO model
CAMERA_INDEX = 0
CONF_THRESH  = 0.25
PADDING_PX   = 40
WINDOW_NAME  = "ALISS Vision – Press 1–9 to capture | Q to quit"

# Default logical location (you can later improve this)
DEFAULT_LOCATION = "camera_capture"


# ==========================================================
# Init YOLO
# ==========================================================
model = YOLO(MODEL_NAME)
model.overrides["show"] = False


# ==========================================================
# Crop helper
# ==========================================================
def crop_with_padding(frame, det, padding):
    h, w = frame.shape[:2]

    cx1 = max(0, det["x1"] - padding)
    cy1 = max(0, det["y1"] - padding)
    cx2 = min(w, det["x2"] + padding)
    cy2 = min(h, det["y2"] + padding)

    return frame[cy1:cy2, cx1:cx2].copy()


# ==========================================================
# Main Camera Loop
# ==========================================================
def main():

    GRAPH_SAVE_PATH = "./home_memory_graph.pkl"
    memory = load_graph(GRAPH_SAVE_PATH)
    memory.plot_graph()

    cap = cv2.VideoCapture(CAMERA_INDEX)

    if not cap.isOpened():
        raise RuntimeError(f"Cannot open camera index {CAMERA_INDEX}")

    print("📷 Camera started.")
    print("Press number key (1–9) to describe detected object.")
    print("Press Q to quit.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to grab frame.")
            break

        # Run YOLO
        results = model(
            frame,
            verbose=False,
            conf=CONF_THRESH,
            classes=list(range(24, 80)),
        )[0]

        current_dets = []
        display = frame.copy()

        # Draw detections
        for i, box in enumerate(results.boxes):
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf[0])
            cls  = int(box.cls[0])
            if cls < 24:
                continue
            name = model.names[cls]

            label = f"{i+1}: {name}"
            current_dets.append(
                dict(
                    name=name,
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                )
            )

            # Draw rectangle
            cv2.rectangle(display, (x1, y1), (x2, y2), (0, 255, 0), 2)

            tag = f"{label} {conf:.2f}"
            (tw, th), _ = cv2.getTextSize(
                tag, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1
            )

            cv2.rectangle(display, (x1, y1 - th - 6),
                          (x1 + tw + 4, y1), (0, 255, 0), -1)

            cv2.putText(
                display,
                tag,
                (x1 + 2, y1 - 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 0, 0),
                1,
            )

        cv2.putText(
            display,
            "Press 1–9 to save object | Q to quit",
            (10, 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 0),
            2,
        )

        cv2.imshow(WINDOW_NAME, display)

        key = cv2.waitKey(1) & 0xFF

        # --------------------------------------------------
        # Handle number keys (1–9)
        # --------------------------------------------------
        if ord("1") <= key <= ord("9"):
            idx = key - ord("1")

            if idx < len(current_dets):
                det = current_dets[idx]
                cropped = crop_with_padding(frame, det, PADDING_PX)
                cropped_rgb = cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB)
                cropped_pil = Image.fromarray(cropped_rgb)

                obj_name = det["name"]
                print(f"\n🧠 Capturing object: {obj_name}")

                # 👇 USER INPUT LOCATION HERE
                location = input("📍 Enter location (e.g., kitchen, bedroom): ").strip()
                if not location:
                    print("⚠ Location required. Skipping save.\n")
                    continue

                try:
                    # record = describe_and_save(
                    #     obj_name=obj_name,
                    #     image=cropped,
                    #     location=location,
                    # )
                    desc = process_and_remember_observation(
                        graph=memory,
                        image=cropped_pil,
                        object_name=obj_name,
                        room_name=location,
                        save_path=GRAPH_SAVE_PATH
                    )
                    print("✅ Saved to memory:", desc, "\n")

                except Exception as e:
                    print("❌ Error saving memory:", e)

        if key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("👋 Camera closed.")


# ==========================================================
if __name__ == "__main__":
    main()