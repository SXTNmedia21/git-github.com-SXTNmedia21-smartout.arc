---
title: "L-0286 — Ontology fiction in ADRs: external source routing declared without live proof"
id: L_0286
status: active
date: 2026-05-17
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [adr, external-source, lovsen, nho-reiseliv, lovdata, riksavtalen, source-routing]
related_adrs: [ADR-0258, ADR-0347]
related_learnings: [L-0176]
---

# L-0286 — Ontology fiction in ADRs

## Discovery

Phase 7 pre-flight (2026-05-17) ran a live curl against the NHO Reiseliv URL declared in ADR-0258 as the Riksavtalen canonical source routing target.

```
curl -I https://www.nhoreiseliv.no/riksavtalen/
→ HTTP 404
```

ADR-0258 was accepted in 2026-05-08 with this routing as authoritative. nhoreiseliv.no has not hosted Riksavtalen at any HTML URL matching the declared pattern. The MCP (`services/lovsen-nho-reiseliv-mcp/`) was built and the tool was shipped — but its upstream "canonical source" was speculative, declared as ontological truth, and never proven against a live HTTP response.

ADR-0342 inherited the fiction: its routing table maps `nho-reiseliv` → `services/lovsen-nho-reiseliv-mcp/` for Riksavtalen citations. Stale-detection (ADR-0341) cannot detect staleness against a source that does not exist.

Lovdata.no (HTTP 200, paragraph-addressable) is the actual statutory canonical. Council approved reframe (ADR-0347).

## Rule

ADRs declaring external source routing (MCP targets, API endpoints, canonical legal databases) MUST include:

1. **Live-curl proof at acceptance time** — HTTP 200 confirmed, parseable response body shape attached as acceptance evidence in the ADR body or a linked artifact.
2. **Reproducible verification command** — any reviewer can re-run the proof (e.g., `curl -I <url>`).
3. **URL pattern stability justification** — one sentence explaining why the URL pattern is expected to be stable (e.g., "statutory authority, stable scheme since YYYY").

If live proof is unavailable at acceptance time, the ADR must carry `status: provisional` until proof is attached. Provisional ADRs may not be cited as canonical routing by downstream ADRs.

## Sibling

- L-0176 — Docstring drift at code layer: capability tool docstrings claimed ADR compliance while the body violated it. Same pattern — declaration as truth without verifying the underlying reality. L-0286 is the ADR-layer sibling.

## Detection signal

The stale-detection system (ADR-0341/ADR-0342) reported "cannot verify freshness" as a symptom. The root cause was not a stale source — the source was fictional. Distinction matters: fictional source = architecture defect; stale source = operational maintenance. Different remediation paths.
