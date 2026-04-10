import argparse
import os
import json
import sys
from pathlib import Path

from services.reid_service import ReIDConfig, PersonReIDRunner
from activity_recognition.integration import IntegratedVideoProcessor

BASE_DIR = Path(__file__).resolve().parent



def videos_process(video_path_1: Path, location_1: str, video_path_2: Path, location_2: str, out_dir: Path):
    print("\n=== Full integrated pipeline test (ReID + pose + object detection) ===")


    pose_model = BASE_DIR / "activity_recognition" / "YOLO26_pose.pt"
    object_model = BASE_DIR / "activity_recognition" / "YOLO26_object.pt"
    out_dir.mkdir(parents=True, exist_ok=True)

    if not pose_model.exists():
        print(f"ERROR: Pose model not found at {pose_model}")
        print("Place YOLO26_pose.pt in backend/activity_recognition/ and retry.")
        sys.exit(1)

    if not object_model.exists():
        print(f"ERROR: Object model not found at {object_model}")
        print("Place YOLO26_object.pt in backend/activity_recognition/ and retry.")
        sys.exit(1)

    config = ReIDConfig(
        repo_root=BASE_DIR,
        yolo_weights=BASE_DIR / "yolov8n.pt",
        gallery_dir=BASE_DIR / "gallery",
        torch_home=BASE_DIR / ".torchreid",
    )

    print(f"Gallery persons: {[d.name for d in sorted(config.gallery_dir.iterdir()) if d.is_dir()]}")

    reid_runner = PersonReIDRunner(config)
    processor = IntegratedVideoProcessor(
        reid_runner=reid_runner,
        pose_model_path=str(pose_model),
        object_model_path=str(object_model),
    )


    all_events = []

    print(f"\nProcessing video 1: {video_path_1} with location '{location_1}'")
    out_path = out_dir / f"{video_path_1.stem}_annotated.mp4"
    events_1 = processor.process_video(video_path_1, out_path, location_1)

    all_events.extend(events_1)

    print(f"\n--- Extracted {len(events_1)} interaction events from video 1 ---")
    for ev in events_1:
        print(f"  [{ev['time']}] {ev['type']:12s}  person={ev['person_name']}  object={ev['object_name']}  location={ev['location']}")


    print(f"\nProcessing video 2: {video_path_2} with location '{location_2}'")
    out_path = out_dir / f"{video_path_2.stem}_annotated.mp4"
    events_2 = processor.process_video(video_path_2, out_path, location_2)

    all_events.extend(events_2)
    
    print(f"\n--- Extracted {len(events_2)} interaction events from video 2---")
    for ev in events_2:
        print(f"  [{ev['time']}] {ev['type']:12s}  person={ev['person_name']}  object={ev['object_name']}  location={ev['location']}")

    events_json = out_dir / "combined_events.json"
    with open(events_json, "w") as f:
        json.dump(all_events, f, indent=2)
    print(f"\nEvents saved to: {events_json}")


    return all_events


if __name__ == "__main__":
    videos_1 = BASE_DIR / "input" / "location_living_room.mp4"
    videos_2 = BASE_DIR / "input" / "location_bedroom.mp4"
    location_1 = "Living room"
    location_2 = "Bed room"
    out_dir = Path("activity_recognition/output")

    if not videos_1.exists():
        print(f"ERROR: Video not found: {videos_1}")
        sys.exit(1)

    if not videos_2.exists():
        print(f"ERROR: Video not found: {videos_2}")
        sys.exit(1)

    videos_process(videos_1, location_1, videos_2, location_2, out_dir)

