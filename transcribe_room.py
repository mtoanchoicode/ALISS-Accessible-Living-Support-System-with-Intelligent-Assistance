import os, sys, re, json, tempfile, argparse
from pathlib import Path
from moviepy import VideoFileClip, TextClip, CompositeVideoClip
import whisper

try:
    import imageio_ffmpeg
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    os.environ["PATH"] = os.path.dirname(ffmpeg_path) + os.pathsep + os.environ["PATH"]
except Exception as e:
    print("imageio_ffmpeg not available or failed to configure:", e)

def extract_audio(video_path, out_audio="audio.wav"):
    """Extract audio from video using MoviePy (uses bundled ffmpeg)."""
    print(f"Extracting audio from {video_path} ...")
    clip = VideoFileClip(video_path)
    if clip.audio is None:
        clip.close()
        raise RuntimeError("No audio track found in video!")
    clip.audio.write_audiofile(out_audio, fps=16000, logger=None)
    clip.close()
    print(f"Audio saved to {out_audio}")
    return out_audio

def transcribe_audio(audio_path, model_name="small"):
    """Transcribe audio using OpenAI Whisper."""
    device = "cuda" if whisper.torch.cuda.is_available() else "cpu"
    print(f"Loading Whisper model '{model_name}' on {device}...")
    model = whisper.load_model(model_name, device=device)
    print("Transcribing audio (this may take a few minutes)...")
    result = model.transcribe(audio_path)
    return result["segments"]

def detect_rooms(segments):
    """Detect phrases like 'this is the living room' from transcript."""
    pattern = re.compile(
        r"(?:this is|we are in|i am in|here is|now we are in)\s+(?:the\s+|my\s+)?([\w\s'-]+)",
        re.I
    )
    detections = []
    for seg in segments:
        text = seg["text"].lower()
        match = pattern.search(text)
        if match:
            room = match.group(1).strip().replace(" ", "_")
            detections.append({
                "room": room,
                "start": seg["start"],
                "end": seg["end"]
            })
    return detections

def build_label_timeline(detections):
    """Merge detections into time segments."""
    timeline = []
    for i, d in enumerate(detections):
        start = d["start"]
        end = detections[i + 1]["start"] if i + 1 < len(detections) else d["end"] + 10
        timeline.append({"room": d["room"], "start": start, "end": end})
    return timeline

def main(video_path, model_name="small"):
    video_path = Path(video_path)
    if not video_path.exists():
        print(f"Video not found: {video_path}")
        sys.exit(1)

    # Extract audio (uses bundled ffmpeg)
    audio_path = extract_audio(str(video_path))

    # Transcribe
    segments = transcribe_audio(audio_path, model_name=model_name)

    # Detect room labels
    detections = detect_rooms(segments)
    if not detections:
        print("No 'this is <room>' phrases found. Printing transcript:")
        for s in segments:
            print(f"[{s['start']:.1f}-{s['end']:.1f}] {s['text']}")
        return

    # Build and save timeline
    timeline = build_label_timeline(detections)
    out_path = video_path.with_name(video_path.stem + "_labels.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(timeline, f, indent=2)

    print(f"Labels saved to {out_path}")
    for t in timeline:
        print(f" - {t['room']}: {t['start']:.1f}s → {t['end']:.1f}s")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--model", default="small")
    args = parser.parse_args()
    main(args.video, model_name=args.model)
