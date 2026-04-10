# api/app.py
import os
import io
import base64
from collections import defaultdict
from typing import Any, Dict, List, Optional
import uuid

import numpy as np
from dotenv import load_dotenv
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Request, UploadFile, BackgroundTasks, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from openai import OpenAI
from PIL import Image
from pydantic import BaseModel
from services.auth_service import supabase 
import time
from fastapi.staticfiles import StaticFiles


# Retrieval layer
try:
    from query.search import search as kb_search
    # Vision ingestion
    from vision.context_builder import describe_and_save
    from vision.v2_graph_context_builder import save_graph, load_graph, process_and_remember_observation

    # Auth API
    from services.auth_service import login_user as auth_login, register_user as auth_register, logout_user as auth_logout

    # Item API
    from services.item_service import (
        get_item, update_item, delete_item, create_item, get_all_items as fetch_items
    )
    # Video API
    from services.video_service import (
        get_video, update_video, delete_video, create_video, get_all_videos as fetch_videos, upload_video_file
    )
    # User API
    from services.user_service import (
        get_profile as fetch_user_profile,
        update_profile as edit_user_profile
    )
    # Chat DB API
    from services.chat_service import (
        get_user_sessions, create_session, get_session_messages, save_message, update_session_title, delete_session
    )

    from query.search_v2 import (
        ConversationState,
        GraphMemoryRetriever,
        GraphEntityResolver,
        retrieve_facts_hybrid,
        llm_answer,
        update_state,
        update_history, 
    )
except ImportError as e:
    print(f"CRITICAL: Missing module or import error: {e}")

from api.deps import get_current_user
from fastapi import Depends

origins = [
    "http://localhost:3000",      # Standard Next.js port
    "http://127.0.0.1:3000",      # Alternative local IP
    # "https://your-production-domain.com", # Uncomment and change this when you deploy!
]

#search_v2
from pathlib import Path

# -------------------------------------------------------------------       
# Environment & OpenAI setup
# -------------------------------------------------------------------
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not found in environment variables.")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
TTS_VOICE = os.getenv("TTS_VOICE", "alloy")
TTS_MODEL = os.getenv("TTS_MODEL", "gpt-4o-mini-tts")

client = OpenAI(api_key=OPENAI_API_KEY)

GRAPH_SAVE_PATH = Path("home_memory_graph.pkl")
IMAGE_DIR = Path("memory_images")

if not IMAGE_DIR.exists():
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)

# Initialize memory safely
if GRAPH_SAVE_PATH.exists():
    try:
        memory = load_graph(str(GRAPH_SAVE_PATH))
    except Exception as e:
        print(f"Error loading graph: {e}. Initializing new graph.")
        # Replace this with your actual Graph Class initialization if load_graph fails
        memory = None 
else:
    print("No existing graph found. Starting with empty memory.")
    memory = None


from services.reid_service import ReIDConfig, PersonReIDRunner
# Global ReID Initialization
BASE_DIR_TMP = Path(__file__).resolve().parent.parent
try:
    reid_config = ReIDConfig(
        repo_root=BASE_DIR_TMP,
        yolo_weights= "yolov8n.pt",
        gallery_dir=BASE_DIR_TMP / "gallery",
        torch_home=BASE_DIR_TMP / ".torchreid",
    )
    reid_runner = PersonReIDRunner(reid_config)
except Exception as e:
    print(f"Warning: Failed to initialize PersonReIDRunner: {e}")
    reid_runner = None


