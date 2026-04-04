# services/video_service.py
import os
import uuid
from supabase import create_client, Client 
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_video(video_id: str):
    response = supabase.table("videos").select("*").eq("id", video_id).single().execute()
    return response.data

def get_all_videos(user_id: str):
    try:
        # Add the .eq("user_id", user_id) filter!
        response = supabase.table("videos").select("*").eq("user_id", user_id).execute()
        return response.data
    except Exception as e:
        print(f"Error fetching videos: {e}")
        return []

def delete_video(video_id: str):
    response = supabase.table("videos").delete().eq("id", video_id).execute()
    return response.data

def update_video(video_id: str, update_data: dict):
    response = supabase.table("videos").update(update_data).eq("id", video_id).execute()
    return response.data

def create_video(video_data: dict):
    response = supabase.table("videos").insert(video_data).execute()
    return response.data

def upload_video_file(file_bytes: bytes, filename: str):
    try:
        ext = filename.split(".")[-1] if "." in filename else "mp4"
        unique_filename = f"{uuid.uuid4()}.{ext}"
        
        # Target the explicit 'videos' storage bucket directly
        res = supabase.storage.from_("videos").upload(
            file=file_bytes, 
            path=unique_filename, 
            file_options={"content-type": f"video/{ext}"}
        )
        
        # Hydrate matching public URL out
        public_url = supabase.storage.from_("videos").get_public_url(unique_filename)
        return {"status": "success", "url": public_url}
    except Exception as e:
        return {"status": "error", "message": str(e)}