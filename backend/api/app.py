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
from fastapi.responses import JSONResponse, Response, FileResponse
from openai import OpenAI
from PIL import Image
from pydantic import BaseModel
from services.auth_service import supabase 
import time
from fastapi.staticfiles import StaticFiles


# Retrieval layer
try:
    # from query.search import search as kb_search
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
    
class MoveObjectRequest(BaseModel):
    object_name: str
    old_room: str
    new_room: str
    old_user_id: str
    new_user_id: str

@app.post("/memoryv2/move-object")
def move_graph_object(
    payload: MoveObjectRequest,
    user = Depends(get_current_user)
):
    """
    Moves an object from one room to another.
    If the new room or a surface doesn't exist, it creates them.
    """
    try:
        # We use the current user's name and current timestamp
        # user_id = user.get("first_name", "unknown")
        timestamp = time.time()

        # Call the logic we implemented in the HomeMemoryGraph class
        updated_nid = memory.update_object(
            obj_name=payload.object_name,
            old_room=payload.old_room,
            new_room=payload.new_room,
            old_user_id=payload.old_user_id, # Can represent who reported it moved
            new_user_id=payload.new_user_id,
            timestamp=timestamp
        )

        if not updated_nid:
            return JSONResponse(
                {"error": f"Could not find '{payload.object_name}' in '{payload.old_room}'"}, 
                status_code=404
            )

        # Persistence: Save the graph state to disk
        save_graph(memory, str(GRAPH_SAVE_PATH))

        # Retrieve the updated data to return to the frontend
        node_data = memory.graph.nodes[updated_nid]

        return {
            "status": "success",
            "message": f"Moved {payload.object_name} to {payload.new_room}",
            "node_id": updated_nid,
            "updated_data": node_data
        }

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


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

def process_events_first_last(events, memory):
    import time

    if not events:
        return

    # ✅ Sort by time just in case
    events = sorted(events, key=lambda x: x["time"])

    # Group by object
    object_events = {}

    for ev in events:
        obj = ev["object_name"]
        object_events.setdefault(obj, []).append(ev)

    for obj_name, ev_list in object_events.items():
        if len(ev_list) < 2:
            continue

        old_event = ev_list[0]
        new_event = ev_list[-1]

        old_room = old_event["location"]
        new_room = new_event["location"]
        user = new_event.get("person_name")

        if old_room == new_room:
            continue  # no movement

        updated_nid = memory.update_object(
            obj_name=obj_name,
            old_room=old_room,
            new_room=new_room,
            old_user_id=user,
            new_user_id=user,
            timestamp=time.time()
        )

        if updated_nid:
            print(f"[MOVE] {obj_name}: {old_room} → {new_room}")
            
        save_graph(memory, str(GRAPH_SAVE_PATH))

def process_activity_videos_background(
    record_1_id: str,
    record_2_id: str,
    video_path_1: Path,
    location_1: str,
    video_path_2: Path,
    location_2: str,
    tmp_out: Path,
    filename_1: str,
    filename_2: str
):
    from videos_process import videos_process
    import os

    # 1. Initialize variables early so the `finally` block doesn't crash on error
    annotated_1 = None
    annotated_2 = None

    try:
        print(f"[Background Activity] Starting processing for {record_1_id} and {record_2_id}")
        
        # Run the heavy processing algorithm
        events = videos_process(
            video_path_1, location_1,
            video_path_2, location_2,
            tmp_out,
        )
        process_events_first_last(events, memory)

        annotated_1 = tmp_out / f"{video_path_1.stem}_annotated.mp4"
        annotated_2 = tmp_out / f"{video_path_2.stem}_annotated.mp4"

        # Upload Video 1 to Supabase
        if annotated_1 and annotated_1.exists():
            with open(annotated_1, "rb") as f1:
                res1 = upload_video_file(f1.read(), f"annotated_{filename_1}")
                if res1.get("status") == "success":
                    update_video(record_1_id, {"video_uri": res1["url"]})
                else:
                    update_video(record_1_id, {"video_uri": "error"})

        # Upload Video 2 to Supabase
        if annotated_2 and annotated_2.exists():
            with open(annotated_2, "rb") as f2:
                res2 = upload_video_file(f2.read(), f"annotated_{filename_2}")
                if res2.get("status") == "success":
                    update_video(record_2_id, {"video_uri": res2["url"]})
                else:
                    update_video(record_2_id, {"video_uri": "error"})

        print("[Background Activity] Upload complete.")

    except SystemExit as e:
        # Gracefully handle the sys.exit(1) from videos_process
        print(f"Background activity aborted (Missing model/files): {e}")
        update_video(record_1_id, {"video_uri": "error"})
        update_video(record_2_id, {"video_uri": "error"})
    except Exception as e:
        print(f"Background activity processing failed: {e}")
        update_video(record_1_id, {"video_uri": "error"})
        update_video(record_2_id, {"video_uri": "error"})

    finally:
        # Safely clean up all temporary files
        for p in (video_path_1, video_path_2, annotated_1, annotated_2):
            if p and p.exists(): # Checks if 'p' is not None
                p.unlink(missing_ok=True)
        try:
            if video_path_1 and video_path_1.parent.exists():
                video_path_1.parent.rmdir()
            if tmp_out and tmp_out.exists():
                tmp_out.rmdir()
        except Exception:
            pass

