# services/video_service.py
import os
from supabase import create_client, Client 
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_video(video_id: str):
    response = supabase.table("videos").select("*").eq("id", video_id).single().execute()
    return response.data

def get_all_videos():
    response = supabase.table("videos").select("*").order("created_at", desc=True).execute()
    return response.data

def delete_video(video_id: str):
    response = supabase.table("videos").delete().eq("id", video_id).execute()
    return response.data

def update_video(video_id: str, update_data: dict):
    response = supabase.table("videos").update(update_data).eq("id", video_id).execute()
    return response.data

def create_video(video_data: dict):
    response = supabase.table("videos").insert(video_data).execute()
    return response.data