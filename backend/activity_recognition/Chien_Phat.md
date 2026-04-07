# Integration Guide for Phat — Backend API & Event Pipeline

Chien has built the full pipeline and wired it into the backend. This document is everything you need to consume the interaction events and push them to the database.

---

## What the Pipeline Does

When a video is uploaded, the backend:
1. Runs YOLO tracking + ReID to identify named persons in the video
2. Runs your pose/object detection to find held objects
3. Links each held object to the nearest named person
4. Produces a clean list of `start_hold` / `end_hold` events
5. Stores them in memory under `VIDEO_EVENTS[video_id]`

Your job: poll the events endpoint, read the events, insert them into the database.

---

## Step-by-Step: Testing the API

### Prerequisites

- Backend running locally (ask Chien for the `.env` file)
- Model files placed in the correct locations (see `context.md`)
- Python virtual environment activated (`backend/projectb/`)

### 1. Start the backend

```bash
cd backend
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
```

Wait until you see:
```
[ReID] Gallery ready: N feature vectors.
INFO:     Application startup complete.
```

### 2. Open Swagger UI

Go to: `http://localhost:8000/docs`

This is a full interactive API browser — no frontend needed.

### 3. Get an auth token

Call `POST /auth/login` with your account credentials:

```json
{
  "email": "your@email.com",
  "password": "yourpassword"
}
```

Copy the `access_token` from the response.

Click **Authorize** (top-right of Swagger UI) and enter:
```
Bearer <paste_token_here>
```

### 4. Upload a test video

Call `POST /videos/upload` with:
- `name` — any label, e.g. `"test_video"`
- `location` — room name, e.g. `"living_room"`
- `file` — your `.mp4` test video

The response returns immediately with a `record.id` — save this as `<video_id>`. Processing runs in the background.

### 5. Poll for events

Call `GET /videos/{video_id}/events` using the `<video_id>` from above.

Keep polling until `status` changes from `"processing"` to `"ready"`.

---

## Event API Reference

### Upload Video

```
POST /videos/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

name      (str)   display name for the video
location  (str)   room name, e.g. "living_room"
file      (file)  .mp4 video file
```

**Response** (immediate, processing starts in background):
```json
{
  "saved": true,
  "record": {
    "id": "abc123",
    "name": "test_video",
    "video_uri": "processing"
  }
}
```

---

### Get Interaction Events

```
GET /videos/{video_id}/events
Authorization: Bearer <token>
```

**While processing:**
```json
{
  "video_id": "abc123",
  "location": "living_room",
  "status": "processing",
  "events": []
}
```

**When ready:**
```json
{
  "video_id": "abc123",
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

**Status values:**

| Status | Meaning |
|---|---|
| `processing` | Inference is still running — keep polling |
| `ready` | Events are available |
| `error` | Processing failed |
| `not_found` | video_id doesn't exist |

---

## Event Format

Each event object:

| Field | Type | Description |
|---|---|---|
| `type` | string | `"start_hold"` or `"end_hold"` |
| `person_name` | string | Name from ReID gallery (never `"Unknown"`) |
| `object_name` | string | YOLO object class label (e.g. `"cup"`, `"phone"`) |
| `time` | string | ISO-8601 timestamp in UTC+7, offset from video start |
| `location` | string | Room name passed in from the upload form |

**Guarantees:**
- Unknown persons are filtered out — every `person_name` is a gallery name
- For each `(person_name, object_name)` pair: exactly one `start_hold` and one `end_hold`
- Events are sorted chronologically by `time`

---

## Key Files

| File | Owner | Purpose |
|---|---|---|
| `activity_recognition/integration.py` | Chien | Full pipeline — tracking, ReID, scoring, event generation |
| `activity_recognition/Object_detection_indoor.py` | Phat | Pose + object detection helpers |
| `services/reid_service.py` | Chien | ReID config and gallery loading |
| `api/app.py` | Chien | FastAPI routes — upload, background processing, events endpoint |

---

## Tuning Parameters (if results are off)

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
| `reid_threshold` | `0.25` | Lower = stricter matching, fewer false names |
| `check_interval` | `10` | Frames between ReID checks for unidentified tracks |

---

## Notes

- Do **not** write to `VIDEO_EVENTS` directly — it is Chien's internal store.
- Do **not** modify `api/app.py`, `reid_service.py`, or `integration.py` without checking with Chien.
- The annotated output video is uploaded to Supabase storage automatically — you do not need to handle it.
- If the backend crashes on startup, the most common cause is missing model files. Check `context.md`.
