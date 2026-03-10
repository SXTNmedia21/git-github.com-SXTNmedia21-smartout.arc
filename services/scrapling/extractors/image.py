"""Image handling — validate and encode as base64."""

import base64
import io
from typing import Any

from PIL import Image


async def extract_image(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """Validate image and return as base64-encoded PNG."""
    img = Image.open(io.BytesIO(file_bytes))
    img.verify()  # Validate it's a real image

    # Re-open after verify (verify closes the file)
    img = Image.open(io.BytesIO(file_bytes))

    # Determine output format
    original_format = img.format or "PNG"
    if original_format.upper() == "WEBP":
        output_format = "PNG"
        output_type = "png"
    else:
        output_format = original_format.upper()
        output_type = original_format.lower()
        if output_type == "jpeg":
            output_type = "jpeg"

    width, height = img.size

    buf = io.BytesIO()
    img.save(buf, format=output_format)
    b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "filename": filename,
        "content_type": f"image/{output_type}",
        "text": None,
        "images": [
            {
                "page": None,
                "index": 0,
                "base64": b64,
                "type": output_type,
                "width": width,
                "height": height,
            }
        ],
        "pages": None,
        "characters": 0,
        "method": "passthrough",
    }
