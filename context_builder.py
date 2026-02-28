import os
import base64
import io
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image
from supabase_vector_db import insert_row

load_dotenv()
_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError("OPENAI_API_KEY not found in environment / .env")
        _client = OpenAI(api_key=api_key)
    return _client


def _to_base64_jpeg(image) -> str:
    """
    Accept:
      - numpy/cv2 BGR ndarray
      - PIL.Image
      - file path (str / Path)
    Returns base64-encoded JPEG string.
    """
    if isinstance(image, (str, Path)):
        img = Image.open(image).convert("RGB")
    elif hasattr(image, "shape"):           # numpy / cv2
        import numpy as np
        rgb = image[..., ::-1] if image.ndim == 3 else image   # BGR→RGB
        img = Image.fromarray(rgb.astype("uint8"))
    elif isinstance(image, Image.Image):
        img = image.convert("RGB")
    else:
        raise TypeError(f"Unsupported image type: {type(image)}")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def describe_background(obj_name: str, image, model: str = "gpt-4o") -> str:
    b64 = _to_base64_jpeg(image)
    client = _get_client()

    prompt = (
    f"This image contains a '{obj_name}'. "
    "Describe the object’s appearance (color, material, texture, condition). "
    "Then describe what it is resting on and any nearby objects visible in the image. "
    "Do not describe lighting or overall environment. "
    "Keep the response to 1 clear sentences."
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
        max_tokens=300,
    )

    return response.choices[0].message.content.strip()

import numpy as np
EMBED_DIM=384

# POST gui len obj, image

def describe_and_save(
    obj_name: str,
    image,
    model: str = "gpt-4o",
) -> dict:
    print(f"[vision_module] Describing background for object: '{obj_name}' ...")
    background = describe_background(obj_name=obj_name, image=image, model=model)
    print(f"[vision_module] Background: {background}")

    # thieu embedding (embedding), va text ()
    fake_embedding = np.random.rand(EMBED_DIM).tolist()

    record = dict(
        obj=obj_name,
        background=background,
        text=" ",
        embedding=fake_embedding,
    )
    print(record)
    insert_row(**record)
    return record