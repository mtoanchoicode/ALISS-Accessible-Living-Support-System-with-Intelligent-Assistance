import os
from supabase import create_client, Client 
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Supabase environment variables are missing!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_user_sessions(user_id: str):
    response = supabase.table("chat_sessions").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute()
    return response.data

def create_session(user_id: str, title: str):
    response = supabase.table("chat_sessions").insert({"user_id": user_id, "title": title}).execute()
    if response.data:
        return response.data[0]
    return None

def update_session_timestamp(session_id: str):
    import datetime
    now = datetime.datetime.utcnow().isoformat()
    supabase.table("chat_sessions").update({"updated_at": now}).eq("id", session_id).execute()

def update_session_title(session_id: str, title: str):
    supabase.table("chat_sessions").update({"title": title}).eq("id", session_id).execute()

def get_session_messages(session_id: str):
    response = supabase.table("chat_messages").select("*").eq("session_id", session_id).order("created_at").execute()
    return response.data

def save_message(session_id: str, sender: str, text: str):
    response = supabase.table("chat_messages").insert({
        "session_id": session_id,
        "sender": sender,
        "text": text
    }).execute()
    update_session_timestamp(session_id)
    if response.data:
        return response.data[0]
    return None
