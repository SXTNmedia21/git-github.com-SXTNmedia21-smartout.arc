---
title: "Bootstrap Domain — README"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: bootstrap
last_verified: 2026-05-23
mirror: mixed
tags: [bootstrap, workspace-setup, readiness, I1, agent-harness, botsson]
---

# Bootstrap Domain

**Build state:** 🟢 Phase 1 complete (2026-05-23, ADR-0407) — `workspace_bootstrap_gate` table + 3 RPCs + bootstrap capability (list/close/skip gates) + K1a gate registry (11 hospitality / 6 default) + bootstrap-cascade EF Step 12 shipped. Coordinator + session-start hook + week-1 UI aspirational (Phases 2–5).

Bootstrap is the gate-driven, Botsson-orchestrated, week-1 progressive setup of a new workspace. When an admin creates a workspace, Botsson takes over: close the critical gates autonomously, then successively propose work so that within the first week the workspace is fully operational.

This domain is a **meta-layer** — it orchestrates the seeding of cascade dimensions (D1/D2/D3/D4/K1a/K1b) and governance content, but is not itself a cascade dimension. It sits above the cascade, not inside it.

---

## Reading Order

| File | What it holds |
|------|---------------|
| [OVERVIEW.md](./OVERVIEW.md) | What + why + cascade placement |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | L1–L5 code map (verified surfaces + aspirational layers) |
| [DATA-MODEL.md](./DATA-MODEL.md) | Schema: `workspace_bootstrap_run`, `get_workspace_readiness` RPC, proposed schema |
| [USER-FLOWS.md](./USER-FLOWS.md) | Flow index — links to journeys |
| [ROADMAP.md](./ROADMAP.md) | Phase 1–5 forward plan |
| [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | Built vs planned delta + overlap edges |
| [E2E-COVERAGE.md](./E2E-COVERAGE.md) | Test matrix |

---

## Agent Guardrails

**Trap 1 — Bootstrap is agent-driven.**
Do NOT add manual setup steps to `/dashboard/setup/`. The setup wizard (`apps/web/src/app/dashboard/setup/`) is a CURRENT fallback surface for admin self-service. It will be Botsson-driven (Phase 5 — aspirational). Until then it is a tolerated deviation. New setup capabilities MUST be designed for bootstrap-coordinator first; wizard adapter is secondary.

**Trap 2 — Bootstrap gates ≠ C4 authority.**
`workspace_bootstrap_gate` (seed-completeness, ADR-0407, verified) is NOT `engine_authority_config` (capability-permission gate, ADR-0192, verified). Use `engine_authority_config` for "is Botsson allowed to run this capability?". Use `workspace_bootstrap_gate` for "has the workspace been seeded with the data this capability needs?". They are distinct concepts — never merge them.

**Trap 3 — `get_workspace_readiness` RPC is employee-readiness, not seed-completeness.**
The existing `get_workspace_readiness(workspace_id)` RPC (`supabase/migrations/20260322193130_add_workspace_readiness_rpc.sql`) returns per-profile protocol-assignment completion stats. It is used by the `training` capability (`packages/ai/src/capabilities/training/tools.ts:84`). It is NOT a bootstrap seed-completeness gate. Bootstrap seed-completeness uses `workspace_bootstrap_gate` table + `fn_list_open_bootstrap_gates` RPC (ADR-0407).

**Trap 4 — `workspace_bootstrap_run` is audit/resume, not gate-state.**
The `workspace_bootstrap_run` table tracks which steps of `bootstrap-cascade` EF ran and completed. It is an idempotent resume log, not a business-level readiness checklist. Gate state lives in `workspace_bootstrap_gate` (ADR-0407). The bootstrap coordinator (Phase 2) will read both tables but they are not the same thing.

**Trap 5 — Coordinator lives in agent-harness, documented here.**
The bootstrap-coordinator orchestrator overlaps with `docs/domains/agent-harness/`. By deliberate architectural decision, the coordinator lives in `packages/ai/src/` under agent-harness responsibility but is **documented in this domain** as the primary owner of the bootstrap concept. See GAPS-AND-DEBT §Overlap Edges.
