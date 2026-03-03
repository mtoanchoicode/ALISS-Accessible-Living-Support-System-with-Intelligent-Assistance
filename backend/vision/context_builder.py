# vision/context_builder.py

import os
import base64
import io
from pathlib import Path
from datetime import datetime
from typing import Union

from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image

from ingest.ingest import upsert_item

load_dotenv()

_client: OpenAI | None = None


# ==========================================================
# OpenAI Client (lazy init)
# ==========================================================
def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError("OPENAI_API_KEY not found in environment /.env")
        _client = OpenAI(api_key=api_key)
    return _client


# ==========================================================
# Convert image → base64 JPEG
# ==========================================================
def _to_base64_jpeg(image: Union[str, Path, Image.Image, object]) -> str:
    """
    Accept:
      - file path (str / Path)
      - numpy/cv2 BGR ndarray
      - PIL.Image

    Returns:
      base64-encoded JPEG string
    """
    if isinstance(image, (str, Path)):
        img = Image.open(image).convert("RGB")

    elif hasattr(image, "shape"):  # numpy / cv2
        import numpy as np

        if image.ndim == 3:
            rgb = image[..., ::-1]  # BGR → RGB
        else:
            rgb = image
        img = Image.fromarray(rgb.astype("uint8"))

    elif isinstance(image, Image.Image):
        img = image.convert("RGB")

    else:
        raise TypeError(f"Unsupported image type: {type(image)}")

    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=90)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


# ==========================================================
# Vision Captioning (Background Description)
# ==========================================================
def describe_background(
    obj_name: str,
    image,
    model: str = "gpt-4o",
) -> str:
    """
    Use GPT-4o Vision to describe object + immediate context.
    """
    client = _get_client()
    b64 = _to_base64_jpeg(image)

    prompt = (
        f"This image contains a '{obj_name}'. "
        "Describe the object's appearance (color, material, texture, condition). "
        "Then describe what it is resting on and any nearby objects visible. "
        "Do NOT describe lighting or overall room environment. "
        "Keep it to 1–2 clear sentences."
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64}",
                            "detail": "high",
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        max_tokens=200,
    )

    return response.choices[0].message.content.strip()


# ==========================================================
# Main Entry: Describe + Store in Memory
# ==========================================================
def describe_and_save(
    obj_name: str,
    image,
    location: str = "camera_capture",
    model: str = "gpt-4o",
) -> dict:
    """
    Full pipeline:
      1. Caption object background via GPT-4o Vision
      2. Store into scene_memory via ingest.upsert_item
      3. Return structured record
    """

    print(f"[vision] Describing object: '{obj_name}' ...")

    try:
        background = describe_background(
            obj_name=obj_name,
            image=image,
            model=model,
        )
    except Exception as e:
        raise RuntimeError(f"Vision description failed: {e}")

    print(f"[vision] Background: {background}")

    ts = datetime.utcnow()

    # Store using YOUR ingestion layer (SentenceTransformer embedding inside)
    upsert_item(
        ts=ts,
        location=location,
        obj=obj_name,
        background=background,
        text="",
    )

    record = {
        "timestamp": ts.isoformat(),
        "object": obj_name,
        "location": location,
        "background": background,
    }

    print("[vision] Saved to memory.")

    return record