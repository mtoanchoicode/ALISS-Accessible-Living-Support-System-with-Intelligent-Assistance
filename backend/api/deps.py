from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.user_service import supabase

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # 1. Get the Auth user
        auth_response = supabase.auth.get_user(token)
        if not auth_response or not auth_response.user:
            raise ValueError("Invalid session")
        
        user_id = auth_response.user.id

        # 2. Fetch the custom data from your public table
        user_data = supabase.table("users").select("*").eq("id", user_id).single().execute()
        
        # Merge them or return the profile data
        return user_data.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