import tempfile
activity_results: dict = {}  # run_id -> {events, video_1_path, video_2_path}

@app.post("/videos/activity")
async def process_activity_videos(
    background_tasks: BackgroundTasks,
    request: Request,
    file_1: UploadFile = File(...),
    location_1: str = Form(default="Living room"),
    file_2: UploadFile = File(...),
    location_2: str = Form(default="Bedroom"),
    user: dict = Depends(get_current_user) # Added auth to link videos to the user
):
    import tempfile
    import uuid
    from pathlib import Path
    import os

    run_id = uuid.uuid4().hex[:8]
    tmp_in = Path(tempfile.mkdtemp())
    tmp_out = Path(tempfile.mkdtemp())

    video_path_1 = tmp_in / f"{run_id}_1_{file_1.filename}"
    video_path_2 = tmp_in / f"{run_id}_2_{file_2.filename}"

    try:
        # 1. Quickly save incoming files
        video_path_1.write_bytes(await file_1.read())
        video_path_2.write_bytes(await file_2.read())

        # 2. Create DB records with "processing" status
        video_data_1 = {
            "user_id": user["id"],
            "name": f"Activity Cam ({location_1})",
            "video_uri": "processing",
            "source_type": "cctv", # or "cctv" if these are stationary cameras!
            "location": location_1   # <--- Mapping perfectly to your DB schema
        }
        video_data_2 = {
            "user_id": user["id"],
            "name": f"Activity Cam ({location_2})",
            "video_uri": "processing",
            "source_type": "cctv", # or "cctv" if these are stationary cameras!
            "location": location_2   # <--- Mapping perfectly to your DB schema
        }

        record_1 = create_video(video_data_1)
        record_2 = create_video(video_data_2)

        # Helper to extract the UUID from the DB creation response
        def get_id(rec):
            if isinstance(rec, list) and len(rec) > 0: return rec[0]["id"]
            elif isinstance(rec, dict) and "id" in rec: return rec["id"]
            return getattr(rec, 'id', None)

        rec_1_id = get_id(record_1)
        rec_2_id = get_id(record_2)

        if not rec_1_id or not rec_2_id:
            raise Exception("Failed to create DB video abstract records")

        # 3. Offload the heavy AI processing and Supabase upload to the background
        background_tasks.add_task(
            process_activity_videos_background,
            record_1_id=rec_1_id,
            record_2_id=rec_2_id,
            video_path_1=video_path_1,
            location_1=location_1,
            video_path_2=video_path_2,
            location_2=location_2,
            tmp_out=tmp_out,
            filename_1=file_1.filename,
            filename_2=file_2.filename
        )

        # 4. Return immediately so the frontend sees the "processing" loading state
        return JSONResponse(content={
            "saved": True,
            "run_id": run_id,
            "message": "Videos are processing in the background",
            "records": [record_1, record_2]
        })

    except Exception as e:
        # Cleanup files if something fails before the background task starts
        for p in (video_path_1, video_path_2):
            if p.exists():
                p.unlink(missing_ok=True)
        try:
            tmp_in.rmdir()
            tmp_out.rmdir()
        except Exception:
            pass

        return JSONResponse({"error": f"Activity processing setup failed: {e}"}, status_code=500)


@app.get("/videos/activity/{run_id}/video/{n}")
async def download_activity_video(run_id: str, n: int):
    result = activity_results.get(run_id)
    if not result:
        return JSONResponse({"error": "run_id not found"}, status_code=404)
    video_path = Path(result.get(f"video_{n}_path", ""))
    if not video_path.exists():
        return JSONResponse({"error": "Video not found"}, status_code=404)
    return FileResponse(str(video_path), media_type="video/mp4", filename=f"annotated_{n}.mp4")


@app.get("/videos/activity/{run_id}")
async def get_activity_result(run_id: str, request: Request):
    result = activity_results.get(run_id)
    if not result:
        return JSONResponse({"error": "run_id not found"}, status_code=404)
    base_url = str(request.base_url).rstrip("/")
    return JSONResponse(content={
        "events": result["events"],
        "video_1_url": f"{base_url}/videos/activity/{run_id}/video/1",
        "video_2_url": f"{base_url}/videos/activity/{run_id}/video/2",
    })


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