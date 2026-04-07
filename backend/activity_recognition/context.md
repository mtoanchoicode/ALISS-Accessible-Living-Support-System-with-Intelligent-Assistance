# Project Context: Accessible Living Support System with Intelligent Assistance (ALISS)

## Core Objective

An AI-driven system that helps elderly individuals locate misplaced objects in their homes by tracking who picked up what, when, and where.

---

## System Modules & Ownership

| Module | Owners | Function |
|---|---|---|
| Context Builder | Dan & Toan | Captures initial home images to build the baseline knowledge graph. One-time setup. **Do not modify.** |
| Update Module | Chien & Phat | Monitors the home via camera, detects who holds which object, and records interaction events. |
| Web Backend | Chien | FastAPI server — **handled separately, do not touch.** |

---

## Update Module — What Has Been Built

The integrated pipeline (`activity_recognition/integration.py`) runs in a single frame loop:

1. **YOLO bytetrack** — detects and tracks persons across frames, assigns `track_id`
2. **ReID (torchreid osnet_ain_x1_0)** — matches each `track_id` to a person name from the gallery
   - Name is locked once identified — no switching for the same track
   - Unknown persons are retried every 50 frames
   - Cosine distance threshold: `0.25` (strict — non-gallery people stay Unknown)
3. **YOLO pose model** — detects wrist keypoints per person (every 3 frames)
4. **YOLO object model** — detects object bounding boxes (every 3 frames)
5. **Wrist-object scoring** (Phat's logic) — determines which objects are held based on wrist proximity and motion
6. **Person-object linking** — links each held object to the nearest named person via IoU/proximity

**Output:** A deduplicated list of interaction events — only the first `start_hold` and last `end_hold` per `(person, object)` pair. Unknown persons are excluded.

---

## Gallery Setup (Required for ReID)

The gallery lives at `backend/gallery/`. Each subdirectory is a person:

```
backend/gallery/
    Trung/
        1.png
        2.png
        ...
    Phat/
        1.png
        2.png
        ...
```

- The folder name becomes the `person_name` in events.
- Add at least 3–5 clear photos per person for best accuracy.
- Photos should be cropped to the person (chest-up or full body).

---

## Model Files (Not in Git — Must Be Placed Manually)

| File | Location |
|---|---|
| `YOLO26_pose.pt` | `backend/activity_recognition/` |
| `YOLO26_object.pt` | `backend/activity_recognition/` |
| `yolov8n.pt` | `backend/` |
| `osnet_ain_x1_0_imagenet.pth` | Auto-downloaded to `backend/.torchreid/` on first run |

---

## How to Run the Pipeline Locally

See `Chien_Phat.md` for the full local testing guide.
