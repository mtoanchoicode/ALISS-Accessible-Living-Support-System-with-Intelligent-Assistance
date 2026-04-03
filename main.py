import cv2
import torch
import os
from pathlib import Path
from ultralytics import YOLO
from torchreid.utils import FeatureExtractor
from torchreid.metrics import compute_distance_matrix

# Resolve all paths relative to this repo (so it works from any working directory).
BASE_DIR = Path(__file__).resolve().parent

# Tell PyTorch/TorchReID where to cache/download ReID weights.
os.environ["TORCH_HOME"] = str(BASE_DIR / "models")

# ==========================================
# 1. CẤU HÌNH HỆ THỐNG
# ==========================================
GALLERY_DIR = BASE_DIR / "gallery"
VIDEO_PATH = BASE_DIR / "video-test" / "video3.mp4"
REID_THRESHOLD = 0.4
CHECK_INTERVAL = 10  # Cứ đúng 10 frames sẽ chạy kiểm tra ReID một lần

if not VIDEO_PATH.exists():
    raise FileNotFoundError(f"Video not found: {VIDEO_PATH}")

# ==========================================
# 2. KHỞI TẠO MODEL VÀ GALLERY
# ==========================================
print("--- Đang khởi tạo hệ thống ---")
extractor = FeatureExtractor(
    model_name='osnet_ain_x1_0',
    device='cuda' if torch.cuda.is_available() else 'cpu'
)

YOLO_WEIGHTS_PATH = BASE_DIR / "yolo11n.pt"
if not YOLO_WEIGHTS_PATH.exists():
    raise FileNotFoundError(f"YOLO weights not found: {YOLO_WEIGHTS_PATH}")

yolo_model = YOLO(str(YOLO_WEIGHTS_PATH))

gallery_features = [] 
gallery_ids = []

if not GALLERY_DIR.exists():
    raise FileNotFoundError(f"Gallery folder not found: {GALLERY_DIR}")

# Build gallery mapping dynamically from subfolders in `gallery/`.
# Folder name is used as the person id, unless we know a nicer display name.
# (e.g., `gallery/person1` -> `Person_1`).
PERSON_ID_MAP = {
    "person1": "Person_1",
    "person2": "Person_2",
}
for person_dir in sorted(GALLERY_DIR.iterdir()):
    if not person_dir.is_dir():
        continue
    person_id = PERSON_ID_MAP.get(person_dir.name, person_dir.name)
    folder_path = person_dir

    image_names = [
        f for f in os.listdir(str(folder_path))
        if f.endswith((".jpg", ".png", ".jpeg"))
    ]
    full_paths = [os.path.join(str(folder_path), img) for img in image_names]
    
    if full_paths:
        features = extractor(full_paths) 
        for i in range(features.size(0)):
            gallery_features.append(features[i].unsqueeze(0))
            gallery_ids.append(person_id)

if not gallery_features:
    raise ValueError("Gallery trống! Vui lòng kiểm tra lại đường dẫn.")
    
all_gallery_tensor = torch.cat(gallery_features)
print(f"Hoàn tất! Đã tải {len(gallery_features)} ảnh mẫu vào bộ nhớ.")

# ==========================================
# 3. QUẢN LÝ TRẠNG THÁI (SMART CACHE)
# ==========================================
assigned_names = {}  # {track_id: (tên_người, khoảng_cách)}
track_history = {}   # {track_id: số_frame_đã_xuất_hiện}

# ==========================================
# 4. XỬ LÝ VIDEO TRỰC TIẾP
# ==========================================
cap = cv2.VideoCapture(VIDEO_PATH)

print("--- Bắt đầu xử lý Video ---")
while cap.isOpened():
    success, frame = cap.read()
    if not success: break

    # YOLO Tracking (Chỉ bắt class 0 - Person)
    results = yolo_model.track(frame, persist=True, tracker="bytetrack.yaml", classes=[0], verbose=False)
    
    for r in results:
        if r.boxes.id is not None:
            track_ids = r.boxes.id.int().cpu().tolist()
            boxes = r.boxes.xyxy.int().cpu().tolist()

            for box, track_id in zip(boxes, track_ids):
                x1, y1, x2, y2 = box
                
                # Tăng bộ đếm frame cho track_id hiện tại
                track_history[track_id] = track_history.get(track_id, 0) + 1
                current_count = track_history[track_id]

                # --- LOGIC QUYẾT ĐỊNH CÓ CHẠY RE-ID HAY KHÔNG ---
                # Cứ số frame xuất hiện chia hết cho 10 (10, 20, 30,...) là chạy
                should_reid = (current_count % CHECK_INTERVAL == 0)

                # --- THỰC THI RE-ID ---
                if should_reid:
                    crop = frame[y1:y2, x1:x2]
                    
                    # Bỏ qua nếu ảnh quá nhỏ, dễ gây nhiễu
                    if crop.size > 0 and crop.shape[0] >= 60 and crop.shape[1] >= 30:
                        crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                        with torch.no_grad():
                            current_feat = extractor([crop_rgb])

                        dist_mat = compute_distance_matrix(current_feat, all_gallery_tensor, metric='cosine')
                        min_dist, min_idx = torch.min(dist_mat[0], dim=0)
                        min_dist_val = min_dist.item()

                        # --- CẬP NHẬT THÔNG MINH (SMART UPDATE) ---
                        if min_dist_val < REID_THRESHOLD:
                            # Tình huống 1: Nhận diện thành công -> Luôn ghi đè cập nhật mới
                            name = gallery_ids[min_idx.item()]
                            assigned_names[track_id] = (name, min_dist_val)
                            print(f"ReID Update: ID {track_id} -> {name} ({min_dist_val:.2f}) tại frame {current_count}")
                        else:
                            # Tình huống 2: Độ lệch cao (Unknown). 
                            # Chỉ gán là Unknown nếu trước đó người này chưa từng được nhận diện thành công.
                            if track_id not in assigned_names or assigned_names[track_id][0] == "Unknown":
                                assigned_names[track_id] = ("Unknown", min_dist_val)
                                print(f"ReID Check: ID {track_id} vẫn đang Unknown ({min_dist_val:.2f}) tại frame {current_count}")

                # --- HIỂN THỊ KẾT QUẢ ---
                if track_id in assigned_names:
                    display_name, distance = assigned_names[track_id]
                else:
                    display_name, distance = "Wait...", 0.0

                # Tô màu: Xanh lá nếu nhận diện được, Đỏ nếu Unknown hoặc đang Wait
                color = (0, 255, 0) if (display_name != "Unknown" and display_name != "Wait...") else (0, 0, 255)
                
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                label = f"ID:{track_id} {display_name}"
                if display_name != "Wait...": 
                    label += f" ({distance:.2f})"
                    
                cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    cv2.imshow("Continuous ReID (Every 10 frames)", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): 
        break

cap.release()
cv2.destroyAllWindows()