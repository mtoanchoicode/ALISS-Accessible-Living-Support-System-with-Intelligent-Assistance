import os
from supabase import create_client, Client 
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Supabase environment variables are missing!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def login_user(email, password): # Rename to avoid confusion
    try:
        result = supabase.auth.sign_in_with_password({"email": email, "password": password})
        return result
    except Exception as e:
        return {"status": "login_failed", "message": str(e)}

def register_user(first_name, last_name, phone, email, password):
    try:
        # Step 1: Sign up the user in Supabase Auth
        # This creates the record in the 'auth' schema
        auth_response = supabase.auth.sign_up({
            "email": email,
            "password": password,
        })

        if not auth_response.user:
            return {"status": "error", "message": "Auth signup failed."}

        user_id = auth_response.user.id

        # Step 2: Insert additional profile info into your public.users table
        # We use the user_id from the Auth step to link them
        profile_data = {
            "id": user_id, # Foreign key to auth.users
            "first_name": first_name,
            "last_name": last_name,
            "phone": phone,
            "email": email,
        }

        profile_response = supabase.table("users").insert(profile_data).execute()

        return {
            "status": "success",
            "message": "User registered. Please check your email for confirmation.",
            "user_id": user_id
        }

    except Exception as e:
        # Handle specific Supabase errors (like user already exists)
        error_msg = str(e)
        if "already registered" in error_msg.lower():
            return {"status": "error", "message": "Email already in use."}
        
        return {"status": "error", "message": error_msg}

def logout_user(token: str):
    """Signs the user out of Supabase to invalidate their session."""
    try:
        # We must pass the user's specific token to sign out that specific session
        res = supabase.auth.admin.sign_out(token)
        return {"status": "success", "message": "Logged out successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}