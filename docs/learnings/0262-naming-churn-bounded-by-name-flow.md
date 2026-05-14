---
title: "Naming churn cost bounded by where names flow, not by count alone"
id: L-0262
status: canonical
created: 2026-05-14
updated: 2026-05-14
module: governance
tags: [council, naming, page-tools, code-trace, adr-0325, l-0147]
---

# L-0262: Naming churn cost bounded by name flow

## Context

2026-05-14 ADR-0325 council. The briefing claimed Option A (wholesale rename of 241 tool names to `<slug>.<tool>`) would "break LLM/voice/stage-engine." This was used to argue that Option A's cost was prohibitive.

Agent-Coord code-trace disproved the downstream-breakage claim:
- `services/voice-agent/src/adapter.ts:177-186`: voice-agent uses a static capability catalogue, not page-tool registry
- `packages/agent-sdk/src/providers/livekit.ts:38-40`: `registerTool()` is a stub — not yet wired
- `apps/web/src/app/api/wizard/start/route.ts:108-130`: wizard BFF does not forward `selected_tools` from page-tool registry
- `packages/ai/src/prompts/`: zero hits for any page-tool name
- `emma/chat` and `botsson/chat` routes: do not forward page-tool selections

**Result:** Page-tool registry names do NOT reach the LLM today. Wholesale rename is churn (241 files) with zero downstream breakage.

## Learning

**"Renaming is expensive" intuition requires flow-analysis before veto.** The cost of renaming X is not `count(X)` × edit-time — it is `count(consumers-of-X-that-break)` × fix-time. When the downstream consumer count is 0, rename is bounded by the file-edit count alone.

**Counter-detection pattern:** Before estimating rename cost, run the flow-check grep:
```bash
# Does the name reach the LLM?
grep -rn 'modelToolName\|temporaryTool\|registerTool' packages/ai/src/prompts/ services/voice-agent/ 2>/dev/null

# Does the BFF forward page-tool names?
grep -n 'selected_tools\|page.*tool\|tool.*registry' apps/web/src/app/api/botsson/ apps/web/src/app/api/emma/ 2>/dev/null
```

**Cost claims based on assumed downstream consumers MUST cite the file:line that reads the name.** Unacceptable: "Option A breaks the LLM" without a grep showing where the LLM reads page-tool names.

**Note:** This does NOT mean rename costs are zero. The 241 file-edit cost is real. But it is churn (developer time) not breakage (runtime regression). Separate the arguments.

## Cross-references

- ADR-0325 (tool-name discipline — council where this surfaced)
- L-0176 (docstring claims are not evidence — sibling, claims-vs-code-trace)
- L-0147 (Chair self-reversal on falsified briefing claims — parent pattern)
- COUNCIL-LOG.md 2026-05-14 late evening (Agent-Coord Code-Tracer verification)
- Verified file:line citations: `services/voice-agent/src/adapter.ts:177-186`, `packages/agent-sdk/src/providers/livekit.ts:38-40`, `apps/web/src/app/api/wizard/start/route.ts:108-130`
