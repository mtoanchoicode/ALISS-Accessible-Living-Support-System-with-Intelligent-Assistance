import os
from supabase import create_client, Client 
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL= os.getenv("SUPABASE_URL")
SUPABASE_KEY= os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --------------------------------------------------
# Register
# --------------------------------------------------    
def register(first_name: str, last_name: str, phone: str, email: str, password: str):
    """
    1. Creates user in auth.users (Supabase Auth)
    2. The SQL Trigger (we discussed) will automatically create the row in public.profiles
    3. We then update that profile with the extra metadata
    """
    try:
        # Step 1: Auth Signup
        auth_response = supabase.auth.sign_up({
            "email": email,
            "password": password,
        })
        
        user_id = auth_response.user.id
        
        # Step 2: Update the public.profiles table (created via SQL Trigger)
        # We use the 'public' schema here for your custom fields
        supabase.table("profiles").update({
            "first_name": first_name,
            "last_name": last_name,
            "phone_number": phone
        }).eq("id", user_id).execute()
        
        return {"status": "success", "user_id": user_id}
    
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --------------------------------------------------
# Login
# --------------------------------------------------     
def login(email: str, password: str): 
    """
    Authenticates the user and returns a session/token.
    """
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        return response
    except Exception as e:
        return {"status": "login_failed", "message": str(e)}