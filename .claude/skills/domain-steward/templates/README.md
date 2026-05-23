---
title: "{Domain} — Domain Index"
status: in_progress
mirror: verified
last_verified: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
created: {YYYY-MM-DD}
domain: {domain-slug}
tags: [domain, {domain-slug}, source-of-truth]
---

# {Domain} — Source of Truth

> Authoritative folder for the **{domain}** domain. If code contradicts this folder → **CODE wins**, update these docs.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| {capability A} | ✅ / 🟡 / 🔴 | ✅ / 🟡 / 🔴 | {1-line} |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix across all domains: [../\_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Tables, FKs, enums, RLS, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | verified | Flow index → journeys |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan + ADR/journey refs |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Built-vs-planned delta |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test = proof of built |

## Agent Guardrails

> Read before touching {domain} code. Truth lives in this folder.

- {Hard trap 1 — e.g. "never write X without gatedMutation (ADR-NNNN)"}
- {Hard trap 2}
- Owning package(s): `{path}` · Edge functions: `{path}` · Tables: `{schema.table, …}`
