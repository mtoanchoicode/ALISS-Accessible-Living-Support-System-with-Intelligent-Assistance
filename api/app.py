# api/app.py
import os, io
from typing import List, Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import Response

# reuse your retrieval helpers
from query.search import search as kb_search, answer as kb_answer

from openai import OpenAI

load_dotenv()
app = FastAPI(title="ALISS Response API")

# # --- CORS (optional but useful for apps) ---
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # tighten later
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# --- OpenAI setup ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
MIN_SIM = float(os.getenv("MIN_SIM_THRESHOLD", "0.75"))

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY missing in environment")

client = OpenAI(api_key=OPENAI_API_KEY)

# /search  (raw retrieval)
@app.get("/search")
def search(
    q: str = Query(..., description="User question"),
    k: int = 5,
    location: Optional[str] = None
):
    rows = kb_search(q, k=k, location=location)
    out = [
        {
            "id": r[0], "ts": str(r[1]), "location": r[2], "object": r[3],
            "background": r[4], "text": r[5], "score": float(r[6]),
        } for r in rows
    ]
    return {"query": q, "k": k, "location": location, "results": out}

# /answer  (LLM-grounded)
def build_grounded_prompt(question: str, evidence_rows: List[dict]) -> List[dict]:
    system = (
        "You are ALISS Response. Answer ONLY using the EVIDENCE provided.\n"
        "- If the evidence is insufficient, say you don’t know and suggest one next step (e.g., check location).\n"
        "- Always include the location and timestamp of the best evidence.\n"
        "- Be concise (1–2 sentences)."
    )

    lines = []
    for r in evidence_rows:
        lines.append(
            f"[{r['ts']}] {r['location']} — {r['object']}. "
            f"{r.get('background') or ''} {r.get('text') or ''} "
            f"(score={r['score']:.3f})"
        )
    evidence_block = "EVIDENCE:\n" + "\n".join(lines) if lines else "EVIDENCE:\n<none>"

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": f"{question}\n\n{evidence_block}"}
    ]

@app.get("/answer")
def answer(q: str = Query(..., description="User question"), k: int = 5):
    text = kb_answer(q, k=k)  # ← call your unified RAG answer
    # (optional) also return evidence for the UI by reusing kb_search:
    rows = kb_search(q, k=k)
    evidence = [
        {"id": r[0], "ts": str(r[1]), "location": r[2], "object": r[3],
         "background": r[4], "text": r[5], "score": float(r[6])}
        for r in rows
    ]
    return {"answer": text, "evidence": evidence, "grounded": bool(evidence)}

# /speak  (OpenAI TTS)
class SpeakIn(BaseModel):
    text: str

TTS_ENGINE = os.getenv("TTS_ENGINE", "openai").lower()
TTS_VOICE = os.getenv("TTS_VOICE", "alloy")  # e.g., alloy, verse, aria


@app.post("/speak")
def speak(body: SpeakIn):
    txt = (body.text or "").strip()
    if not txt:
        return JSONResponse({"error": "empty text"}, status_code=400)

    if TTS_ENGINE != "openai":
        return JSONResponse({"error": "Set TTS_ENGINE=openai in .env to use this endpoint"}, status_code=400)

    try:
        # Be explicit about MP3 (response_format may be required depending on SDK version)
        audio = client.audio.speech.create(
            model="gpt-4o-mini-tts",
            voice=TTS_VOICE,
            input=txt,
            response_format="mp3",   # <— add this for clarity/compat
        )

        # If you're using the streaming helper:
        data = audio.read()  # raw MP3 bytes

        headers = {
            "Content-Disposition": 'attachment; filename="speech.mp3"',  # <—
            "Accept-Ranges": "bytes",
            "Content-Length": str(len(data)),
            "Cache-Control": "no-store",
        }
        return Response(content=data, media_type="audio/mpeg", headers=headers)

    except Exception as e:
        return JSONResponse({"error": f"TTS failed: {e}"}, status_code=500)

# client wants “ask → speak” in one ste
@app.get("/answer_and_speak")
def answer_and_speak(q: str = Query(...), k: int = 5):
    text = kb_answer(q, k=k)

    # Generate MP3
    audio = client.audio.speech.create(
        model="gpt-4o-mini-tts",
        voice=TTS_VOICE,
        input=text,
        response_format="mp3",
    )
    data = audio.read()

    headers = {
        "Content-Disposition": 'attachment; filename="speech.mp3"',
        "Accept-Ranges": "bytes",
        "Content-Length": str(len(data)),
        "Cache-Control": "no-store",
    }
    return Response(content=data, media_type="audio/mpeg", headers=headers)
