"""
server.py — Lovdata MCP stdio entrypoint.

Exposes 5 tools via MCP stdio transport (ADR-0244):
  - fetch_paragraph             → Citation (ADR-0242)
  - fetch_riksavtalen_paragraph → Citation (ADR-0256) — Riksavtalen via Lovdata TARO
  - search_law                  → list[Citation]
  - get_law_metadata            → metadata dict
  - verify_citation_freshness   → list[FreshnessResult] (ADR-0342/ADR-0347)

Run:
    LOVSEN_FIXTURE_MODE=true python -m src.server  (fixture mode — no network, ADR-0258 canonical)
    python -m src.server                            (live mode — rate-limited)
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys

import mcp
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from .tools.fetch_paragraph import fetch_paragraph
from .tools.fetch_riksavtalen_paragraph import fetch_riksavtalen_paragraph
from .tools.search_law import search_law
from .tools.get_law_metadata import get_law_metadata
from .tools.verify_citation_freshness import verify_citation_freshness

logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="%(asctime)s %(levelname)s [lovdata-mcp] %(message)s",
)
logger = logging.getLogger(__name__)

# ── Tool definitions ──────────────────────────────────────────────────────────

_TOOLS = [
    Tool(
        name="fetch_riksavtalen_paragraph",
        description=(
            "Fetch a specific paragraph from Riksavtalen (NHO Reiseliv tariff agreement) "
            "via Lovdata.no TARO namespace. "
            "Returns ADR-0256-compliant Citation JSON with verbatim text, SHA-256 hash, "
            "ISO-8601 fetched_at, Lovdata TARO source URL, and law_version. "
            "version is REQUIRED — no silent fallback per ADR-0258 (tariff rates change "
            "between agreement periods; version confusion is a legal accuracy failure). "
            "In fixture mode (LOVSEN_FIXTURE_MODE=true) reads from local fixtures — no HTTP."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "taro_id": {
                    "type": "string",
                    "description": (
                        "Lovdata TARO identifier for the agreement, e.g. 'taro-79' "
                        "(Riksavtalen hotell/restaurant) or 'taro-226'. Required."
                    ),
                },
                "paragraph": {
                    "type": "string",
                    "description": (
                        "Paragraph reference, e.g. '§4-3', '4-3', or '4-3.1' (auto-normalized). "
                        "Required."
                    ),
                },
                "version": {
                    "type": "string",
                    "description": (
                        "Agreement version period, e.g. '2024-2026'. "
                        "REQUIRED — no default, no silent fallback (ADR-0258)."
                    ),
                },
                "ledd": {
                    "type": "string",
                    "description": "Optional sub-paragraph (ledd), e.g. '1' for first ledd.",
                },
            },
            "required": ["taro_id", "paragraph", "version"],
        },
    ),
    Tool(
        name="fetch_paragraph",
        description=(
            "Fetch a specific paragraph from a Norwegian law on Lovdata.no. "
            "Returns ADR-0242-compliant Citation JSON with verbatim text, SHA-256 hash, "
            "ISO-8601 fetched_at, and source URL. "
            "In fixture mode (LOVSEN_FIXTURE_MODE=true) reads from local fixtures — no HTTP."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "lov": {
                    "type": "string",
                    "description": "Law abbreviation, e.g. 'aml' (Arbeidsmiljøloven), 'ferielov', 'ftrl'",
                },
                "paragraph": {
                    "type": "string",
                    "description": "Paragraph reference, e.g. '14-6' (do not include §)",
                },
                "ledd": {
                    "type": "string",
                    "description": "Optional sub-section (ledd), e.g. '1' or '2'",
                },
            },
            "required": ["lov", "paragraph"],
        },
    ),
    Tool(
        name="search_law",
        description=(
            "Full-text search within a Norwegian law on Lovdata.no. "
            "Returns a ranked list of ADR-0242-compliant Citation dicts. "
            "In fixture mode searches across local fixture files — no HTTP."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Free-text query, e.g. 'prøvetid' or 'oppsigelse varsel'",
                },
                "lov": {
                    "type": "string",
                    "description": "Optional law filter, e.g. 'aml'. Omit to search all laws.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max number of results (default 10, max 50)",
                    "default": 10,
                },
            },
            "required": ["query"],
        },
    ),
    Tool(
        name="get_law_metadata",
        description=(
            "Get metadata for a Norwegian law: full name, version, last_updated date, "
            "total paragraph count, and Lovdata source URL. "
            "In fixture mode derives metadata from available fixtures — no HTTP."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "lov": {
                    "type": "string",
                    "description": "Law abbreviation, e.g. 'aml'",
                },
            },
            "required": ["lov"],
        },
    ),
    Tool(
        name="verify_citation_freshness",
        description=(
            "Check freshness of 1–100 citation hashes against Lovdata.no. "
            "Each hash is a 64-char lowercase hex SHA-256 produced by a previous "
            "fetch_paragraph or fetch_riksavtalen_paragraph call. "
            "Returns list of FreshnessResult with stale flag, paragraph_ref, checked_at, "
            "and source='lovdata' (ADR-0342 Method contract, ADR-0347). "
            "In fixture mode (LOVSEN_FIXTURE_MODE=true) all hashes return stale=false — "
            "no network I/O."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "hashes": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "1–100 SHA-256 hashes (64-char lowercase hex). "
                        "Each entry must match [0-9a-f]{64}."
                    ),
                },
            },
            "required": ["hashes"],
        },
    ),
]

# ── Server setup ──────────────────────────────────────────────────────────────

server = Server("lovsen-lovdata-mcp")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """Return the 5 registered Lovdata tools."""
    return _TOOLS


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """
    Dispatch tool call to the appropriate handler.
    Returns list[TextContent] with JSON-encoded result.
    Errors are surfaced as MCP error responses (via exception propagation).
    """
    logger.info("call_tool name=%s arguments=%s", name, arguments)

    try:
        if name == "fetch_riksavtalen_paragraph":
            result = fetch_riksavtalen_paragraph(
                taro_id=arguments["taro_id"],
                paragraph=arguments["paragraph"],
                version=arguments["version"],
                ledd=arguments.get("ledd"),
            )
            return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False))]

        elif name == "fetch_paragraph":
            result = await fetch_paragraph(
                lov=arguments["lov"],
                paragraph=arguments["paragraph"],
                ledd=arguments.get("ledd"),
            )
            return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False))]

        elif name == "search_law":
            result = await search_law(
                query=arguments["query"],
                lov=arguments.get("lov"),
                limit=int(arguments.get("limit", 10)),
            )
            return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False))]

        elif name == "get_law_metadata":
            result = await get_law_metadata(lov=arguments["lov"])
            return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False))]

        elif name == "verify_citation_freshness":
            result = verify_citation_freshness(
                hashes=arguments["hashes"],
            )
            return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False))]

        else:
            raise ValueError(f"Unknown tool: {name!r}")

    except (ValueError, FileNotFoundError) as exc:
        # Re-raise so MCP layer converts to error response
        logger.error("tool error name=%s: %s", name, exc)
        raise


# ── Entrypoint ────────────────────────────────────────────────────────────────


async def main() -> None:
    logger.info("lovsen-lovdata-mcp starting (stdio transport)")
    async with stdio_server() as (read_stream, write_stream):
        init_options = server.create_initialization_options()
        await server.run(read_stream, write_stream, init_options)


if __name__ == "__main__":
    asyncio.run(main())
