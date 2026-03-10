"""Plain text extraction with encoding detection."""

from typing import Any


async def extract_text(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """Extract plain text with encoding detection."""
    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1")

    return {
        "filename": filename,
        "content_type": "text/plain",
        "text": text if text.strip() else None,
        "images": [],
        "pages": None,
        "characters": len(text.strip()),
        "method": "passthrough",
    }