# -------------------------------------------------------------------
# FastAPI app & CORS
# -------------------------------------------------------------------
app = FastAPI(title="ALISS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------
# Session state (multi-turn)
# -------------------------------------------------------------------
SessionState = Dict[str, Any]

SESSIONS: Dict[str, SessionState] = defaultdict(
    lambda: {
        "turn": 0,
        "last_question": None,
        "last_evidence": [],
    }
)

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def uploadfile_to_bgr_numpy(file: UploadFile) -> np.ndarray:
    data = file.file.read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    arr = np.array(img)
    return arr[..., ::-1].copy()  # RGB -> BGR

def rows_to_evidence(rows) -> List[Dict[str, Any]]:
    return [
        {
            "id": r[0],
            "ts": str(r[1]),
            "location": r[2],
            "object": r[3],
            "background": r[4],
            "text": r[5],
            "score": float(r[6]),
        }
        for r in rows
    ]

def tts_mp3_bytes(text: str, voice: str) -> bytes:
    audio = client.audio.speech.with_streaming_response.create(
        model=TTS_MODEL,
        voice=voice,
        input=text,
        response_format="mp3",
    )
    return audio.read()

# -------------------------------------------------------------------
# Models
# -------------------------------------------------------------------
class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    k: int = 5
    with_tts: bool = False
    tts_voice: Optional[str] = None

class SpeechRequest(BaseModel):
    text: str
    voice: Optional[str] = None

# --- Pydantic Models for Auth ---
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: str
    password: str

# -------------------------------------------------------------------
# Health
# -------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "model": OPENAI_MODEL}


app.mount("/images", StaticFiles(directory="memory_images"), name="images")

ACTIVITY_OUT_DIR = BASE_DIR_TMP / "activity_recognition" / "output"
ACTIVITY_OUT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/activity_output", StaticFiles(directory=str(ACTIVITY_OUT_DIR)), name="activity_output")

# -------------------------------------------------------------------
# Context Builder
# -------------------------------------------------------------------

def process_memory_background(contents: bytes, obj_name: str, location: str, model: str):
    try:
        bgr = uploadfile_to_bgr_numpy_raw(contents)
        describe_and_save(obj_name=obj_name, image=bgr, location=location, model=model)
    except Exception as e:
         print(f"Background task (memory) failed: {e}")

def uploadfile_to_bgr_numpy_raw(data: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    arr = np.array(img)
    return arr[..., ::-1].copy()

# @app.post("/memory")
# def create_memory(
#     background_tasks: BackgroundTasks,
#     obj_name: str = Form(...),
#     location: str = Form(...),
#     image: UploadFile = File(...),
#     model: str = Form("gpt-4o"),
#     user = Depends(get_current_user),
# ):
#     try:
#         contents = image.file.read()
#         background_tasks.add_task(
#             process_memory_background,
#             contents=contents,
#             obj_name=obj_name,
#             location=location,
#             model=model
#         )
#         return JSONResponse({"status": "Processing Memory", "message": "Image queued"}, status_code=202)
#     except Exception as e:
#         return JSONResponse({"error": f"Memory creation failed: {e}"}, status_code=500)
    
def process_memory_v2_background(contents: bytes, obj_name: str, location: str, user_id: str, timestamp: float, image_storage_dir: str):
    try:
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
        process_and_remember_observation(
            graph=memory,
            image=pil_image,
            object_name=obj_name,
            room_name=location,
            user_id=user_id,
            timestamp=timestamp,
            save_path=GRAPH_SAVE_PATH,
            image_storage_dir = image_storage_dir
        )
    except Exception as e:
        print(f"Background task (memoryv2) failed: {e}")
    
@app.post("/memoryv2")
def create_memory_v2(
    background_tasks: BackgroundTasks,
    obj_name: str = Form(...),
    location: str = Form(...),
    image: UploadFile = File(...),
    user = Depends(get_current_user),
    timestamp: float = time.time(),
    image_storage_dir = "./memory_images",
    model: str = Form("gpt-4o"),
):
    try:
        contents = image.file.read()
        background_tasks.add_task(
            process_memory_v2_background,
            contents=contents,
            obj_name=obj_name,
            location=location,
            user_id=user["first_name"],
            timestamp=timestamp,
            image_storage_dir = image_storage_dir
        )
        return JSONResponse({"status": "Processing Memory", "message": "Image queued."}, status_code=202)
    except Exception as e:
        return JSONResponse(
            {"error": f"Memory creation failed: {e}"},
            status_code=500
        )

@app.get("/memoryv2/objects")
def list_graph_objects(user = Depends(get_current_user)):
    try:
        results = []
        
        # 1. Iterate through all nodes labeled as 'object'
        for nid, data in memory.graph.nodes(data=True):
            if data.get("type") == "object":
                obj_info = {
                    "id": nid,
                    "location": {"surface": "unknown", "room": "unknown"}
                }
                obj_info.update({k: v for k, v in data.items() if k not in ["type"]})

                # 2. Traverse Graph: Find Surface (Object --on--> Surface)
                for _, surface_nid, edge_data in memory.graph.out_edges(nid, data=True):
                    if edge_data.get("relation") == "on":
                        surface_data = memory.graph.nodes.get(surface_nid, {})
                        obj_info["location"]["surface"] = surface_data.get("name", "unknown")
                        
                        # 3. Traverse Graph: Find Room (Surface --in--> Room)
                        for _, room_nid, room_edge_data in memory.graph.out_edges(surface_nid, data=True):
                            if room_edge_data.get("relation") == "in":
                                room_data = memory.graph.nodes.get(room_nid, {})
                                obj_info["location"]["room"] = room_data.get("name", "unknown")
                                break # Found the room
                        break # Found the surface
                
                results.append(obj_info)

        return {
            "count": len(results), 
            "objects": results
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    
class UpdateGraphObjectRequest(BaseModel):
    node_id: str
    updates: Dict[str, Any]

@app.put("/memoryv2/object")
def update_graph_object(
    payload: UpdateGraphObjectRequest,
    user = Depends(get_current_user)
):
    try:
        nid = payload.node_id

        if nid not in memory.graph:
            return JSONResponse({"error": "Node not found"}, status_code=404)

        # Update node
        memory.graph.nodes[nid].update(payload.updates)

        # Optional: update last_seen
        memory.graph.nodes[nid]["last_seen"] = time.time()

        save_graph(memory, GRAPH_SAVE_PATH)

        return {
            "status": "updated",
            "node": {
                "id": nid,
                **memory.graph.nodes[nid]
            }
        }

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    
class DeleteGraphObjectRequest(BaseModel):
    node_id: str

@app.delete("/memoryv2/object")
def delete_graph_object(
    payload: DeleteGraphObjectRequest,
    user = Depends(get_current_user)
):
    try:
        nid = payload.node_id

        if nid not in memory.graph:
            return JSONResponse({"error": "Node not found"}, status_code=404)

        # 1. Remove from memory
        memory.graph.remove_node(nid)

        # 2. SAVE TO DISK (The missing step)
        try:
            # Assuming you have a save_graph function defined elsewhere
            save_graph(memory, str(GRAPH_SAVE_PATH))
        except Exception as save_error:
            print(f"Warning: Node deleted in RAM but failed to save to disk: {save_error}")
            # You might still return success, or throw an error depending on preference

        return {
            "status": "deleted",
            "node_id": nid
        }

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# -------------------------------------------------------------------
# Chat (+ optional TTS in same response)
# -------------------------------------------------------------------

@app.post("/chat")
def chat(body: ChatRequest, user = Depends(get_current_user)):
    user_msg = body.message.strip()
    k = body.k

    if not user_msg:
        return JSONResponse({"error": "Empty message"}, status_code=400)

    # 1. Connect or Initialize DB Session
    session_id = body.session_id
    if not session_id:
        title = user_msg[:30] + ("..." if len(user_msg) > 30 else "")
        new_session = create_session(user["id"], title)
        if not new_session:
            return JSONResponse({"error": "Failed to create DB session"}, status_code=500)
        session_id = new_session["id"]
        
    save_message(session_id, "user", user_msg)

    # 2. Extract ephemeral contextual memory map
    state = SESSIONS[session_id]
    state["turn"] = state.get("turn", 0) + 1

    # retrieval on first turn (or if evidence missing)
    if state["turn"] == 1 or not state.get("last_evidence"):
        rows = kb_search(user_msg, k=k)
        evidence = rows_to_evidence(rows)

        if not evidence:
            state["last_question"] = user_msg
            state["last_evidence"] = []
            no_record_ans = "I don’t have any records for that yet."
            save_message(session_id, "ai", no_record_ans)
            return {
                "session_id": session_id,
                "turn": state["turn"],
                "answer": no_record_ans,
                "evidence": [],
                "audio_base64": None,
                "audio_mime": None,
            }

        state["last_question"] = user_msg
        state["last_evidence"] = evidence

    evidence = state["last_evidence"]

    context = "\n".join(
        f"[{e['ts']}] {e['location']} — {e['object']}. {e['background']} (score={e['score']:.3f})"
        for e in evidence
    )

    prompt = (
        "You are ALISS.\n"
        "Use ONLY the evidence below.\n\n"
        f"Question: {user_msg}\n\n"
        f"EVIDENCE:\n{context}\n\n"
        "Answer concisely (1–3 sentences)."
    )

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=200,
        )
        answer_text = resp.choices[0].message.content.strip()
    except Exception as e:
        answer_text = f"Error generating answer: {e}"

    audio_b64 = None
    audio_mime = None
    if body.with_tts and answer_text and not answer_text.startswith("Error generating answer"):
        try:
            voice = body.tts_voice or TTS_VOICE
            mp3 = tts_mp3_bytes(answer_text, voice=voice)
            audio_b64 = base64.b64encode(mp3).decode("utf-8")
            audio_mime = "audio/mpeg"
        except Exception:
            audio_b64 = None
            audio_mime = None

    # 3. Finalize DB Pipeline
    save_message(session_id, "ai", answer_text)

    return {
        "session_id": session_id,
        "turn": state["turn"],
        "answer": answer_text,
        "evidence": evidence,
        "audio_base64": audio_b64,
        "audio_mime": audio_mime,
    }

# -------------------------------------------------------------------
# Chat v2 (+ optional TTS in same response)
# -------------------------------------------------------------------


SEARCH_V2_SESSIONS: Dict[str, ConversationState] = defaultdict(ConversationState)

class ChatV2Request(BaseModel):
    session_id: str
    message: str

@app.post("/chats_v2")
def chats_v2(body: ChatV2Request, user: dict = Depends(get_current_user)):
    search_v2_memory = load_graph(Path(GRAPH_SAVE_PATH))
    search_v2_retriever = GraphMemoryRetriever(search_v2_memory)
    search_v2_resolver = GraphEntityResolver(search_v2_retriever)
    session_id = body.session_id
    user_msg = body.message.strip()

    if not user_msg:
        return JSONResponse({"error": "Empty message"}, status_code=400)
    
    save_message(session_id, "user", user_msg, user["id"])

    state = SEARCH_V2_SESSIONS[session_id]

    try:
        facts = retrieve_facts_hybrid(
            retriever=search_v2_retriever,
            resolver=search_v2_resolver,
            query=user_msg,
            state=state,
        )

        answer = llm_answer(user_msg, facts, state)

        update_state(state, facts)
        update_history(state, user_msg, answer)
        
        save_message(session_id, "ai", answer, user["id"])
        
        if state.turn == 1:
            try:
                title_prompt = f"Summarize this query into a concise 2-4 word chat title. Do not wrap in quotes or add extra punctuation. Query: '{user_msg}'"
                resp = client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=[{"role": "user", "content": title_prompt}],
                    temperature=0.3,
                    max_tokens=10,
                )
                title = resp.choices[0].message.content.strip().replace('"', '')
            except Exception as title_err:
                print(f"Warning: Failed to generate title: {title_err}")
                title = user_msg[:30] + ("..." if len(user_msg) > 30 else "")
                
            update_session_title(session_id, title, user["id"])

        return {
            "session_id": session_id,
            "turn": state.turn,
            "answer": answer,
        }

    except Exception as e:
        return JSONResponse(
            {"error": f"chats_v2 failed: {str(e)}"},
            status_code=500,
        )
        
@app.get("/chats")
def list_chats(user = Depends(get_current_user)):
    return get_user_sessions(user["id"])

@app.get("/chats/{session_id}/messages")
def list_chat_messages(session_id: str, user = Depends(get_current_user)):
    try:
        return get_session_messages(session_id, user["id"])
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=403)

