"""CSV extraction — stdlib csv with auto-detected delimiter."""

import csv
import io
from typing import Any


async def extract_csv(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """Extract CSV content with auto-detected delimiter."""
    # Try utf-8 first, fallback to latin-1
    try:
        content = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = file_bytes.decode("latin-1")

    # Auto-detect delimiter
    sample = content[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample)
    except csv.Error:
        dialect = csv.excel  # Default to comma-separated

    reader = csv.reader(io.StringIO(content), dialect)
    rows: list[str] = []
    for row in reader:
        cells = [c.strip() for c in row]
        if any(cells):
            rows.append("| " + " | ".join(cells) + " |")

    # Add markdown table header after first row
    if len(rows) >= 1:
        first_col_count = rows[0].count("|") - 1
        header_sep = "| " + " | ".join(["---"] * max(first_col_count, 1)) + " |"
        rows.insert(1, header_sep)

    text = "\n".join(rows)

    return {
        "filename": filename,
        "content_type": "text/csv",
        "text": text if text else None,
        "images": [],
        "pages": None,
        "characters": len(text),
        "method": "csv",
    }
