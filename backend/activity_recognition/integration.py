"""
Integration pipeline: combines ReID-based person tracking with Phat's pose/object
detection to produce named hold/release interaction events from a video.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import cv2
import torch
from ultralytics import YOLO

from torchreid.metrics import compute_distance_matrix


# ── Geometry helpers (mirrors Object_detection_indoor.py) ──────────────────

def _box_area(box: Tuple) -> float:
    x1, y1, x2, y2 = box
    return float(max(0, x2 - x1) * max(0, y2 - y1))


def _intersection_box(a: Tuple, b: Tuple) -> Optional[Tuple]:
    ix1 = max(a[0], b[0])
    iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2])
    iy2 = min(a[3], b[3])
    if ix2 < ix1 or iy2 < iy1:
        return None
    return (ix1, iy1, ix2, iy2)


def _overlap_ratio_to_object(hand_box: Tuple, object_box: Tuple) -> float:
    inter = _intersection_box(hand_box, object_box)
    if inter is None:
        return 0.0
    inter_area = _box_area(inter)
    obj_area = _box_area(object_box)
    if obj_area <= 0:
        return 0.0
    return inter_area / obj_area


def _box_center(box: Tuple) -> Tuple[float, float]:
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def _point_to_box_distance(point: Tuple, box: Tuple) -> float:
    px, py = point
    x1, y1, x2, y2 = box
    dx = max(x1 - px, 0, px - x2)
    dy = max(y1 - py, 0, py - y2)
    return math.hypot(dx, dy)


def _compute_motion(p1, p2) -> float:
    if p1 is None or p2 is None:
        return 0.0
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])


def _find_closest_prev(curr_center: Tuple, prev_centers: List) -> Optional[Tuple]:
    best, best_dist = None, float("inf")
    for pc in prev_centers:
        d = math.hypot(curr_center[0] - pc[0], curr_center[1] - pc[1])
        if d < best_dist:
            best_dist = d
            best = pc
    return best


def _adaptive_wrist_box(x: float, y: float, person_box: Tuple, frame_shape: Tuple) -> Tuple:
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
        int(min(h, y + box_size / 2)),
    )


def _dynamic_hand_object_score(
    wrist_point: Tuple,
    wrist_box: Tuple,
    object_box: Tuple,
    object_class: str,
    frame_shape: Tuple,
    non_handheld_classes: Set[str],
    object_is_moving: bool,
    hand_is_moving: bool,
    motion_correlation_score: float,
) -> float:
    x1, y1, x2, y2 = object_box
    obj_w, obj_h = x2 - x1, y2 - y1
    object_area = obj_w * obj_h
    h, w = frame_shape[:2]
    frame_area = h * w

    obj_scale = min(obj_w, obj_h)
    dist = _point_to_box_distance(wrist_point, object_box)
    dist_score = 1.0 - min(dist / (obj_scale + 5.0), 1.0)
    overlap = _overlap_ratio_to_object(wrist_box, object_box)

    if overlap > 0.3:
        base_score = 0.3 * dist_score + 0.7 * overlap
    else:
        base_score = 0.7 * dist_score + 0.3 * overlap

    is_large = object_area > frame_area * 0.2
    is_non_handheld = object_class.lower() in non_handheld_classes

    if is_large or is_non_handheld:
        if hand_is_moving and object_is_moving and motion_correlation_score > 0.6:
            return base_score * (0.5 + 0.5 * motion_correlation_score)
        return 0.0

    return base_score


def _iou(boxA: Tuple, boxB: Tuple) -> float:
    inter = _intersection_box(boxA, boxB)
    if inter is None:
        return 0.0
    inter_area = _box_area(inter)
    union = _box_area(boxA) + _box_area(boxB) - inter_area
    if union <= 0:
        return 0.0
    return inter_area / union


def _person_holds_object(person_box: Tuple, obj_box: Tuple, proximity_px: float = 50.0) -> bool:
    """Returns True if the object overlaps or is within proximity_px of the person box."""
    if _iou(person_box, obj_box) > 0:
        return True
    cx, cy = _box_center(obj_box)
    return _point_to_box_distance((cx, cy), person_box) < proximity_px


# ── Main integration class ─────────────────────────────────────────────────

class IntegratedVideoProcessor:
    """
    Runs ReID tracking and Phat's pose/object detection in a single frame loop.

    Per frame:
      - YOLO bytetrack  -> track_id -> person bounding box
      - ReID extractor  -> track_id -> person name
      - YOLO pose       -> wrist keypoints per pose person
      - YOLO object     -> object bounding boxes
      - Wrist-object scoring (Phat's logic) -> held objects with bounding boxes
      - IoU/proximity   -> link each held object to the closest named person

    Output: flat list of start_hold / end_hold events with person name, object
    name, ISO timestamp, and room location.
    """

    NON_HANDHELD: Set[str] = {"chair", "tv", "dining table", "bed", "refrigerator"}
    INFERENCE_EVERY_N: int = 3       # run pose+object models every N frames
    HOLD_SCORE_THRESHOLD: float = 0.3
    PERSON_PROXIMITY_PX: float = 50.0

    def __init__(
        self,
        reid_runner,            # PersonReIDRunner instance
        pose_model_path: str,
        object_model_path: str,
    ) -> None:
        self.reid_runner = reid_runner
        self.pose_model = YOLO(pose_model_path)
        self.object_model = YOLO(object_model_path)

    def process_video(
        self,
        video_path: Path,
        output_path: Path,
        location: str,
    ) -> List[Dict]:
        """
        Process a video and return a list of interaction events.

        Each event dict has:
          type        : "start_hold" | "end_hold"
          person_name : str
          object_name : str
          time        : ISO-8601 string (UTC+7)
          location    : str  (room name passed in)
        """
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        out = cv2.VideoWriter(
            str(output_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height)
        )

        # Load a fresh YOLO tracker per video to keep tracking state isolated.
        yolo_tracker = YOLO(str(self.reid_runner.config.yolo_weights))

        # Per-video state
        assigned_names: Dict[int, str] = {}       # track_id -> resolved name
        track_history: Dict[int, int] = {}         # track_id -> frames seen count
        active_objects: Dict[Tuple[str, str], int] = {}  # (person, obj) -> start_frame
        events: List[Dict] = []

        video_start_time = datetime.now(timezone(timedelta(hours=7)))

        # Throttle cache (mirrors object_process_video_skipped_frame)
        cached_object_boxes: List[Tuple] = []
        cached_pose_results = []
        prev_wrist_points: List = []
        prev_object_centers: List = []

        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            run_inference = (frame_idx % self.INFERENCE_EVERY_N == 1)
            h_frame, w_frame = frame.shape[:2]

            # ── 1. YOLO tracking + ReID ──────────────────────────────────
            track_results = yolo_tracker.track(
                frame,
                persist=True,
                tracker=self.reid_runner.config.tracker,
                classes=list(self.reid_runner.config.yolo_classes),
                verbose=False,
            )

            tracked_persons: Dict[int, Tuple] = {}  # track_id -> clamped bbox

            for r in track_results:
                if r.boxes.id is None:
                    continue
                for box, track_id in zip(
                    r.boxes.xyxy.int().cpu().tolist(),
                    r.boxes.id.int().cpu().tolist(),
                ):
                    x1, y1, x2, y2 = box
                    x1 = max(0, min(x1, w_frame - 1))
                    y1 = max(0, min(y1, h_frame - 1))
                    x2 = max(0, min(x2, w_frame - 1))
                    y2 = max(0, min(y2, h_frame - 1))
                    tracked_persons[track_id] = (x1, y1, x2, y2)

                    track_history[track_id] = track_history.get(track_id, 0) + 1
                    should_reid = (
                        track_history[track_id] % self.reid_runner.config.check_interval == 0
                    )

                    if should_reid:
                        crop = frame[y1:y2, x1:x2]
                        if crop.size > 0 and crop.shape[0] >= 60 and crop.shape[1] >= 30:
                            crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                            with torch.no_grad():
                                feat = self.reid_runner.extractor([crop_rgb])
                            dist_mat = compute_distance_matrix(
                                feat,
                                self.reid_runner.gallery_tensor,
                                metric="cosine",
                            )
                            min_dist, min_idx = torch.min(dist_mat[0], dim=0)
                            if float(min_dist.item()) < self.reid_runner.config.reid_threshold:
                                assigned_names[track_id] = self.reid_runner.gallery_display_ids[
                                    min_idx.item()
                                ]
                            else:
                                assigned_names.setdefault(track_id, "Unknown")

            # ── 2. Object detection (throttled) ─────────────────────────
            if run_inference:
                cached_object_boxes = []
                for r in self.object_model(frame, verbose=False):
                    for box in r.boxes:
                        ox1, oy1, ox2, oy2 = map(int, box.xyxy[0])
                        label = self.object_model.names[int(box.cls[0])]
                        cached_object_boxes.append(((ox1, oy1, ox2, oy2), label))

            # ── 3. Pose detection (throttled) ────────────────────────────
            if run_inference:
                cached_pose_results = self.pose_model.predict(frame, conf=0.4, verbose=False)

            graspable_boxes = [
                (box, lbl)
                for box, lbl in cached_object_boxes
                if lbl.lower() != "person" and lbl.lower() not in self.NON_HANDHELD
            ]
            new_object_centers = [_box_center(box) for box, _ in graspable_boxes]
            new_wrist_points: List = []

            # ── 4. Wrist-object association (Phat's scoring logic) ───────
            # held_objects: list of (obj_bbox, obj_label) confirmed as held this frame
            held_objects: List[Tuple[Tuple, str]] = []

            for r in cached_pose_results:
                if r.keypoints is None:
                    continue

                for person_id, kpts in enumerate(r.keypoints.xy):
                    kpts_np = kpts.cpu().numpy()
                    xs, ys = kpts_np[:, 0], kpts_np[:, 1]
                    person_box = (
                        int(xs.min()), int(ys.min()),
                        int(xs.max()), int(ys.max()),
                    )

                    prev_wrist = (
                        prev_wrist_points[person_id]
                        if person_id < len(prev_wrist_points)
                        else None
                    )
                    last_wrist_point = None

                    for i in (9, 10):   # left wrist = 9, right wrist = 10
                        if i >= len(kpts_np):
                            continue
                        x, y = kpts_np[i]
                        if x <= 0 or y <= 0:
                            continue

                        wrist_point = (float(x), float(y))
                        last_wrist_point = wrist_point
                        wrist_box = _adaptive_wrist_box(x, y, person_box, frame.shape)
                        wrist_motion = _compute_motion(wrist_point, prev_wrist)
                        hand_is_moving = wrist_motion > 5

                        best_obj, best_score, best_box = None, 0.0, None

                        for (obj_box, label), obj_center in zip(
                            graspable_boxes, new_object_centers
                        ):
                            prev_obj = _find_closest_prev(obj_center, prev_object_centers)
                            obj_motion = _compute_motion(obj_center, prev_obj)
                            object_is_moving = obj_motion > 5
                            motion_corr = (
                                min(wrist_motion, obj_motion) / max(wrist_motion, obj_motion)
                                if wrist_motion > 0 and obj_motion > 0
                                else 0.0
                            )
                            score = _dynamic_hand_object_score(
                                wrist_point, wrist_box, obj_box, label, frame.shape,
                                self.NON_HANDHELD, object_is_moving, hand_is_moving,
                                motion_corr,
                            )
                            if score > best_score:
                                best_score, best_obj, best_box = score, label, obj_box

                        if best_obj is not None and best_score > self.HOLD_SCORE_THRESHOLD:
                            held_objects.append((best_box, best_obj))

                    new_wrist_points.append(last_wrist_point)

            prev_wrist_points = new_wrist_points
            prev_object_centers = new_object_centers

            # ── 5. Link held objects to named persons via IoU/proximity ──
            # For each held object, find the tracked person whose bbox has
            # the highest IoU with the object bbox. If no IoU exists but the
            # object center is within PERSON_PROXIMITY_PX of a person box,
            # that person is still assigned.
            frame_pairs: Set[Tuple[str, str]] = set()  # (person_name, object_label)

            for obj_box, obj_label in held_objects:
                best_person = "Unknown"
                best_iou = -1.0

                for track_id, person_bbox in tracked_persons.items():
                    if _person_holds_object(person_bbox, obj_box, self.PERSON_PROXIMITY_PX):
                        iou_val = _iou(person_bbox, obj_box)
                        if iou_val > best_iou:
                            best_iou = iou_val
                            best_person = assigned_names.get(track_id, "Unknown")

                frame_pairs.add((best_person, obj_label))

            # ── 6. Event tracking ────────────────────────────────────────
            current_time_fn = lambda fi: (
                video_start_time + timedelta(seconds=fi / fps)
            ).isoformat()

            # Open new interactions
            for pair in frame_pairs:
                if pair not in active_objects:
                    active_objects[pair] = frame_idx
                    events.append({
                        "type": "start_hold",
                        "person_name": pair[0],
                        "object_name": pair[1],
                        "time": current_time_fn(frame_idx),
                        "location": location,
                    })

            # Close interactions that disappeared
            for pair in list(active_objects):
                if pair not in frame_pairs:
                    active_objects.pop(pair)
                    events.append({
                        "type": "end_hold",
                        "person_name": pair[0],
                        "object_name": pair[1],
                        "time": current_time_fn(frame_idx - 1),
                        "location": location,
                    })

            out.write(frame)

        # ── 7. Flush objects still active at end of video ────────────────
        for (person_name, obj_name) in active_objects:
            events.append({
                "type": "end_hold",
                "person_name": person_name,
                "object_name": obj_name,
                "time": current_time_fn(frame_idx - 1),
                "location": location,
            })

        cap.release()
        out.release()
        cv2.destroyAllWindows()

        return events