@app.post("/chats/session")
def create_new_session(user = Depends(get_current_user)):
    """
    Creates a new session in PostgreSQL and returns the session_id.
    """
    new_session = create_session(user_id=user["id"], title="New Conversation")
    
    if not new_session:
        return JSONResponse({"error": "Failed to create DB session"}, status_code=500)
        
    return {"session_id": new_session["id"]}

def remove_chat_session(session_id: str, user = Depends(get_current_user)):
    try:
        delete_session(session_id, user["id"])
        
        if session_id in SEARCH_V2_SESSIONS:
            del SEARCH_V2_SESSIONS[session_id]
            
        return {"status": "deleted", "session_id": session_id}
    except Exception as e:
        return JSONResponse({"error": f"Failed to delete session: {e}"}, status_code=500)

# -------------------------------------------------------------------
# Text to Speech (standalone)
# -------------------------------------------------------------------
@app.post("/speech")
def speech(req: SpeechRequest):
    text = req.text.strip()
    if not text:
        return JSONResponse({"error": "Empty text"}, status_code=400)

    voice = req.voice or TTS_VOICE
    data = tts_mp3_bytes(text, voice=voice)

    return Response(
        content=data,
        media_type="audio/mpeg",
        headers={"Content-Disposition": 'attachment; filename="speech.mp3"'},
    )

