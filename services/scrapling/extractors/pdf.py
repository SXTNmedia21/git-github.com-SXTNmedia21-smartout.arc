"""PDF extraction — pymupdf4llm for markdown, pymupdf for images, pdfplumber fallback."""

import base64
import io
import tempfile
from typing import Any

import fitz  # pymupdf
import pymupdf4llm


async def extract_pdf(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """Extract text as markdown + embedded images from a PDF."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as tmp:
        tmp.write(file_bytes)
        tmp.flush()

        # Layer 1: pymupdf4llm for structured markdown
        try:
            text = pymupdf4llm.to_markdown(tmp.name)
        except Exception:
            text = ""

        # Layer 2: pymupdf for image extraction
        images = _extract_images(tmp.name)

        # Layer 3: pdfplumber fallback if very little text extracted
        method = "pymupdf4llm"
        if len(text.strip()) < 100:
            fallback_text = _pdfplumber_fallback(tmp.name)
            if fallback_text and len(fallback_text) > len(text):
                text = fallback_text
                method = "pdfplumber"

        # Page count
        doc = fitz.open(tmp.name)
        pages = len(doc)
        doc.close()

    if not text.strip() and not images:
        raise ExtractionError("Could not extract text from file. PDF appears to be scanned with no extractable text.")

    return {
        "filename": filename,
        "content_type": "application/pdf",
        "text": text.strip() if text.strip() else None,
        "images": images,
        "pages": pages,
        "characters": len(text.strip()),
        "method": method,
    }


def _extract_images(file_path: str) -> list[dict[str, Any]]:
    """Extract embedded images from PDF pages."""
    images = []
    doc = fitz.open(file_path)
    try:
        for page_num in range(len(doc)):
            page = doc[page_num]
            for img_index, img in enumerate(page.get_images()):
                xref = img[0]
                try:
                    pix = fitz.Pixmap(doc, xref)
                    # Convert CMYK to RGB
                    if pix.n > 4:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    # Skip tiny images (icons, bullets)
                    if pix.width < 50 or pix.height < 50:
                        continue
                    png_bytes = pix.tobytes("png")
                    images.append({
                        "page": page_num + 1,
                        "index": img_index,
                        "base64": base64.b64encode(png_bytes).decode(),
                        "type": "png",
                        "width": pix.width,
                        "height": pix.height,
                    })
                except Exception:
                    continue
    finally:
        doc.close()
    return images


def _pdfplumber_fallback(file_path: str) -> str:
    """Use pdfplumber to extract tables and text as a fallback."""
    try:
        import pdfplumber

        parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                # Extract tables first
                tables = page.extract_tables()
                for table in tables:
                    if not table:
                        continue
                    rows = []
                    for row in table:
                        cells = [str(c).strip() if c else "" for c in row]
                        rows.append("| " + " | ".join(cells) + " |")
                    if rows:
                        header_sep = "| " + " | ".join(["---"] * len(table[0])) + " |"
                        rows.insert(1, header_sep)
                        parts.append("\n".join(rows))

                # Also grab page text
                page_text = page.extract_text()
                if page_text:
                    parts.append(page_text)

        return "\n\n".join(parts)
    except Exception:
        return ""


class ExtractionError(Exception):
    """Raised when extraction fails in an expected way."""
    pass
