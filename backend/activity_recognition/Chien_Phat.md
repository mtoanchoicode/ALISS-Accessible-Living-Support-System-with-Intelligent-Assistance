# Local Testing Guide — Chien & Phat Integration

This document explains how to run the human tracking + activity recognition pipeline locally without the frontend or API.

---

## Prerequisites

- Python virtual environment activated (`backend/projectb/` or your local venv)
- Model files placed in the correct locations (see `context.md`)
- Gallery images set up under `backend/gallery/` (already included for Trung and Phat)

---

## Required Dependencies

```bash
pip install ultralytics torchreid opencv-python torch
```

---

## Model Files to Place Manually

Before running, ensure these files exist:

```
backend/
    yolov8n.pt
    activity_recognition/
        YOLO26_pose.pt
        YOLO26_object.pt
```

`osnet_ain_x1_0_imagenet.pth` will be **auto-downloaded** into `backend/.torchreid/` on first run.

---

## Running the Test Script

Run from the `backend/` directory:

```bash
cd backend
```

### Test ReID tracking only (no pose/object models needed)

```bash
python test_pipeline.py --video path/to/your_video.mp4 --reid-only
```

### Test full pipeline (ReID + pose + object detection)

```bash
python test_pipeline.py --video path/to/your_video.mp4 --location "Living Room"
```

### Options

| Flag | Description | Default |
|---|---|---|
| `--video` | Path to input `.mp4` video (required) | — |
| `--location` | Room label attached to events | `"Test Room"` |
| `--reid-only` | Skip pose/object models, test tracking only | off |
| `--out` | Output annotated video path | `output_annotated.mp4` |

---

## Output

After running, you get:

1. **`output_annotated.mp4`** — video with bounding boxes drawn:
   - Green box + name label for identified persons
   - Orange box + object label for objects being held (detected via wrist-object scoring)

2. **`output_annotated.json`** — list of interaction events:

```json
[
  {
    "type": "start_hold",
    "person_name": "Trung",
    "object_name": "cup",
    "time": "2026-04-07T10:23:45+07:00",
    "location": "Living Room"
  },
  {
    "type": "end_hold",
    "person_name": "Trung",
    "object_name": "cup",
    "time": "2026-04-07T10:24:12+07:00",
    "location": "Living Room"
  }
]
```

3. **Console output** — summary of all events printed to terminal.

---

## Event Format

| Field | Description |
|---|---|
| `type` | `"start_hold"` — person picks up object / `"end_hold"` — person puts it down |
| `person_name` | Name from gallery (never `"Unknown"` — unknowns are filtered out) |
| `object_name` | YOLO object class label (e.g. `"cup"`, `"phone"`, `"bottle"`) |
| `time` | ISO-8601 timestamp in UTC+7, offset from video start time |
| `location` | Room name passed via `--location` flag |

**Guarantees:**
- For each `(person, object)` pair: only the **first** pickup and **last** put-down are recorded
- Events are sorted chronologically

---

## Tuning Parameters

In `activity_recognition/integration.py`:

| Parameter | Default | Effect |
|---|---|---|
| `HOLD_SCORE_THRESHOLD` | `0.3` | Lower = more objects counted as held |
| `PERSON_PROXIMITY_PX` | `50.0` | Higher = objects further away still linked to a person |
| `INFERENCE_EVERY_N` | `3` | Lower = more accurate but slower |
| `UNKNOWN_RECHECK_INTERVAL` | `50` | Frames between ReID retries for unknowns |

In `services/reid_service.py`:

| Parameter | Default | Effect |
|---|---|---|
| `reid_threshold` | `0.25` | Lower = stricter matching, fewer false name assignments |
| `check_interval` | `10` | Frames between ReID checks for unidentified tracks |

---

## Key Files

| File | Owner | Purpose |
|---|---|---|
| `activity_recognition/integration.py` | Chien | Full pipeline — tracking, ReID, scoring, event generation |
| `activity_recognition/Object_detection_indoor.py` | Phat | Pose + object detection helpers |
| `services/reid_service.py` | Chien | ReID config and gallery loading |
| `test_pipeline.py` | Chien | Standalone test script (no API needed) |
