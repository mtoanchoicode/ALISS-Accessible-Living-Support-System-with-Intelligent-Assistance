# Activity Recognition APIs

Pipeline: **ReID** (person identification) + **Pose detection** (wrist keypoints) + **Object detection** → output interaction events (who held what, when, where).

---

## Endpoints

### POST `/videos/activity`
Upload 2 videos để xử lý. Trả về events và URL để xem/download video đã annotate.

**Request** — `multipart/form-data`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `file_1` | file (video) | required | Video phòng 1 |
| `location_1` | string | `Living room` | Tên phòng 1 |
| `file_2` | file (video) | required | Video phòng 2 |
| `location_2` | string | `Bed room` | Tên phòng 2 |

**Response 200**
```json
{
  "run_id": "a1b2c3d4",
  "events": [
    {
      "type": "start_hold",
      "person_name": "Phat",
      "object_name": "laptop",
      "time": "2026-04-11T00:34:42.219674+07:00",
      "location": "Living room"
    },
    {
      "type": "end_hold",
      "person_name": "Phat",
      "object_name": "laptop",
      "time": "2026-04-11T00:34:46.786341+07:00",
      "location": "Living room"
    }
  ],
  "video_1_url": "http://localhost:8000/videos/activity/a1b2c3d4/video/1",
  "video_2_url": "http://localhost:8000/videos/activity/a1b2c3d4/video/2"
}
```

**Response 500**
```json
{ "error": "Activity processing failed: <message>" }
```

**Lưu ý:**
- Video input được lưu vào thư mục temp và xóa sau khi xử lý xong
- Video output (annotated) được giữ trong RAM server cho đến khi download
- Mỗi lần gọi POST tạo ra 1 `run_id` độc lập

---

### GET `/videos/activity/{run_id}`
Lấy lại kết quả của 1 lần xử lý theo `run_id`.

**Path params**

| Param | Type | Description |
|-------|------|-------------|
| `run_id` | string | ID trả về từ POST |

**Response 200**
```json
{
  "events": [...],
  "video_1_url": "http://localhost:8000/videos/activity/a1b2c3d4/video/1",
  "video_2_url": "http://localhost:8000/videos/activity/a1b2c3d4/video/2"
}
```

**Response 404**
```json
{ "error": "run_id not found" }
```

---

### GET `/videos/activity/{run_id}/video/{n}`
Download hoặc stream video đã annotate.

**Path params**

| Param | Type | Description |
|-------|------|-------------|
| `run_id` | string | ID trả về từ POST |
| `n` | int | `1` = video phòng 1, `2` = video phòng 2 |

**Response 200** — file `video/mp4` (stream trực tiếp, có thể dùng trong `<video src="...">` hoặc download)

**Response 404**
```json
{ "error": "run_id not found" }
{ "error": "Video not found" }
```

---

## Event object

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `type` | string | `start_hold` / `end_hold` | Bắt đầu / kết thúc cầm đồ vật |
| `person_name` | string | tên trong gallery | Người được nhận diện |
| `object_name` | string | `laptop`, `bag`, `phone`, `cup`, ... | Đồ vật |
| `time` | string (ISO-8601) | — | Thời điểm xảy ra (UTC+7) |
| `location` | string | — | Tên phòng truyền vào |

---

## Pipeline logic

```
Video frame
  │
  ├── YOLO tracking (bytetrack) ──→ track_id → person bbox
  ├── ReID (osnet_ain_x1_0)     ──→ track_id → person name
  ├── YOLO pose                 ──→ wrist keypoints
  └── YOLO object detection     ──→ object bboxes
            │
            ▼
  Wrist-object scoring (proximity + overlap + motion)
            │
            ▼
  Link held object → nearest named person (IoU/proximity)
            │
            ▼
  Filter: Unknown person bị loại
  Filter: interaction < 1 giây bị loại
  Dedup: giữ start đầu tiên + end cuối cùng mỗi cặp (person, object)
```

**Các tham số quan trọng** (trong `integration.py`):

| Param | Value | Mô tả |
|-------|-------|-------|
| `reid_threshold` | `0.25` | Cosine distance để nhận diện người. Thấp = chặt hơn |
| `HOLD_SCORE_THRESHOLD` | `0.3` | Score tối thiểu để coi là đang cầm vật |
| `PERSON_PROXIMITY_PX` | `50px` | Khoảng cách tối đa object → person bbox |
| `INFERENCE_EVERY_N` | `3` | Chạy pose+object mỗi 3 frame (tối ưu tốc độ) |
| `NON_HANDHELD` | `chair, tv, dining table, bed, refrigerator` | Đồ vật lớn, chỉ track nếu đang di chuyển cùng tay |

**Label normalization:**

| Raw label | Normalized |
|-----------|------------|
| `handbag`, `backpack`, `suitcase` | `bag` |
| `cell phone`, `mobile phone` | `phone` |
| `wine glass` | `cup` |

---

## Test page

File `test_activity.html` (không được commit — có trong `.gitignore`):
- Mở trực tiếp trên browser
- Upload 2 video, nhập location
- Sau khi xử lý: hiển thị bảng events + 2 video player + nút download
- Yêu cầu backend đang chạy tại `http://localhost:8000`
