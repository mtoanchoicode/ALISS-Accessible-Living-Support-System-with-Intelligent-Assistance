import ultralytics
ultralytics.checks()

from ultralytics import YOLO
import cv2
from pathlib import Path
from datetime import datetime, timedelta, timezone
from collections import Counter
import math


# ---- Helper functions for spatial reasoning ---- #
def box_area(box):
    x1, y1, x2, y2 = box
    w = max(0, x2 - x1)
    h = max(0, y2 - y1)
    return w * h

def intersection_box(boxA, boxB):
    ax1, ay1, ax2, ay2 = boxA
    bx1, by1, bx2, by2 = boxB

    # compute intersection
    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    if inter_x2 < inter_x1 or inter_y2 < inter_y1:
        return None
    return (inter_x1, inter_y1, inter_x2, inter_y2)


def overlap_ratio_to_object(hand_box, object_box):
    inter = intersection_box(hand_box, object_box)
    if inter is None:
        return 0.0
    inter_area = box_area(inter)
    obj_area = box_area(object_box)
    if obj_area <= 0:
        return 0.0
    return inter_area / obj_area


def draw_results(annotated, object_box, label):
    # Draw object
    ox1, oy1, ox2, oy2 = object_box
    cv2.rectangle(annotated, (ox1, oy1), (ox2, oy2), (0, 255, 0), 2)
    cv2.putText(annotated, label, (ox1, oy1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    return annotated


def adaptive_wrist_box(x, y, person_box=None, frame_shape=None):
    if frame_shape is None:
        raise ValueError("frame_shape cannot be None")

    h, w = frame_shape[:2]

    if person_box:
        px1, py1, px2, py2 = person_box
        person_size = max(px2 - px1, py2 - py1)
        box_size = int(person_size * 0.25)   
    else:
        box_size = int(min(h, w) * 0.05)

    return (
        int(max(0, x - box_size / 2)),
        int(max(0, y - box_size / 2)),
        int(min(w, x + box_size / 2)),
        int(min(h, y + box_size / 2))
    )


def point_to_box_distance(point, box):
    px, py = point
    x1, y1, x2, y2 = box

    dx = max(x1 - px, 0, px - x2)
    dy = max(y1 - py, 0, py - y2)

    return math.hypot(dx, dy)


def box_center(box):
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2, (y1 + y2) / 2)


def compute_motion(p1, p2):
    if p1 is None or p2 is None:
        return 0.0
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])


def find_closest_prev(curr_center, prev_centers):
    best = None
    best_dist = float("inf")

    for pc in prev_centers:
        d = math.hypot(curr_center[0] - pc[0], curr_center[1] - pc[1])
        if d < best_dist:
            best_dist = d
            best = pc

    return best


def dynamic_hand_object_score(wrist_point, wrist_box, object_box, object_class=None, frame_shape=None,
                              non_handheld_classes=None, object_is_moving=False, hand_is_moving=False,
                              motion_correlation_score=0.0, max_handheld_ratio=0.2):

    x1, y1, x2, y2 = object_box
    obj_w = x2 - x1
    obj_h = y2 - y1
    object_area = obj_w * obj_h

    h, w = frame_shape[:2]
    frame_area = h * w

    # --- Base Score Calculation ---
    obj_scale = min(obj_w, obj_h)
    dist = point_to_box_distance(wrist_point, object_box)
    dist_score = 1.0 - min(dist / (obj_scale + 5.0), 1.0) # Added 5.0 for stability
    overlap = overlap_ratio_to_object(wrist_box, object_box)

    base_score = 0.0
    if overlap > 0.3:
        base_score = 0.3 * dist_score + 0.7 * overlap
    else:
        base_score = 0.7 * dist_score + 0.3 * overlap

    # --- Dynamic Filtering and Score Adjustment ---
    is_large = object_area > frame_area * 0.2
    is_non_handheld = object_class.lower() in non_handheld_classes

    if is_large or is_non_handheld:
        # ONLY allow if motion matches hand
        if hand_is_moving and object_is_moving and motion_correlation_score > 0.6:
            return base_score * (0.5 + 0.5 * motion_correlation_score)
        else:
            return 0.0  

    # If not a typically non-handheld object and not too large statically, return the base score
    return base_score



