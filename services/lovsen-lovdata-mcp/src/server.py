"""
server.py — Lovdata MCP stdio entrypoint.

Exposes 3 tools via MCP stdio transport (ADR-0244):
  - fetch_paragraph  → Citation (ADR-0242)
  - search_law       → list[Citation]
  - get_law_metadata → metadata dict

Run:
    LOVSEN_MCP_FIXTURE=1 python -m src.server  (fixture mode — no network)
    python -m src.server                        (live mode — rate-limited)
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
from .tools.search_law import search_law
from .tools.get_law_metadata import get_law_metadata

logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="%(asctime)s %(levelname)s [lovdata-mcp] %(message)s",
)
logger = logging.getLogger(__name__)

# ── Tool definitions ──────────────────────────────────────────────────────────

_TOOLS = [
    Tool(
        name="fetch_paragraph",
        description=(
            "Fetch a specific paragraph from a Norwegian law on Lovdata.no. "
            "Returns ADR-0242-compliant Citation JSON with verbatim text, SHA-256 hash, "
            "ISO-8601 fetched_at, and source URL. "
            "In fixture mode (LOVSEN_MCP_FIXTURE=1) reads from local fixtures — no HTTP."
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
]

# ── Server setup ──────────────────────────────────────────────────────────────

server = Server("lovsen-lovdata-mcp")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """Return the 3 registered Lovdata tools."""
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
        if name == "fetch_paragraph":
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
