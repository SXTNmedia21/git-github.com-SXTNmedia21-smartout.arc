"""Document extraction router — maps file types to extractors."""

from pathlib import Path
from typing import Any

from .pdf import extract_pdf
from .docx_ext import extract_docx
from .xlsx import extract_xlsx
from .csv_ext import extract_csv
from .text import extract_text
from .image import extract_image

SUPPORTED_EXTENSIONS = {
    "pdf": extract_pdf,
    "docx": extract_docx,
    "xlsx": extract_xlsx,
    "csv": extract_csv,
    "txt": extract_text,
    "jpg": extract_image,
    "jpeg": extract_image,
    "png": extract_image,
    "webp": extract_image,
}

SUPPORTED_MIMETYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/csv": "csv",
    "text/plain": "txt",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def detect_extension(filename: str, content_type: str | None = None) -> str | None:
    """Detect file extension from filename or MIME type."""
    ext = Path(filename).suffix.lstrip(".").lower()
    if ext in SUPPORTED_EXTENSIONS:
        return ext
    if content_type and content_type in SUPPORTED_MIMETYPES:
        return SUPPORTED_MIMETYPES[content_type]
    return None


async def extract_file(file_bytes: bytes, filename: str, content_type: str | None = None) -> dict[str, Any]:
    """Extract text and images from a file. Returns extraction result dict."""
    ext = detect_extension(filename, content_type)
    if ext is None:
        supported = sorted(SUPPORTED_EXTENSIONS.keys())
        raise ValueError(f"Unsupported file type: .{Path(filename).suffix.lstrip('.')}. Supported: {supported}")

    extractor = SUPPORTED_EXTENSIONS[ext]
    return await extractor(file_bytes, filename)
