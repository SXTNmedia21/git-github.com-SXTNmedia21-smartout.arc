"""
server.py — Lovsen Mattilsynet MCP stdio server

Registers 3 tools per ADR-0244:
  - search_regulation
  - fetch_guidance
  - lookup_food_safety_requirement

All tools return ADR-0242-compliant Citation JSON.

Logging goes to stderr only — MCP protocol uses stdin/stdout.

Usage:
  LOVSEN_MCP_FIXTURE=1 python -m server   # fixture/offline mode
  python -m server                         # live mode (rate-limited)

Reference:
  docs/decisions/0244-lovsen-mcp-boundary.md
  docs/decisions/0242-lovsen-citation-contract.md
"""

from __future__ import annotations

import logging
import sys

import mcp.server.stdio
import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions

from tools.search_regulation import run_search_regulation
from tools.fetch_guidance import run_fetch_guidance
from tools.lookup_food_safety_requirement import run_lookup_food_safety_requirement

# --- Logging — stderr only ---
_handler = logging.StreamHandler(sys.stderr)
_handler.setFormatter(logging.Formatter("%(asctime)s [mattilsynet-mcp] %(levelname)s %(message)s"))
logger = logging.getLogger("lovsen.mattilsynet.server")
logger.addHandler(_handler)
logger.setLevel(logging.INFO)
logger.propagate = False

# --- MCP Server ---
server = Server("lovsen-mattilsynet-mcp")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    """Declare the 3 tools exposed by this MCP server."""
    return [
        types.Tool(
            name="search_regulation",
            description=(
                "Search Mattilsynet.no for Norwegian food-safety regulations and circulars. "
                "Returns a list of ADR-0242 Citation objects with verbatim paragraph text, "
                "SHA-256 hash, and source URL. Use scope to narrow to a domain "
                "(e.g. 'alkohol', 'hygiene', 'allergener')."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Full-text search query (Norwegian preferred)",
                    },
                    "scope": {
                        "type": "string",
                        "description": (
                            "Optional domain filter: 'alkohol', 'hygiene', "
                            "'allergener', 'bevilling', 'merking'. Omit for broad search."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results to return (default 10, max 20)",
                        "default": 10,
                    },
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="fetch_guidance",
            description=(
                "Fetch a published Mattilsynet guidance document (veiledning) by topic slug. "
                "Returns an ADR-0242 Citation with verbatim text and Mattilsynet source URL. "
                "Known slugs: 'alkohol-aldersgrense', 'allergener-merking', "
                "'hygiene-temperatur', 'bevilling-servering'."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": (
                            "Topic slug identifying the guidance document. "
                            "Examples: 'alkohol-aldersgrense', 'allergener-merking', "
                            "'hygiene-temperatur', 'bevilling-servering'."
                        ),
                    },
                },
                "required": ["topic"],
            },
        ),
        types.Tool(
            name="lookup_food_safety_requirement",
            description=(
                "Fetch a specific Norwegian food-safety requirement by category. "
                "Returns an ADR-0242 Citation with verbatim requirement text and source URL. "
                "Known categories: 'kjolekjede', 'allergener', 'bevilling', 'hygiene', "
                "'aldersgrense-alkohol', 'merking'."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": (
                            "Requirement category. Known values: 'kjolekjede', 'allergener', "
                            "'bevilling', 'hygiene', 'aldersgrense-alkohol', 'merking'."
                        ),
                    },
                },
                "required": ["category"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(
    name: str,
    arguments: dict,
) -> list[types.TextContent]:
    """Dispatch MCP tool calls to the appropriate handler."""
    logger.info(f"Tool call: {name} args={arguments}")

    try:
        if name == "search_regulation":
            result = run_search_regulation(
                query=arguments["query"],
                scope=arguments.get("scope"),
                limit=int(arguments.get("limit", 10)),
            )
        elif name == "fetch_guidance":
            result = run_fetch_guidance(topic=arguments["topic"])
        elif name == "lookup_food_safety_requirement":
            result = run_lookup_food_safety_requirement(category=arguments["category"])
        else:
            raise ValueError(f"Unknown tool: {name!r}")

        import json as _json
        return [types.TextContent(type="text", text=_json.dumps(result, ensure_ascii=False, indent=2))]

    except Exception as exc:
        logger.error(f"Tool {name!r} failed: {exc}", exc_info=True)
        # Return MCP error as structured JSON instead of crashing the server
        import json as _json
        error_payload = {
            "error": type(exc).__name__,
            "message": str(exc),
            "tool": name,
        }
        return [types.TextContent(type="text", text=_json.dumps(error_payload, ensure_ascii=False))]


async def _run() -> None:
    """Run the stdio MCP server."""
    logger.info("lovsen-mattilsynet-mcp starting (stdio)")
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="lovsen-mattilsynet-mcp",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities={},
                ),
            ),
        )


def main() -> None:
    """Entry point — called by the `lovsen-mattilsynet-mcp` script."""
    import asyncio
    asyncio.run(_run())


if __name__ == "__main__":
    main()
