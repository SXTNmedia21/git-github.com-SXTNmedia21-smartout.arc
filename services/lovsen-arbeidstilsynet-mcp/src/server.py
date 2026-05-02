"""
server.py — Lovsen Arbeidstilsynet MCP stdio entrypoint (P1.S1c)

Registers 2 tools per ADR-0244:
  - search_guidance         → list[Citation]  (ADR-0242)
  - fetch_workplace_assessment_template → Citation  (ADR-0242)

All tools return ADR-0242-compliant Citation JSON.
Logging goes to stderr only — MCP protocol uses stdin/stdout.

Usage:
  LOVSEN_MCP_FIXTURE=1 python -m src.server   # fixture/offline mode — no network
  python -m src.server                          # live mode (rate-limited 1 req/sec)

Reference:
  docs/decisions/0244-lovsen-mcp-boundary.md
  docs/decisions/0242-lovsen-citation-contract.md
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys

import mcp.server.stdio
import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions

from .tools.search_guidance import search_guidance
from .tools.fetch_workplace_assessment_template import fetch_workplace_assessment_template

# --- Logging — stderr only (stdout is reserved for MCP JSON-RPC) ---
_handler = logging.StreamHandler(sys.stderr)
_handler.setFormatter(
    logging.Formatter("%(asctime)s [arbeidstilsynet-mcp] %(levelname)s %(message)s")
)
logger = logging.getLogger("lovsen.arbeidstilsynet.server")
logger.addHandler(_handler)
logger.setLevel(logging.INFO)
logger.propagate = False

# --- MCP Server ---
server = Server("lovsen-arbeidstilsynet-mcp")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    """Declare the 2 tools exposed by this MCP server (ADR-0244)."""
    return [
        types.Tool(
            name="search_guidance",
            description=(
                "Search Arbeidstilsynet.no for Norwegian workplace-safety guidance (veiledninger). "
                "Returns a list of ADR-0242 Citation objects with verbatim text, SHA-256 hash, "
                "ISO-8601 fetched_at, and source URL. "
                "Use scope to narrow to a domain: 'hms', 'risikovurdering', or 'arbeidstid'. "
                "In fixture mode (LOVSEN_MCP_FIXTURE=1) returns pre-seeded fixtures — no HTTP."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Full-text search query (Norwegian preferred), e.g. 'systematisk HMS'",
                    },
                    "scope": {
                        "type": "string",
                        "description": (
                            "Optional domain filter: 'hms', 'risikovurdering', or 'arbeidstid'. "
                            "Omit for broad search."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results to return (default 10, max 50)",
                        "default": 10,
                    },
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="fetch_workplace_assessment_template",
            description=(
                "Fetch a specific Arbeidstilsynet risk-assessment template (risikovurdering). "
                "Returns an ADR-0242 Citation with verbatim template body and source URL. "
                "paragraph field is 'template/{template_id}'. "
                "Known template IDs: 'risikovurdering-kjokken'. "
                "Unknown template_id returns an error with a list of available templates. "
                "In fixture mode (LOVSEN_MCP_FIXTURE=1) returns pre-seeded fixture — no HTTP."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "template_id": {
                        "type": "string",
                        "description": (
                            "Template identifier. Known values: 'risikovurdering-kjokken'. "
                            "Use search_guidance first to discover available templates."
                        ),
                    },
                },
                "required": ["template_id"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(
    name: str,
    arguments: dict,
) -> list[types.TextContent]:
    """
    Dispatch MCP tool calls to the appropriate handler.

    Returns list[TextContent] with JSON-encoded result.
    Errors are returned as structured JSON — server MUST NOT crash on bad input.
    """
    logger.info("call_tool name=%s arguments=%s", name, arguments)

    try:
        if name == "search_guidance":
            result = search_guidance(
                query=arguments["query"],
                scope=arguments.get("scope"),
                limit=int(arguments.get("limit", 10)),
            )
        elif name == "fetch_workplace_assessment_template":
            result = fetch_workplace_assessment_template(
                template_id=arguments["template_id"],
            )
        else:
            raise ValueError(f"Unknown tool: {name!r}")

        return [types.TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    except (ValueError, FileNotFoundError) as exc:
        # Client errors — return MCP error payload; server stays alive
        logger.warning("tool %r client error: %s", name, exc)
        error_payload = {
            "error": type(exc).__name__,
            "message": str(exc),
            "tool": name,
        }
        return [types.TextContent(type="text", text=json.dumps(error_payload, ensure_ascii=False))]

    except Exception as exc:
        # Unexpected errors — log full traceback; return error payload; never crash
        logger.error("tool %r unexpected error: %s", name, exc, exc_info=True)
        error_payload = {
            "error": type(exc).__name__,
            "message": str(exc),
            "tool": name,
        }
        return [types.TextContent(type="text", text=json.dumps(error_payload, ensure_ascii=False))]


async def _run() -> None:
    """Run the MCP stdio server."""
    logger.info("lovsen-arbeidstilsynet-mcp starting (stdio transport)")
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="lovsen-arbeidstilsynet-mcp",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities={},
                ),
            ),
        )


def main() -> None:
    """Entry point — called via `python -m src.server` or the installed script."""
    asyncio.run(_run())


if __name__ == "__main__":
    main()