# --- Main functions for hand-object interaction detection --- #
def object_process_video_each_frame(video_path, output_path, pose_model, object_model):

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise Exception(f"Cannot open {video_path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out = cv2.VideoWriter(str(output_path), cv2.VideoWriter_fourcc(*'XVID'), fps, (width, height))

    frame_idx = 0

    events = []
    active_objects = {}   # {label: start_frame} - {Phone - 1}
    events = []
    video_start_time = datetime.now(timezone(timedelta(hours=7)))

    prev_wrist_points = []
    prev_object_centers = []

    non_handheld_classes = ["chair", "tv", "dining table", "bed", "refrigerator"]

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        detected_labels = []
        annotated = frame.copy()

        # ---------- OBJECT DETECTION ----------
        object_boxes = []
        object_results = object_model(frame)

        for r in object_results:
            for box in r.boxes:
                ox1, oy1, ox2, oy2 = map(int, box.xyxy[0])
                label = object_model.names[int(box.cls[0])]
                object_boxes.append(((ox1, oy1, ox2, oy2), label))

        # ---------- POSE DETECTION----------
        pose_results = pose_model.predict(frame, conf=0.4, verbose=False)

        for r in pose_results:
            if r.keypoints is None:
                continue

            for person_id in range(len(r.keypoints.xy)):
                kpts = r.keypoints.xy[person_id].cpu().numpy()

                xs = kpts[:, 0]
                ys = kpts[:, 1]
                person_box = (int(xs.min()), int(ys.min()),
                              int(xs.max()), int(ys.max()))

                wrist_boxes = []

                for i in [9, 10]:
                    if i >= len(kpts):
                        continue

                    x, y = kpts[i]
                    if x <= 0 or y <= 0:
                        continue

                    wrist_box = adaptive_wrist_box(x, y, person_box, frame.shape)
                    wrist_boxes.append((wrist_box, (x, y)))

                # ---------- ASSOCIATION ----------
                for (wrist_box, wrist_point) in wrist_boxes:   
                    best_obj = None
                    best_score = 0.0

                    for (obj_box, label) in object_boxes:
                        if label.lower() == "person":
                            continue

                        curr_wrist = wrist_point
                        curr_obj_center = box_center(obj_box)
                        
                        # previous wrist
                        prev_wrist = prev_wrist_points[person_id] if person_id < len(prev_wrist_points) else None
                        
                        # previous object ()
                        prev_obj = find_closest_prev(curr_obj_center, prev_object_centers)
                        
                        # compute motion
                        wrist_motion = compute_motion(curr_wrist, prev_wrist)
                        obj_motion = compute_motion(curr_obj_center, prev_obj)
                        
                        # flags
                        hand_is_moving = wrist_motion > 5
                        object_is_moving = obj_motion > 5
    
                        if wrist_motion > 0 and obj_motion > 0:
                            motion_corr = min(wrist_motion, obj_motion) / max(wrist_motion, obj_motion)
                        else:
                            motion_corr = 0.0

                        score = dynamic_hand_object_score(wrist_point, wrist_box, obj_box, label, frame.shape,
                              non_handheld_classes, object_is_moving, hand_is_moving,
                              motion_corr)

                        if score > best_score:
                            best_score = score
                            best_obj = label
                            best_box = obj_box

                    if best_obj is not None and best_score > 0.3:
                        detected_labels.append(best_obj)
                        annotated = draw_results(annotated, best_box, best_obj)
                      

        out.write(annotated)


        # ---------- EVENT LOGIC ----------
        if detected_labels:
            counts = Counter(detected_labels)
            # keep objects that appear at least once (or tune threshold)
            frame_objects = [obj for obj, cnt in counts.items() if cnt >= 1]
        else:
            frame_objects = []

        # --- START new objects ---
        for obj in frame_objects:
            if obj not in active_objects:
                active_objects[obj] = frame_idx
        
        # --- END objects that disappeared ---
        for obj in list(active_objects.keys()):
            if obj not in frame_objects:
                start_frame = active_objects[obj]
                
                start_time = video_start_time + timedelta(seconds=start_frame / fps)
                end_time = video_start_time + timedelta(seconds=(frame_idx - 1) / fps)
        
                events.append({
                    "object": obj,
                    "start_frame": start_frame,
                    "end_frame": frame_idx - 1,
                    "start_time": start_time.isoformat(),
                    "end_time":  end_time.isoformat()
                })
        
                del active_objects[obj]

    # ---------- HANDLE LAST EVENT ----------
    for obj, start_frame in active_objects.items():
        start_time = video_start_time + timedelta(seconds=start_frame / fps)
        end_time = video_start_time + timedelta(seconds=(frame_idx - 1) / fps)
        
        events.append({ 
            "object": obj,
            "start_frame": start_frame,
            "end_frame": frame_idx,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        })

   
    cap.release()
    out.release()
    cv2.destroyAllWindows()

    return events



def object_process_video_skipped_frame(video_path, output_path, pose_model, object_model):

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise Exception(f"Cannot open {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out = cv2.VideoWriter(str(output_path), cv2.VideoWriter_fourcc(*'XVID'), fps, (width, height))

    frame_idx = 0
    events = []
    active_objects  = {}
    video_start_time = datetime.now(timezone(timedelta(hours=7)))

    prev_wrist_points   = []
    prev_object_centers = []

    non_handheld_classes = {"chair", "tv", "dining table", "bed", "refrigerator"}  # set for O(1) lookup

    # ── Inference throttle ──────────────────────────────────────────────────
    INFERENCE_EVERY_N = 3          # run models 1-in-3 frames  ← tune this
    cached_object_boxes  = []      # (box, label) list from last inference
    cached_pose_results  = []      # raw pose results from last inference
    # ────────────────────────────────────────────────────────────────────────

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        detected_labels = []
        annotated = frame.copy()

        run_inference = (frame_idx % INFERENCE_EVERY_N == 1)
        # ── OBJECT DETECTION (throttled) ────────────────────────────────────
        if run_inference:
            cached_object_boxes = []
            for r in object_model(frame, verbose=False): #set verbose = False to no print to console
                for box in r.boxes:
                    ox1, oy1, ox2, oy2 = map(int, box.xyxy[0])
                    label = object_model.names[int(box.cls[0])]
                    cached_object_boxes.append(((ox1, oy1, ox2, oy2), label))

        object_boxes = cached_object_boxes          # reuse on skipped frames

        # ── POSE DETECTION  ──────────────────────────────────────
        if run_inference:
            cached_pose_results = pose_model.predict(frame, conf=0.4, verbose=False)

        # Pre-filter once: drop "person" boxes and non-handheld classes
        graspable_boxes = [
            (box, lbl) for box, lbl in object_boxes
            if lbl.lower() != "person" and lbl.lower() not in non_handheld_classes
        ]

        # ── POSE + ASSOCIATION ──────────────────────────────────────────────
        new_wrist_points   = []
        new_object_centers = [box_center(box) for box, _ in graspable_boxes]  # compute once

        for r in cached_pose_results:
            if r.keypoints is None:
                continue

            for person_id, kpts in enumerate(r.keypoints.xy):
                kpts_np = kpts.cpu().numpy()
                xs, ys  = kpts_np[:, 0], kpts_np[:, 1]
                person_box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))

                prev_wrist = prev_wrist_points[person_id] if person_id < len(prev_wrist_points) else None

                for i in (9, 10):
                    if i >= len(kpts_np):
                        continue
                    x, y = kpts_np[i]
                    if x <= 0 or y <= 0:
                        continue

                    wrist_point = (x, y)
                    wrist_box   = adaptive_wrist_box(x, y, person_box, frame.shape)
                    wrist_motion = compute_motion(wrist_point, prev_wrist)
                    hand_is_moving = wrist_motion > 5

                    best_obj, best_score, best_box = None, 0.0, None

                    # ── single pass over pre-filtered graspable objects ──────
                    for (obj_box, label), obj_center in zip(graspable_boxes, new_object_centers):
                        prev_obj   = find_closest_prev(obj_center, prev_object_centers)
                        obj_motion = compute_motion(obj_center, prev_obj)
                        object_is_moving = obj_motion > 5

                        motion_corr = (
                            min(wrist_motion, obj_motion) / max(wrist_motion, obj_motion)
                            if wrist_motion > 0 and obj_motion > 0 else 0.0
                        )

                        score = dynamic_hand_object_score(
                            wrist_point, wrist_box, obj_box, label, frame.shape,
                            non_handheld_classes, object_is_moving, hand_is_moving, motion_corr
                        )

                        if score > best_score:
                            best_score, best_obj, best_box = score, label, obj_box

                    if best_obj is not None and best_score > 0.3:
                        detected_labels.append(best_obj)
                        annotated = draw_results(annotated, best_box, best_obj)

                new_wrist_points.append(wrist_point if 'wrist_point' in dir() else None)

        # Carry forward wrist/object state for next frame
        prev_wrist_points   = new_wrist_points
        prev_object_centers = new_object_centers

        out.write(annotated)

        # ── EVENT LOGIC (unchanged) ─────────────────────────────────────────
        frame_objects = [obj for obj, cnt in Counter(detected_labels).items() if cnt >= 1] if detected_labels else []

        for obj in frame_objects:
            if obj not in active_objects:
                active_objects[obj] = frame_idx

        for obj in list(active_objects):
            if obj not in frame_objects:
                start_frame = active_objects.pop(obj)
                start_time  = video_start_time + timedelta(seconds=start_frame / fps)
                end_time    = video_start_time + timedelta(seconds=(frame_idx - 1) / fps)
                
                events.append({"object": obj, "start_frame": start_frame, "end_frame": frame_idx - 1,
                                "start_time": start_time.isoformat(), "end_time": end_time.isoformat()})

    # ── FLUSH REMAINING ACTIVE OBJECTS ─────────────────────────────────────
    for obj, start_frame in active_objects.items():
        start_time = video_start_time + timedelta(seconds=start_frame / fps)
        end_time   = video_start_time + timedelta(seconds=(frame_idx - 1) / fps)
        
        events.append({"object": obj, "start_frame": start_frame, "end_frame": frame_idx,
                       "start_time": start_time.isoformat(), "end_time": end_time.isoformat()})

    cap.release()
    out.release()
    cv2.destroyAllWindows()
    return events



if __name__ == "__main__":
    pose_model = YOLO("model/YOLO26_pose.pt")
    object_model = YOLO("model/YOLO26_object.pt")
    video_path = Path("input/CCTV_7.mp4")
    output_path = Path("output_videos/annotated_video_object.avi")

    events = object_process_video_skipped_frame(video_path, output_path, pose_model, object_model)
    for event in events:
        print(event)