"""
server.py — Lovsen NHO Reiseliv MCP stdio entrypoint (P1.S1d)

Registers 2 tools per ADR-0244:
  - fetch_riksavtalen          → Citation | dict  (ADR-0242)
  - lookup_tariff_supplement   → Citation          (ADR-0242)

All tools are version-aware — explicit version arg required; no silent fallback.
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

from .tools.fetch_riksavtalen import fetch_riksavtalen
from .tools.lookup_tariff_supplement import lookup_tariff_supplement

# --- Logging — stderr only (stdout is reserved for MCP JSON-RPC) ---
_handler = logging.StreamHandler(sys.stderr)
_handler.setFormatter(
    logging.Formatter("%(asctime)s [nho-reiseliv-mcp] %(levelname)s %(message)s")
)
logger = logging.getLogger("lovsen.nho_reiseliv.server")
logger.addHandler(_handler)
logger.setLevel(logging.INFO)
logger.propagate = False

# --- MCP Server ---
server = Server("lovsen-nho-reiseliv-mcp")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    """Declare the 2 tools exposed by this MCP server (ADR-0244)."""
    return [
        types.Tool(
            name="fetch_riksavtalen",
            description=(
                "Fetch a specific Riksavtalen paragraph for an explicit agreement version. "
                "Riksavtalen is the NHO Reiseliv / LO collective tariff agreement governing "
                "wages, supplements, and working-hours rules for Norwegian hospitality workers. "
                "Returns an ADR-0242 Citation with verbatim text, SHA-256 hash, ISO-8601 "
                "fetched_at, and source URL. "
                "IMPORTANT: version is required — never defaults to latest (version-confusion "
                "is the primary risk for tariff agents). "
                "If paragraph is omitted, returns metadata only. "
                "In fixture mode (LOVSEN_MCP_FIXTURE=1) returns pre-seeded fixture — no HTTP."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "version": {
                        "type": "string",
                        "description": (
                            "Riksavtalen agreement year — '2024' or '2025'. "
                            "REQUIRED. No silent fallback to latest. "
                            "Mismatched version returns an error listing supported versions."
                        ),
                    },
                    "paragraph": {
                        "type": "string",
                        "description": (
                            "Optional paragraph reference, e.g. '§6.1' (kveldstillegg) "
                            "or '§5' (garantilønn). If omitted, returns metadata."
                        ),
                    },
                },
                "required": ["version"],
            },
        ),
        types.Tool(
            name="lookup_tariff_supplement",
            description=(
                "Look up a specific Riksavtalen tariff supplement (tillegg) for an explicit version. "
                "Returns an ADR-0242 Citation with verbatim rate text, SHA-256 hash, and source URL. "
                "paragraph field in Citation: 'riksavtalen_{version}/{category}'. "
                "Supported categories: 'kveldstillegg', 'garantilonn' (also 'garantilønn'). "
                "IMPORTANT: version is required — never defaults to latest. "
                "Mismatched or unsupported version returns an error listing supported versions. "
                "In fixture mode (LOVSEN_MCP_FIXTURE=1) returns pre-seeded fixture — no HTTP."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": (
                            "Supplement category. "
                            "Supported: 'kveldstillegg' (evening supplement), "
                            "'garantilonn' or 'garantilønn' (minimum wage guarantee)."
                        ),
                    },
                    "version": {
                        "type": "string",
                        "description": (
                            "Riksavtalen agreement year — '2024' or '2025'. "
                            "REQUIRED. No silent fallback to latest."
                        ),
                    },
                },
                "required": ["category", "version"],
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
        if name == "fetch_riksavtalen":
            result = fetch_riksavtalen(
                version=arguments["version"],
                paragraph=arguments.get("paragraph"),
            )
        elif name == "lookup_tariff_supplement":
            result = lookup_tariff_supplement(
                category=arguments["category"],
                version=arguments["version"],
            )
        else:
            raise ValueError(f"Unknown tool: {name!r}")

        return [
            types.TextContent(
                type="text",
                text=json.dumps(result, ensure_ascii=False, indent=2),
            )
        ]

    except (ValueError, FileNotFoundError) as exc:
        # Client errors — return structured MCP error; server stays alive
        logger.warning("tool %r client error: %s", name, exc)
        error_payload = {
            "error": type(exc).__name__,
            "message": str(exc),
            "tool": name,
        }
        return [
            types.TextContent(
                type="text",
                text=json.dumps(error_payload, ensure_ascii=False),
            )
        ]

    except Exception as exc:
        # Unexpected errors — log full traceback; return error payload; never crash
        logger.error("tool %r unexpected error: %s", name, exc, exc_info=True)
        error_payload = {
            "error": type(exc).__name__,
            "message": str(exc),
            "tool": name,
        }
        return [
            types.TextContent(
                type="text",
                text=json.dumps(error_payload, ensure_ascii=False),
            )
        ]


async def _run() -> None:
    """Run the MCP stdio server."""
    logger.info("lovsen-nho-reiseliv-mcp starting (stdio transport)")
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="lovsen-nho-reiseliv-mcp",
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