# -------------------------------------------------------------------
# Auth API
# -------------------------------------------------------------------
@app.post("/auth/login")
async def login_endpoint(req: LoginRequest): # Unique name
    # Now calling the renamed import
    result = auth_login(req.email, req.password) 
    
    if isinstance(result, dict) and result.get("status") == "login_failed":
        return JSONResponse(status_code=401, content=result)
    
    # Handle the case where email confirmation is required (session is None)
    if not hasattr(result, 'session') or not result.session:
        return JSONResponse(
            status_code=403, 
            content={"error": "Please confirm your email address."}
        )

    return {
        "access_token": result.session.access_token,
        "user_id": result.user.id
    }

@app.post("/auth/register")
async def register_endpoint(req: RegisterRequest): # Unique name
    result = auth_register(
        first_name=req.first_name,
        last_name=req.last_name,
        phone=req.phone,
        email=req.email,
        password=req.password
    )
    if isinstance(result, dict) and result.get("status") == "error":
        return JSONResponse(status_code=400, content=result)
    return result

@app.post("/auth/logout")
async def logout_endpoint(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        # Even if they don't have a token, we just tell the frontend "success" 
        # so it clears the local state anyway.
        return {"status": "success"}

    # Extract the token without the "Bearer " part
    token = authorization.split(" ")[1]
    
    result = auth_logout(token)
    return result

# -------------------------------------------------------------------
# Item API (CRUD)
# -------------------------------------------------------------------
@app.get("/items/{item_id}")
async def read_item(item_id: str, user: dict = Depends(get_current_user)):
    # Now this route is protected!
    return get_item(item_id)

@app.get("/items")
async def read_all_items(user: dict = Depends(get_current_user)):
    # Pass the user's ID to the service function
    return fetch_items(user["id"])

@app.delete("/items/{item_id}")
async def remove_item(item_id: str, user = Depends(get_current_user)):
    return delete_item(item_id)

@app.put("/items/{item_id}")
async def edit_item(item_id: str, update_data: dict, user = Depends(get_current_user)):
    return update_item(item_id, update_data)

# -------------------------------------------------------------------
# Video API (CRUD)
# -------------------------------------------------------------------
@app.get("/videos/{video_id}")
async def read_video(video_id: str, user: dict = Depends(get_current_user)):
    # Now this route is protected!
    return get_video(video_id)

@app.get("/videos")
async def read_all_videos(user: dict = Depends(get_current_user)):
    # Pass the user's ID to the service function
    return fetch_videos(user["id"])

@app.post("/videos")
async def create_new_video(video_data: dict, user: dict = Depends(get_current_user)):
    video_data["user_id"] = user["id"]
    return create_video(video_data)

def process_reid_video_background(record_id: str, in_path: str, filename: str):
    import os
    try:
        out_path = f"{in_path}_annotated.mp4"
        
        if reid_runner is not None:
            from pathlib import Path
            print(f"[Background Worker] Processing video ID: {record_id} via ReID Runner")
            reid_runner.process_video(Path(in_path), Path(out_path))
        else:
            import shutil
            shutil.copy(in_path, out_path)

        with open(out_path, "rb") as out_f:
            processed_contents = out_f.read()
            
        print(f"[Background Worker] Uploading Video ID {record_id} to Storage...")
        storage_res = upload_video_file(processed_contents, filename)
        
        if storage_res.get("status") == "success":
            public_url = storage_res["url"]
            update_video(record_id, {"video_uri": public_url})
            print(f"[Background Worker] Completed Video ID {record_id}.")
        else:
            print(f"Background Upload Error: {storage_res.get('message')}")
            
    except Exception as e:
        print(f"Video Processing Background task failed: {e}")
    finally:
        if os.path.exists(in_path): os.remove(in_path)
        try:
            if os.path.exists(out_path): os.remove(out_path)
        except Exception:
            pass


@app.post("/videos/upload")
async def upload_video_endpoint(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    import tempfile
    import os
    in_path = None
    try:
        contents = await file.read()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as in_tmp:
            in_tmp.write(contents)
            in_path = in_tmp.name
            
        video_data = {
            "user_id": user["id"],
            "name": name,
            "video_uri": "processing",
            "source_type": "mobile",
        }
        
        record = create_video(video_data)
        
        if isinstance(record, list) and len(record) > 0:
            record_id = record[0]["id"]
        elif isinstance(record, dict) and "id" in record:
            record_id = record["id"]
        else:
            record_id = getattr(record, 'id', None)
            
        if not record_id:
            if in_path and os.path.exists(in_path): os.remove(in_path)
            return JSONResponse(status_code=500, content={"error": "Failed to create DB video abstract"})

        background_tasks.add_task(
            process_reid_video_background,
            record_id=record_id,
            in_path=in_path,
            filename=file.filename
        )
        
        return {"saved": True, "record": record}
    except Exception as e:
        if in_path and os.path.exists(in_path): os.remove(in_path)
        return JSONResponse(
            {"error": f"Video upload sequence failed: {e}"},
            status_code=500
        )

@app.get("/test/activity", include_in_schema=False)
def test_activity_page():
    from fastapi.responses import HTMLResponse
    html = """<!DOCTYPE html>
<html>
<head>
  <title>Activity Processing Test</title>
  <style>
    body { font-family: sans-serif; max-width: 900px; margin: 2em auto; padding: 0 1em; }
    label { display: block; margin-bottom: .5em; }
    button { margin-top: .5em; padding: .5em 1.5em; cursor: pointer; }
    #status { margin-top: 1em; color: #555; font-style: italic; }
    .room-section { margin-top: 1.5em; border: 1px solid #ddd; border-radius: 6px; padding: 1em; }
    .room-section h3 { margin: 0 0 .5em; }
    table { border-collapse: collapse; width: 100%; font-size: .9em; }
    th, td { border: 1px solid #ccc; padding: .4em .7em; text-align: left; }
    th { background: #f0f0f0; }
    .video-section { margin-top: 2em; }
    .video-section h3 { margin-bottom: .5em; }
    video { width: 100%; max-width: 700px; display: block; margin-bottom: .5em; }
  </style>
</head>
<body>
  <h2>Activity Processing Test</h2>
  <form id="form">
    <label>Video 1: <input type="file" name="file_1" accept="video/*" required></label>
    <label>Location 1: <input type="text" name="location_1" placeholder="e.g. Living room" required></label>
    <label>Video 2: <input type="file" name="file_2" accept="video/*" required></label>
    <label>Location 2: <input type="text" name="location_2" placeholder="e.g. Bed room" required></label>
    <label>Bearer Token: <input type="text" id="token" placeholder="paste access_token here" style="width:500px"></label>
    <button type="submit">Process</button>
  </form>

  <div id="status"></div>
  <div id="output"></div>

  <script>
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const token = document.getElementById('token').value.trim();
      document.getElementById('status').textContent = 'Processing... (this may take a few minutes)';
      document.getElementById('output').innerHTML = '';

      try {
        const res = await fetch('/videos/activity', {
          method: 'POST',
          headers: token ? { Authorization: 'Bearer ' + token } : {},
          body: fd,
        });
        const data = await res.json();
        document.getElementById('status').textContent = data.error
          ? 'Error: ' + data.error
          : 'Completed \u2713';

        if (data.error) return;

        // ── Group events by room ──────────────────────────────────────
        const byRoom = {};
        for (const ev of (data.events || [])) {
          const room = ev.location || 'Unknown';
          if (!byRoom[room]) byRoom[room] = [];
          byRoom[room].push(ev);
        }

        let html = '';
        for (const [room, events] of Object.entries(byRoom).sort()) {
          html += '<div class="room-section"><h3>&#128205; ' + room + '</h3>';
          html += '<table><thead><tr><th>Type</th><th>Person</th><th>Object</th><th>Time</th></tr></thead><tbody>';
          for (const ev of events) {
            const type = ev.type === 'start_hold'
              ? '<span style="color:green">&#9654; start_hold</span>'
              : '<span style="color:#c00">&#9632; end_hold</span>';
            html += '<tr><td>' + type + '</td><td>' + ev.person_name + '</td><td>' + ev.object_name + '</td><td>' + ev.time + '</td></tr>';
          }
          html += '</tbody></table></div>';
        }

        // ── Video players + download links ────────────────────────────
        const videos = [
          { label: 'Video 1 — ' + (fd.get('location_1') || ''), url: data.video_1_url },
          { label: 'Video 2 — ' + (fd.get('location_2') || ''), url: data.video_2_url },
        ];
        for (const v of videos) {
          if (!v.url) continue;
          html += '<div class="video-section">';
          html += '<h3>' + v.label + '</h3>';
          html += '<video controls><source src="' + v.url + '" type="video/mp4">Your browser does not support video.</video>';
          html += '<a href="' + v.url + '" download>&#11015; Download annotated video</a>';
          html += '</div>';
        }

        document.getElementById('output').innerHTML = html;
      } catch (err) {
        document.getElementById('status').textContent = 'Error: ' + err;
      }
    });
  </script>
</body>
</html>"""
    return HTMLResponse(html)


@app.post("/videos/activity")
async def process_activity_videos(
    request: Request,
    file_1: UploadFile = File(...),
    location_1: str = Form(...),
    file_2: UploadFile = File(...),
    location_2: str = Form(...),
    user: dict = Depends(get_current_user),
):
    from starlette.concurrency import run_in_threadpool
    from videos_process import videos_process

    input_dir = BASE_DIR_TMP / "input"
    input_dir.mkdir(parents=True, exist_ok=True)

    run_id = uuid.uuid4().hex[:8]
    video_path_1 = input_dir / f"{run_id}_1_{file_1.filename}"
    video_path_2 = input_dir / f"{run_id}_2_{file_2.filename}"

    try:
        video_path_1.write_bytes(await file_1.read())
        video_path_2.write_bytes(await file_2.read())

        result = await run_in_threadpool(
            videos_process,
            video_path_1, location_1,
            video_path_2, location_2,
            ACTIVITY_OUT_DIR,
        )

        base_url = str(request.base_url).rstrip("/")
        annotated_1 = f"{video_path_1.stem}_annotated.mp4"
        annotated_2 = f"{video_path_2.stem}_annotated.mp4"
        result["video_1_url"] = f"{base_url}/activity_output/{annotated_1}"
        result["video_2_url"] = f"{base_url}/activity_output/{annotated_2}"

        return result

    except Exception as e:
        return JSONResponse({"error": f"Activity processing failed: {e}"}, status_code=500)


@app.delete("/videos/{video_id}")
async def remove_video(video_id: str):
    return delete_video(video_id)

@app.put("/videos/{video_id}")
async def edit_video(video_id: str, update_data: dict):
    return update_video(video_id, update_data)

# -------------------------------------------------------------------
# User API
# -------------------------------------------------------------------
@app.get("/users/me")
async def read_user_profile(user = Depends(get_current_user)):
    profile = fetch_user_profile(user["id"])
    if profile:
        return profile
    return JSONResponse(status_code=404, content={"error": "User not found"})

@app.put("/users/me")
async def update_user_profile(update_data: dict, user = Depends(get_current_user)):
    
    # Extract the base64 image string that the frontend sent as 'image_uri'
    avatar_b64 = update_data.pop("image_uri", None)
    
    if avatar_b64:
        try:
            if "," in avatar_b64:
                header, base64_str = avatar_b64.split(",", 1)
                ext = header.split(";")[0].split("/")[1] # Extracts 'jpeg', 'png', etc.
            else:
                base64_str = avatar_b64
                ext = "jpg"
            
            image_bytes = base64.b64decode(base64_str)
            
            filename = f"{user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
            
            supabase.storage.from_("images").upload(
                path=filename,
                file=image_bytes,
                file_options={"content-type": f"image/{ext}"}
            )
            
            url_response = supabase.storage.from_("images").create_signed_url(filename, 315360000)
            update_data["image_uri"] = url_response["signedURL"]
            
        except Exception as e:
            print(f"Avatar upload failed: {e}")
            return JSONResponse(status_code=500, content={"error": "Failed to upload avatar"})

    updated_profile = edit_user_profile(user["id"], update_data)
    
    if updated_profile:
        return updated_profile
        
    return JSONResponse(status_code=400, content={"error": "Failed to update user profile"})

#--------------------------------------------------
# Root
#--------------------------------------------------
@app.get("/")
def read_root():
    return {"status": "CORS is configured!"}