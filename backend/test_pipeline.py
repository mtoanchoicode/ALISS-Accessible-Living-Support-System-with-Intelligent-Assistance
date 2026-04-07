"""
Standalone test for human tracking + activity recognition pipeline.
Run from the backend/ directory:

    python test_pipeline.py --video path/to/test.mp4 --location "Living Room"

Options:
    --video      Path to input video (required)
    --location   Room name label for events (default: "Test Room")
    --reid-only  Skip object/pose detection, test ReID tracking only
    --out        Output annotated video path (default: output_annotated.mp4)
"""

import argparse
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def test_reid_only(video_path: Path, out_path: Path):
    print("\n=== ReID-only tracking test ===")
    from services.reid_service import ReIDConfig, PersonReIDRunner

    config = ReIDConfig(
        repo_root=BASE_DIR,
        yolo_weights=BASE_DIR / "yolov8n.pt",
        gallery_dir=BASE_DIR / "gallery",
        torch_home=BASE_DIR / ".torchreid",
    )

    print(f"Gallery persons: {[d.name for d in sorted(config.gallery_dir.iterdir()) if d.is_dir()]}")

    runner = PersonReIDRunner(config)
    summary = runner.process_video(video_path, out_path)

    print("\n--- Tracking summary ---")
    for track_id, info in summary["assigned_tracks"].items():
        print(f"  Track {track_id}: {info['name']}  (dist={info['distance']:.3f})")

    print(f"\nAnnotated video saved to: {out_path}")
    return summary


def test_integrated(video_path: Path, out_path: Path, location: str):
    print("\n=== Full integrated pipeline test (ReID + pose + object detection) ===")

    pose_model = BASE_DIR / "activity_recognition" / "YOLO26_pose.pt"
    object_model = BASE_DIR / "activity_recognition" / "YOLO26_object.pt"

    if not pose_model.exists():
        print(f"ERROR: Pose model not found at {pose_model}")
        print("Place YOLO26_pose.pt in backend/activity_recognition/ and retry.")
        sys.exit(1)

    if not object_model.exists():
        print(f"ERROR: Object model not found at {object_model}")
        print("Place YOLO26_object.pt in backend/activity_recognition/ and retry.")
        sys.exit(1)

    from services.reid_service import ReIDConfig, PersonReIDRunner
    from activity_recognition.integration import IntegratedVideoProcessor

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

    events = processor.process_video(video_path, out_path, location)

    print(f"\n--- Extracted {len(events)} interaction events ---")
    for ev in events:
        print(f"  [{ev['time']}] {ev['type']:12s}  person={ev['person_name']}  object={ev['object_name']}  location={ev['location']}")

    events_json = out_path.with_suffix(".json")
    with open(events_json, "w") as f:
        json.dump(events, f, indent=2)
    print(f"\nEvents saved to: {events_json}")
    print(f"Annotated video saved to: {out_path}")
    return events


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test human tracking & activity recognition pipeline")
    parser.add_argument("--video", required=True, help="Path to input video file")
    parser.add_argument("--location", default="Test Room", help="Room label for events")
    parser.add_argument("--reid-only", action="store_true", help="Test ReID tracking only (no pose/object models needed)")
    parser.add_argument("--out", default="output_annotated.mp4", help="Output annotated video path")
    args = parser.parse_args()

    video_path = Path(args.video)
    out_path = Path(args.out)

    if not video_path.exists():
        print(f"ERROR: Video not found: {video_path}")
        sys.exit(1)

    if not (BASE_DIR / "yolov8n.pt").exists():
        print("ERROR: yolov8n.pt not found in backend/")
        sys.exit(1)

    if args.reid_only:
        test_reid_only(video_path, out_path)
    else:
        test_integrated(video_path, out_path, args.location)
