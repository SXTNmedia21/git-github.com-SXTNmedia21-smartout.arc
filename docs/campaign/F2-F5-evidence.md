---
title: F2 + F5 Fork Resolution — disk evidence
status: done
created: 2026-06-02
updated: 2026-06-02
module: design-handoff
tags: [forks, evidence, telemetry, orchestration, beslutt]
---

# F2 + F5 — resolved on disk (code side)

These two forks were PENDING after PO's BESLUTT pass because they need files only the code side can
read. Resolved by the Top Orchestrator; evidence below feeds PO to close BESLUTT.

---

## F5 — Telemetry registry divergence → RESOLVED (fact, not a fork)

**Question:** is `events.ts` still a live divergent registry alongside `registry.ts`?

**Evidence (disk):**
- No `events.ts` exists anywhere in `packages/telemetry/` — neither `master-refactor` nor the build
  worktree (`refactor/smartout`).
- `EVENT_ROUTING` is exported **from `./registry`**; every emit file (`emit.ts`, `emit.client.ts`,
  `emit.native.ts`) and the tests import it from `./registry`.
- `sxtn-foreman.md:66` corroborates: *"ONE registry: `packages/telemetry/src/registry.ts`
  (runtime-authoritative; events.ts divergent — **reconciled in F0.1**)."*
- `registry.ts`: 17 786 lines (build worktree) / 16 160 (master-refactor — older).

**Verdict:** single authoritative registry. The register-first gate enforces against
`packages/telemetry/src/registry.ts` (`EVENT_ROUTING`). **No decision needed.**

---

## F2 — Loop / role ownership → NO frontal conflict; boundary already written

**Question:** `sxtn-foreman` and `sxtn-harness-builder` both seemed to claim the autonomous loop.

**Evidence (both agent files, build worktree `.claude/agents/`):** they own **different loops**, and
each defers to the other in writing.

| | `sxtn-foreman` (amber) | `sxtn-harness-builder` (green) |
|---|---|---|
| Loop | **campaign drive** — pull worklist domain → dispatch porter → verify `control.json` → flip → loop | **mechanical rails** — arm Stop-loop + heartbeat + the two hook-walls + trigger-registry |
| Lane | application (port domains) | plugin assets only (never app code) |
| Owns | dispatch + verification + `.claude/agents/` | `.sxtn/` runtime (heartbeat, loop, registry) |

- harness: *"the orchestrator drives one feature S0→S9; the harness-builder builds the rails the
  orchestrator runs on…"* + NOT *"the feature driver… keeps orchestrators armed and fed."*
- foreman (Two-instance note): *"A separate Agent-Harness instance may own `.sxtn/`… You own dispatch
  + verification + project `.claude/agents/`."*

**Verdict:** siblings, not rivals — distinct loops, boundary documented.

### Residual decisions for PO (not disk-answerable)
1. **`.sxtn/` write-ownership** — ONE instance owns it (harness-builder); foreman read-mostly + owns
   `.claude/agents/`. Closes the `concurrent-instances-wipe-shared-sxtn` risk. Already written in both
   files — just confirm.
2. **Vocabulary reconciliation** ⚠ — PO topology says *Top Orchestrator + web/mobile lanes + Database
   Agent*; agent files say *foreman / harness-builder / ui-builder*. Different names, overlapping roles.
   PO should map them, or the campaign runs on two mental models (the ambiguity that cost last time).
3. **Scope** — run **foreman alone** (human-paced, simpler, local-only) vs **foreman + full harness
   autonomous loop** (two opus instances, hands-off, collision to manage).

### Recommendation (PO decides)
F2 is **not a blocker** once write-ownership (1) is confirmed — the split is already documented. For a
local-only, human-gated port: **run foreman as the driver; arm the full harness loop only if hands-off
overnight runs are wanted.** The heaviest item is (2) vocabulary — needs PO, not disk.
