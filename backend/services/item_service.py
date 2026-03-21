import os
from supabase import create_client, Client 
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") # Usually the anon key for client-side, or service role for backend admin tasks

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Supabase environment variables are missing!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --------------------------------------------------
# READ
# -------------------------------------------------- 
def get_item(item_id: str):
    """Fetches a single item by its ID."""
    response = supabase.table("items").select("*").eq("id", item_id).single().execute()
    return response.data

# --------------------------------------------------
# DELETE
# -------------------------------------------------- 
def delete_item(item_id: str):
    """Deletes an item by its ID."""
    response = supabase.table("items").delete().eq("id", item_id).execute()
    return response.data

# --------------------------------------------------
# UPDATE
# -------------------------------------------------- 
def update_item(item_id: str, update_data: dict):
    """
    Updates an existing item.
    """
    response = supabase.table("items").update(update_data).eq("id", item_id).execute()
    return response.data

# --------------------------------------------------
# CREATE
# -------------------------------------------------- 
def create_item(item_data: dict):
    """
    Creates a new item. 
    """
    response = supabase.table("items").insert(item_data).execute()
    return response.data