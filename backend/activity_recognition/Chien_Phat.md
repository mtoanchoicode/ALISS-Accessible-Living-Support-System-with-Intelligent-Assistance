# Update Module — Integration Design (Chien & Phat)

## Overview

This document describes the integrated pipeline that combines Chien's ReID tracking
with Phat's pose/object detection to produce named hold/release interaction events.

---

## Files

- `activity_recognition/integration.py` — unified pipeline class (Chien)
- `activity_recognition/Object_detection_indoor.py` — pose/object detection helpers (Phat)
- `api/app.py` — FastAPI backend wiring (Chien)

---

## Pipeline Architecture

```
Video Frame
  │
  ├── YOLO bytetrack ──────────────── track_id → person bounding box
  │        └── ReID (every 10 frames) → track_id → person name
  │
  ├── YOLO pose (every 3 frames) ──── wrist keypoints per pose person
  │
  ├── YOLO object (every 3 frames) ── object bounding boxes + labels
  │
  ├── Wrist-object scoring ────────── held objects with bounding boxes
  │   (Phat's dynamic_hand_object_score logic)
  │
  └── IoU / proximity check ─────────link each held object to named person
              → update active_objects[(person_name, object_name)]
```

### Person-Object Linking

- For each object confirmed as held (score > 0.3), compute IoU between the object
  bounding box and every tracked person bounding box.
- The person with the highest IoU is assigned as the holder.
- If no IoU intersection exists but the object center is within 50 px of a person
  box, that person is still assigned (covers edge-of-frame cases).
- Multiple people holding different objects are tracked simultaneously via the
  `(person_name, object_name)` key in `active_objects`.

---

## Event Format

Each event in the output list has the following fields:

```json
{
  "type": "start_hold",
  "person_name": "Alice",
  "object_name": "phone",
  "time": "2026-04-07T10:23:45+07:00",
  "location": "living_room"
}
```

- `type` — `"start_hold"` when the interaction begins, `"end_hold"` when it ends
- `person_name` — resolved from the ReID gallery; `"Unknown"` if not matched
- `object_name` — YOLO object detection class label
- `time` — ISO-8601 timestamp in UTC+7, offset from video start time
- `location` — room name passed in from the upload form

---

## API Usage

### Upload a Video

```
POST /videos/upload
Content-Type: multipart/form-data

Fields:
  name      (str)  video display name
  location  (str)  room name, e.g. "living_room"
  file      (file) video file
```

Response (immediate):
```json
{ "saved": true, "record": { "id": "<video_id>", ... } }
```

Processing runs in the background. Poll the events endpoint to check status.

---

### Retrieve Interaction Events

```
GET /videos/{video_id}/events
Authorization: Bearer <token>
```

Response while processing:
```json
{
  "video_id": "<video_id>",
  "location": "living_room",
  "status": "processing",
  "events": []
}
```

Response when ready:
```json
{
  "video_id": "<video_id>",
  "location": "living_room",
  "status": "ready",
  "events": [
    {
      "type": "start_hold",
      "person_name": "Alice",
      "object_name": "phone",
      "time": "2026-04-07T10:23:45+07:00",
      "location": "living_room"
    },
    {
      "type": "end_hold",
      "person_name": "Alice",
      "object_name": "phone",
      "time": "2026-04-07T10:24:12+07:00",
      "location": "living_room"
    }
  ]
}
```

Possible `status` values: `processing` · `ready` · `error` · `not_found`

---

## Key Tuning Parameters (integration.py)

- `INFERENCE_EVERY_N = 3` — run pose and object models every N frames
- `HOLD_SCORE_THRESHOLD = 0.3` — minimum wrist-object score to count as held
- `PERSON_PROXIMITY_PX = 50.0` — fallback proximity threshold for person-object linking
- `reid_config.check_interval = 10` — run ReID every 10 frames per track
- `reid_config.reid_threshold = 0.4` — cosine distance threshold for name assignment

---

## Notes for Phat

- The `events` list is stored in `VIDEO_EVENTS[video_id]` in app memory.
- Poll `GET /videos/{video_id}/events` and check `status == "ready"` before reading.
- Events are ordered chronologically as they occur in the video.
- Each start_hold is always followed by a corresponding end_hold for the same
  `(person_name, object_name)` pair.
- Do not write to `VIDEO_EVENTS` directly — consume the events and insert to DB,
  then you are done.
