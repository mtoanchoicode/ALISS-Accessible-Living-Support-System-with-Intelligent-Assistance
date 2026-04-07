from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import torch
from torch import Tensor
from ultralytics import YOLO
from torchreid.utils import FeatureExtractor
from torchreid.metrics import compute_distance_matrix


@dataclass(frozen=True)
class ReIDConfig:
    # Paths are expected to be absolute.
    repo_root: Path
    yolo_weights: Path
    gallery_dir: Path
    torch_home: Path

    # ReID / matching config
    extractor_model_name: str = "osnet_ain_x1_0"
    reid_threshold: float = 0.25
    check_interval: int = 10

    # Tracking config
    tracker: str = "bytetrack.yaml"
    yolo_classes: Tuple[int, ...] = (0,)  # person class

    # Display labels mapping (kept for compatibility with your existing naming)
    person_id_map: Dict[str, str] | None = None


class PersonReIDRunner:
    """
    Loads the ReID feature extractor + gallery once.
    Loads YOLO per video request to keep tracking state isolated.
    """

    def __init__(self, config: ReIDConfig) -> None:
        if not config.gallery_dir.exists():
            raise FileNotFoundError(f"Gallery folder not found: {config.gallery_dir}")

        os.environ["TORCH_HOME"] = str(config.torch_home)
        self.config = config

        device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device

        print(f"[ReID] Loading feature extractor ({config.extractor_model_name}) on {device} ...")
        self.extractor = FeatureExtractor(model_name=config.extractor_model_name, device=device)

        print("[ReID] Building gallery features ...")
        self.gallery_tensor, self.gallery_display_ids = self._build_gallery()
        print(f"[ReID] Gallery ready: {len(self.gallery_display_ids)} feature vectors.")

    def _build_gallery(self) -> Tuple[Tensor, List[str]]:
        gallery_tensors: List[Tensor] = []
        gallery_ids: List[str] = []

        person_id_map = self.config.person_id_map or {}

        # Deterministic order (helps debugging).
        for person_dir in sorted(self.config.gallery_dir.iterdir()):
            if not person_dir.is_dir():
                continue

            raw_id = person_dir.name
            display_id = person_id_map.get(raw_id, raw_id)

            image_names = [
                f
                for f in os.listdir(str(person_dir))
                if f.lower().endswith((".jpg", ".png", ".jpeg"))
            ]
            full_paths = [os.path.join(str(person_dir), img) for img in image_names]
            if not full_paths:
                continue

            features = self.extractor(full_paths)  # (N, D)
            for i in range(features.size(0)):
                gallery_tensors.append(features[i].unsqueeze(0))  # (1, D)
                gallery_ids.append(display_id)

        if not gallery_tensors:
            raise ValueError(
                f"Gallery is empty: no images found under {self.config.gallery_dir}"
            )

        all_gallery_tensor = torch.cat(gallery_tensors, dim=0)
        return all_gallery_tensor, gallery_ids

    def process_video(self, input_video_path: Path, output_video_path: Path) -> Dict:
        """
        Returns a small summary dict. The annotated video is written to output_video_path.
        """

        cap = cv2.VideoCapture(str(input_video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video: {input_video_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        if width <= 0 or height <= 0:
            # Fallback: read one frame to infer geometry.
            ok, frame = cap.read()
            if not ok:
                raise RuntimeError("Could not read any frames from video.")
            height, width = frame.shape[:2]
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

        fps = float(fps) if float(fps) > 0 else 30.0
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        output_video_path.parent.mkdir(parents=True, exist_ok=True)
        writer = cv2.VideoWriter(str(output_video_path), fourcc, fps, (width, height))
        if not writer.isOpened():
            raise RuntimeError(f"Could not create output video: {output_video_path}")

        # Isolate tracking state per request by loading YOLO here.
        yolo_model = YOLO(str(self.config.yolo_weights))

        assigned_names: Dict[int, Tuple[str, float]] = {}  # track_id -> (name, distance)
        track_history: Dict[int, int] = {}  # track_id -> number of frames seen

        def clamp(val: int, lo: int, hi: int) -> int:
            return max(lo, min(hi, val))

        while True:
            success, frame = cap.read()
            if not success:
                break

            h, w = frame.shape[:2]

            # YOLO Tracking (Person class only)
            results = yolo_model.track(
                frame,
                persist=True,
                tracker=self.config.tracker,
                classes=list(self.config.yolo_classes),
                verbose=False,
            )

            for r in results:
                if r.boxes.id is None:
                    continue

                track_ids = r.boxes.id.int().cpu().tolist()
                boxes = r.boxes.xyxy.int().cpu().tolist()

                for box, track_id in zip(boxes, track_ids):
                    x1, y1, x2, y2 = box
                    x1 = clamp(x1, 0, w - 1)
                    y1 = clamp(y1, 0, h - 1)
                    x2 = clamp(x2, 0, w - 1)
                    y2 = clamp(y2, 0, h - 1)

                    track_history[track_id] = track_history.get(track_id, 0) + 1
                    current_count = track_history[track_id]
                    should_reid = (current_count % self.config.check_interval == 0)

                    if should_reid:
                        crop = frame[y1:y2, x1:x2]
                        if crop.size > 0 and crop.shape[0] >= 60 and crop.shape[1] >= 30:
                            crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                            with torch.no_grad():
                                current_feat = self.extractor([crop_rgb])  # (1, D)

                            dist_mat = compute_distance_matrix(
                                current_feat,
                                self.gallery_tensor,
                                metric="cosine",
                            )  # (1, G)
                            min_dist, min_idx = torch.min(dist_mat[0], dim=0)
                            min_dist_val = float(min_dist.item())

                            if min_dist_val < self.config.reid_threshold:
                                name = self.gallery_display_ids[min_idx.item()]
                                assigned_names[track_id] = (name, min_dist_val)
                            else:
                                if (
                                    track_id not in assigned_names
                                    or assigned_names[track_id][0] == "Unknown"
                                ):
                                    assigned_names[track_id] = ("Unknown", min_dist_val)

                    if track_id in assigned_names:
                        display_name, distance = assigned_names[track_id]
                    else:
                        display_name, distance = "Wait...", 0.0

                    color = (
                        (0, 255, 0)
                        if (display_name != "Unknown" and display_name != "Wait...")
                        else (0, 0, 255)
                    )

                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    label = f"ID:{track_id} {display_name}"
                    if display_name != "Wait...":
                        label += f" ({distance:.2f})"
                    cv2.putText(
                        frame,
                        label,
                        (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        color,
                        2,
                    )

            writer.write(frame)

        cap.release()
        writer.release()

        summary = {
            "assigned_tracks": {
                str(track_id): {"name": name, "distance": distance}
                for track_id, (name, distance) in assigned_names.items()
            }
        }
        return summary

