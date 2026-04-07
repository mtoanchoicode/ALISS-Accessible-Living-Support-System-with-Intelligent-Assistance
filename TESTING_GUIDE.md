# Testing Guide — Video Upload & Interaction Event Pipeline

This guide covers how to test the integrated ReID + pose/object detection pipeline
end-to-end, from starting the servers to reading back the extracted events.

---

## Prerequisites

- Backend running with all models loaded (see startup checklist below)
- Frontend running at `http://localhost:3000`
- A test video file (MP4) where at least one person picks up an object
- Gallery images for the person(s) in the video placed under `backend/gallery/<name>/`

---

## 1. Start the Servers

**Terminal 1 — Backend**
```bash
cd backend
# activate your virtual environment first
uvicorn api.app:app --reload --host 0.0.0.0 --port 8000
```

Watch the startup logs. You should see:
```
[ReID] Loading feature extractor (osnet_ain_x1_0) on cpu ...
[ReID] Building gallery features ...
[ReID] Gallery ready: N feature vectors.
```
If you see `Warning: Failed to initialize PersonReIDRunner` or
`Warning: Failed to initialize IntegratedVideoProcessor`, the models did not load.
Fix those before continuing.

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Frontend will be at `http://localhost:3000`.

---

## 2. Verify the Backend is Healthy

Open your browser or run:
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{ "status": "ok", "model": "gpt-4o-mini" }
```

Also confirm the interactive API docs load at:
```
http://localhost:8000/docs
```

---

## 3. Test the Upload via the Frontend (UI Test)

- Go to `http://localhost:3000` and log in
- Navigate to the **Storage** tab
- Switch to the **Videos** sub-tab
- Tap the **+** button (bottom-right)
- The Upload Video modal opens — check that it has three fields:
  - File picker (drag-and-drop or tap)
  - **Video Title** — should auto-fill when you pick a file
  - **Room** — optional, e.g. `living room`
- Select a test MP4 file
- Optionally type a room name
- Tap **Upload Video**
- The modal closes and the video card appears in the list with a spinning loader
  (this means `video_uri = "processing"` — inference is running in the background)

---

## 4. Test the Upload via curl (API Test)

Get a valid Bearer token first (login via the frontend or `/auth/login`), then:

```bash
curl -X POST http://localhost:8000/videos/upload \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -F "name=Test Video" \
  -F "location=living room" \
  -F "file=@/path/to/your/test_video.mp4"
```

Expected response (immediate, before processing finishes):
```json
{
  "saved": true,
  "record": [
    {
      "id": "some-uuid-here",
      "name": "Test Video",
      "video_uri": "processing",
      ...
    }
  ]
}
```

Copy the `id` value — this is your `video_id` for the next step.

To test that `location` is truly optional:
```bash
curl -X POST http://localhost:8000/videos/upload \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -F "name=No Location Test" \
  -F "file=@/path/to/your/test_video.mp4"
```
This should also succeed with `location` defaulting to `""`.

---

## 5. Poll for the Interaction Events

Processing runs in the background. Poll the events endpoint until `status` is `ready`:

```bash
curl http://localhost:8000/videos/<video_id>/events \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

**While processing:**
```json
{
  "video_id": "some-uuid-here",
  "location": "living room",
  "status": "processing",
  "events": []
}
```

**When complete:**
```json
{
  "video_id": "some-uuid-here",
  "location": "living room",
  "status": "ready",
  "events": [
    {
      "type": "start_hold",
      "person_name": "person1",
      "object_name": "cell phone",
      "time": "2026-04-07T10:23:45+07:00",
      "location": "living room"
    },
    {
      "type": "end_hold",
      "person_name": "person1",
      "object_name": "cell phone",
      "time": "2026-04-07T10:24:12+07:00",
      "location": "living room"
    }
  ]
}
```

**If something went wrong during processing:**
```json
{
  "video_id": "some-uuid-here",
  "location": "living room",
  "status": "error",
  "events": []
}
```
Check the backend terminal logs for the traceback.

---

## 6. What to Verify in the Events

- `person_name` should match the folder name under `backend/gallery/` (e.g. `person1`,
  `person2`) — or `"Unknown"` if the person was not in the gallery or score was too low
- `object_name` matches YOLO object class labels (e.g. `"cell phone"`, `"cup"`, `"book"`)
- Each `start_hold` must have a corresponding `end_hold` for the same
  `(person_name, object_name)` pair
- `time` is an ISO-8601 string offset from the video start time (UTC+7)
- `location` matches exactly what you sent in the upload form

---

## 7. Check the Backend Terminal Logs

While the video processes, the backend terminal prints:
```
[Background Worker] Processing video ID: <id> via Integrated Processor
[Background Worker] Extracted N events for video ID <id>.
[Background Worker] Uploading Video ID <id> to Storage...
[Background Worker] Completed Video ID <id>.
```

If `IntegratedVideoProcessor` failed to initialise, the log will say
`Falling back to ReID-only` and events will be an empty list.

---

## 8. Troubleshooting

**`status: "error"` on the events endpoint**
- Check the backend terminal for the Python traceback
- Common causes: model file not found, video codec issue, CUDA out of memory

**`person_name` is always `"Unknown"`**
- Gallery images may not match the person in the video well enough
- Try adding more gallery images (5–10 varied shots per person work best)
- Lower `reid_threshold` in `reid_service.py` (default is `0.4`; try `0.5`)

**`events` is empty even after `status: "ready"`**
- The video may not contain a clear hand–object interaction
- Check that the object is in the YOLO object model's class list
- Lower `HOLD_SCORE_THRESHOLD` in `integration.py` (default `0.3`; try `0.2`)

**Upload fails immediately (not background)**
- Make sure `name` field is not empty in the form or curl command
- Confirm the file is a valid video (MP4 preferred)
- Check that the Bearer token is valid and not expired

**`404` on `/videos/<id>/events`**
- The server was restarted after upload — `VIDEO_EVENTS` is in-memory and resets
- Re-upload the video after the server is stable

---

## 9. Gallery Setup Reminder

The gallery determines who gets named in events. Each person needs a subfolder:
```
backend/gallery/
  person1/     ← folder name becomes the person_name in events
    1.jpg
    2.jpg
    ...
  person2/
    1.jpg
    ...
```
Photos should show the full body or upper body clearly, from the same camera angle
as the test video if possible.
