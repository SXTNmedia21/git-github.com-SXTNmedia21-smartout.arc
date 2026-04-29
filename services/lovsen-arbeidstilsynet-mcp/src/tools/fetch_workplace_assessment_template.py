"""
fetch_workplace_assessment_template.py — MCP tool: fetch a specific risk-assessment template

Tool contract (ADR-0244):
  fetch_workplace_assessment_template(template_id: str) -> Citation

  template_id examples: 'risikovurdering-kjokken'
  Returns ADR-0242 Citation dict with paragraph='template/{id}' and
  verbatim_text containing the full template body.

In fixture mode (LOVSEN_MCP_FIXTURE=1): delegates to fixtures.fixture_fetch_template().
In live mode: fetches the template page from arbeidstilsynet.no.

Error: Unknown template_id → MCP error with "template-not-found" code and list of
available templates. Server MUST NOT crash — MCP error is returned, server stays alive.
"""

from __future__ import annotations

import logging
from typing import Any

from ..arbeidstilsynet_client import FIXTURE_MODE
from ..citation import make_citation, now_utc_iso
from ..fixtures import list_available_templates

logger = logging.getLogger("lovsen.arbeidstilsynet.fetch_template")

_SOURCE_BASE = "https://www.arbeidstilsynet.no"

# Known live template paths on arbeidstilsynet.no
_LIVE_TEMPLATE_PATHS: dict[str, str] = {
    "risikovurdering-kjokken": "/tema/helse-miljo-og-sikkerhet-hms/risikovurdering/risikovurdering-kjokken/",
    "risikovurdering-brann": "/tema/brann-og-eksplosjon/risikovurdering-brann/",
    "risikovurdering-ergonomi": "/tema/ergonomi/risikovurdering-ergonomi/",
}


def fetch_workplace_assessment_template(template_id: str) -> dict[str, Any]:
    """
    Fetch a specific Arbeidstilsynet risk-assessment template.

    Returns a Citation dict with:
      paragraph = 'template/{template_id}'
      verbatim_text = full template body text

    Args:
        template_id: Template identifier, e.g. 'risikovurdering-kjokken'.

    Raises:
        ValueError: Unknown template_id (includes list of available templates).
        RuntimeError: Live fetch failure (live mode only).
    """
    if FIXTURE_MODE:
        from ..fixtures import fixture_fetch_template
        try:
            result = fixture_fetch_template(template_id)
            logger.info("fetch_template [fixture] template_id=%r → OK", template_id)
            return result
        except ValueError as exc:
            # Re-raise with enriched message including available templates
            available = list_available_templates()
            raise ValueError(
                f"template-not-found: {exc}. Available fixture templates: {available}"
            ) from exc

    # Live mode
    return _live_fetch_template(template_id)


def _live_fetch_template(template_id: str) -> dict[str, Any]:
    """Fetch template from arbeidstilsynet.no live page."""
    from ..arbeidstilsynet_client import fetch_arbeidstilsynet_page
    import re

    path = _LIVE_TEMPLATE_PATHS.get(template_id)
    if path is None:
        available = list(_LIVE_TEMPLATE_PATHS.keys())
        raise ValueError(
            f"template-not-found: unknown template_id={template_id!r}. "
            f"Available: {available}"
        )

    logger.info("fetch_template [live] template_id=%r path=%s", template_id, path)
    html = fetch_arbeidstilsynet_page(path)

    # Strip HTML tags and extract body text
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()

    if not text or len(text) < 50:
        raise RuntimeError(
            f"fetch_template: empty or too-short response from {path!r}"
        )

    # Take up to 2000 chars for the template body
    excerpt = text[:2000].strip()
    url = f"{_SOURCE_BASE}{path}"

    return make_citation(
        lov="arbeidstilsynet-risikovurdering",
        paragraph=f"template/{template_id}",
        verbatim_text=excerpt,
        source_url=url,
        fetched_at=now_utc_iso(),
    ).model_dump()
