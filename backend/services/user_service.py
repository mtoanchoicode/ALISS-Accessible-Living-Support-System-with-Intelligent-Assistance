import os
from supabase import create_client, Client 
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Supabase environment variables are missing!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_profile(user_id: str):
    """Fetch a user's profile data from the users table."""
    try:
        response = supabase.table("users").select("*").eq("id", user_id).execute()
        if not response.data:
            return None
        return response.data[0]
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return None

def update_profile(user_id: str, update_data: dict):
    """Update a user's profile data in the users table."""
    try:
        response = supabase.table("users").update(update_data).eq("id", user_id).execute()
        if not response.data:
            return None
        return response.data[0]
    except Exception as e:
        print(f"Error updating user profile: {e}")
        return None
