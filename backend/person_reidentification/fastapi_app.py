from __future__ import annotations

import asyncio
import json
import shutil
import uuid
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .model_runner import PersonReIDRunner, ReIDConfig


REPO_ROOT = Path(__file__).resolve().parents[2]


def build_runner() -> PersonReIDRunner:
    person_id_map = {"person1": "Person_1", "person2": "Person_2"}

    config = ReIDConfig(
        repo_root=REPO_ROOT,
        yolo_weights=REPO_ROOT / "yolo11n.pt",
        gallery_dir=REPO_ROOT / "gallery",
        torch_home=REPO_ROOT / "models",
        person_id_map=person_id_map,
        # Tune if needed
        reid_threshold=0.4,
        check_interval=10,
        tracker="bytetrack.yaml",
    )
    return PersonReIDRunner(config)


app = FastAPI(title="ALISS Person ReID API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    # Load models once when server starts.
    app.state.runner = build_runner()
    app.state.lock = asyncio.Lock()
    app.state.jobs_dir = REPO_ROOT / "backend" / "person_reidentification" / ".jobs"
    app.state.jobs_dir.mkdir(parents=True, exist_ok=True)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


async def _read_upload_to_file(upload: UploadFile, dest_path: Path) -> None:
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with dest_path.open("wb") as f:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)


def _cleanup_job(job_dir: Path) -> None:
    shutil.rmtree(job_dir, ignore_errors=True)


@app.post("/process-video")
async def process_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload a video and get a `job_id`.

    Then download:
      - `GET /results/{job_id}/video`
      - `GET /results/{job_id}/meta`
    """

    job_id = uuid.uuid4().hex
    job_dir = app.state.jobs_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename).suffix if file.filename else ".mp4"
    input_path = job_dir / f"input{suffix}"
    output_path = job_dir / "output.mp4"
    meta_path = job_dir / "meta.json"

    # Save upload
    await _read_upload_to_file(file, input_path)

    # Process (single-job at a time to avoid GPU contention)
    async with app.state.lock:
        summary = await asyncio.to_thread(
            app.state.runner.process_video,
            input_path,
            output_path,
        )

    meta_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    # Optional TTL cleanup (so disk doesn't grow forever).
    ttl_seconds = 20 * 60

    async def _cleanup_later() -> None:
        await asyncio.sleep(ttl_seconds)
        _cleanup_job(job_dir)

    background_tasks.add_task(_cleanup_later)

    return JSONResponse({"job_id": job_id})


@app.get("/results/{job_id}/video")
async def get_video(job_id: str):
    job_dir = app.state.jobs_dir / job_id
    output_path = job_dir / "output.mp4"
    if not output_path.exists():
        return JSONResponse({"error": "video not found"}, status_code=404)
    return FileResponse(
        str(output_path),
        media_type="video/mp4",
        filename="reid_output.mp4",
    )


@app.get("/results/{job_id}/meta")
async def get_meta(job_id: str):
    job_dir = app.state.jobs_dir / job_id
    meta_path = job_dir / "meta.json"
    if not meta_path.exists():
        return JSONResponse({"error": "meta not found"}, status_code=404)
    return JSONResponse(json.loads(meta_path.read_text(encoding="utf-8")))

