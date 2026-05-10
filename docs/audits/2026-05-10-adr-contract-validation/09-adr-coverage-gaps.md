---
title: "Audit Slice 09 — ADR Coverage Gaps"
status: done
created: 2026-05-10
updated: 2026-05-10
module: cross-cutting
tags: [audit, adr, coverage, drift]
---

# Slice 09 — ADR Coverage Gaps

**Method:** Gap-fill scan. Identified all accepted ADRs not covered by slices 01–08
(covered list: 0004, 0011, 0012, 0019, 0024, 0029, 0031, 0032, 0038, 0039, 0041,
0042, 0044, 0047, 0049, 0076–0079, 0091, 0107, 0127–0136, 0151, 0156, 0158, 0173,
0186, 0204, 0234–0259, 0246–0248, 0255, 0261). For each uncovered accepted ADR with
a live code surface, performed a 2-minute spot-check.

**Scope:** `docs/decisions/`, `apps/`, `packages/`, `services/`, `supabase/`,
`infra/scripts/`, `.github/workflows/`

---

## Summary

| Finding | ADR | Severity | Status |
|---------|-----|----------|--------|
| F-AC-01 | ADR-0282 | LOW | Stale E-item tracker: `[ ] ADR-0276` not updated after ADR-0276 was accepted |
| F-AC-02 | ADR-0282 | MEDIUM | `apps/landing/` Ultravox code violates AC#1 post-condition grep; deferred to P5 without formal plan |
| F-AC-03 | ADR-0058 | LOW | `/api/botsson/voice/token` mints LiveKit tokens directly, bypassing `livekit-token` EF — no amendment ADR documents the Botsson Orb exception |
| F-AC-04 | ADR-0107 | INFO | No `amended_by: ADR_0276` back-reference in ADR-0107 frontmatter |
| F-AC-05 | ADR-0282 | INFO | `services/voice-agent/src/agent.ts` function `resolveOpenAIVoice(ultravoxVoice)` contains "ultravox" in identifier names; AC#1 post-condition grep is not fully zero |
| F-AC-06 | ADR-0265 | PASS | promote-preview.sh 6-gate wrapper + drift-check.sh + ci.yml Edge Functions + Migration State jobs all present |
| F-AC-07 | ADR-0281/0290 | PASS | `engine_world_observe_platform` SECURITY DEFINER RPC with REVOKE/GRANT in migration; engine-world-write.sh + engine-world-refresh.sh wired |
| F-AC-08 | ADR-0291 | PASS | `packages/journey-ir/src/speed-profile.ts` implements SpeedProfile type + SPEED_PROFILES record with correct multipliers |
| F-AC-09 | ADR-0285 | PASS | `staff_event` + `staff_event_attendee` migration exists; server actions have `emit()`; C4 gate intentionally deferred to Phase 2 per ADR |
| F-AC-10 | ADR-0276 | PASS | ADR-0276 accepted 2026-05-10; mode→channel derivation preserved; R3 condition met (Phase E shipped) |
| F-AC-11 | ADR-0289 | PASS | `propose_create_shift`, `propose_update_shift`, `propose_delete_shift` present in `tools-schedule.ts`; tactical duplication freeze respected |
| F-AC-12 | ADR-0192 | PASS | AFTER INSERT trigger on workspace + `capability_default_registry` table in migration `20260518000000` — deviation from BEFORE INSERT documented in migration header |
| F-AC-13 | ADR-0262 | PARTIAL | `apps/admin/src/app/api/avstemming/[run_id]/artifact/[type]/route.ts` follows ADR-0262 (createSignedUrl + emit). `download-csv` and `download-pdf` routes have `TODO(M6): convert to 302+signed URL` — awaiting order-export generators, explicitly deferred |

---

## Findings Detail

### F-AC-01 — Stale E-item tracker in ADR-0282 (LOW)

**ADR:** ADR-0282 (`docs/decisions/0282-voice-plane-consolidation-livekit-only.md`)
**Line:** 176

```
- [ ] ADR-0276 ADR-0107 amendment (provider-independence note) — to write
```

ADR-0276 was written and accepted on 2026-05-10. The campaign charter
(`docs/plans/CAMPAIGN-botsson-arena.md:138`) correctly shows E8 as `[x]`:

```
- [x] **E8** — ADR-0107 supersession or simplification — landed (ADR-0276 accepted)
```

The ADR-0282 internal tracker was never flipped. No code impact — this is a documentation
stale-state. The `[ ]` on line 176 should be `[x]`.

**Recommended fix:** Update line 176 in ADR-0282 to `[x]` with same commit-SHA note as
campaign charter entry. Low priority — Phase E is declared shipped and the authoritative
tracker (campaign charter) is correct.

---

### F-AC-02 — Landing app Ultravox code not migrated (MEDIUM)

**ADR:** ADR-0282, R1 + AC#1 post-condition
**Files:**
- `apps/landing/src/components/voice-assistant.tsx:6` — imports `UltravoxSession, UltravoxSessionStatus`
- `apps/landing/src/app/api/wizard/engine-start/route.ts:47` — calls `/adapters/ultravox/create-call` (route was deleted from stage-engine per E6)
- `apps/landing/src/app/features/communications/page.tsx` — dynamic imports `UltravoxSession`

**Evidence:**
```
apps/landing/src/components/voice-assistant.tsx:6:
  import { UltravoxSession, UltravoxSessionStatus, Role } from "ultravox-client";

apps/landing/src/app/api/wizard/engine-start/route.ts:6:
  // ADR-0282 Phase E E6: /adapters/ultravox/create-call deleted.
  // LiveKit room-token endpoint replacement is P5 scope.
```

The AC#1 post-condition states: `grep -r "ultravox|UltravoxSession|UltravoxSessionStatus" apps/ packages/ services/` returns zero hits (excluding docs/comments/migrations). This condition is NOT met. `apps/landing/` is under `apps/` and contains live Ultravox session code.

The code itself acknowledges this via `// LiveKit room-token endpoint replacement is P5 scope.` The `/adapters/ultravox/create-call` route that landing calls was deleted by E6 — meaning the landing wizard voice feature is **currently broken** in production (calling a deleted route).

**Not** in the AC#1 item list (which enumerates `apps/web/` and `services/stage-engine/`), so E6 sign-off was technically scoped correctly. However AC#1's grep post-condition is broader than its item list.

**Severity: MEDIUM** — the landing wizard voice path calls a deleted backend endpoint (`/adapters/ultravox/create-call` no longer exists in stage-engine after E6). This is a live broken feature, not just documentation drift. P5 migration is informally declared but not planned.

**Recommended action:** Open a sub-sortie for landing voice migration, or explicitly add an ADR exception note for `apps/landing/` scope, and disable the landing voice widget until P5 ships.

---

### F-AC-03 — `/api/botsson/voice/token` bypasses ADR-0058 livekit-token EF rule (LOW)

**ADR:** ADR-0058 (`docs/decisions/0058-livekit-as-webrtc-provider.md`)
**File:** `apps/web/src/app/api/botsson/voice/token/route.ts`

ADR-0058 Agent Impact says: *"All WebRTC token minting goes through `livekit-token` Edge Function. Never mint tokens client-side."*

The Route Handler at `/api/botsson/voice/token` mints LiveKit `AccessToken` directly using `livekit-server-sdk` (line 91) without delegating to the `livekit-token` Edge Function. The route's header documents the reason:

```ts
// Unlike /api/channels/[id]/call/token, this route does NOT go through
// the livekit-token Edge Function because that function validates channel
// membership — a concept that does not apply to the per-user Botsson Orb room.
```

The intent of ADR-0058 is "server-side auth before token issuance" — this is met (the route authenticates via cookie session and derives workspace + profileId server-side). The stated rule ("through livekit-token EF") is narrower than the intent. The exception is intentional and documented inline.

**Severity: LOW** — security intent is preserved (server-side auth + RLS). The gap is that no amendment ADR documents the Botsson Orb exception to ADR-0058's "all through livekit-token EF" rule. Future agents may add more direct minters thinking it's the pattern.

**Recommended fix:** Add a brief amendment note to ADR-0058 (or a new ADR) documenting the Botsson Orb exception: "Surfaces without channel membership (Botsson Orb rooms) mint tokens via a dedicated BFF Route Handler. The ADR-0058 intent — server-side auth before token issuance — still applies."

---

### F-AC-04 — ADR-0107 missing `amended_by` back-reference (INFO)

**ADR:** ADR-0107 (`docs/decisions/0107-botsson-provider-channel-derivation.md`)

ADR-0276 amends ADR-0107. ADR-0276 frontmatter has `amends: [ADR_0107]`. However,
ADR-0107 frontmatter has no `amended_by` field pointing to ADR-0276. The `updated:`
date also remains `2026-04-15` (unchanged since creation).

Existing convention is inconsistent — ADR-0078 has inline body references to ADR-0163
but no `amended_by` frontmatter field either. Pattern is not universally enforced.

**Severity: INFO** — documentation convention gap, no code impact. Consistent with
the project's current amendment pattern where the amending ADR carries the reference
but the source ADR is not always updated.

---

### F-AC-05 — `services/voice-agent/src/agent.ts` identifier names contain "ultravox" (INFO)

**ADR:** ADR-0282, AC#1 post-condition
**File:** `services/voice-agent/src/agent.ts:52,62–64`

```ts
const ULTRAVOX_TO_OPENAI_VOICE: Record<string, string> = { coral: "coral", ... };
function resolveOpenAIVoice(ultravoxVoice: string | undefined): string { ... }
```

These are identifier names, not imports of `ultravox-client`. The variable/function
names contain "ultravox" as a semantic label ("these IDs came from Ultravox naming"). The
AC#1 grep pattern `grep -r "ultravox|UltravoxSession|UltravoxSessionStatus"` would match
`ultravox` in `ULTRAVOX_TO_OPENAI_VOICE` and `resolveOpenAIVoice(ultravoxVoice)`.

The function exists because `packages/ai/src/missions/registry.ts` still uses Ultravox
voice IDs (`coral`, `mark`, `sarah`, etc.) as string values — the voice-agent maps these
to OpenAI Realtime equivalents. This is a deliberate compat bridge documented in the
code comment: *"The mission registry uses Ultravox voice IDs (mark, coral, etc.) —
map to the OpenAI Realtime equivalents."*

The AC#1 grep condition is technically not met but the concern (live Ultravox protocol
code) is absent. This is identifier naming, not protocol usage.

**Severity: INFO** — the compat map is intentional. The gap is that the mission registry
still uses Ultravox voice ID strings (`mark`, `coral`, etc.) rather than OpenAI Realtime
IDs natively. A cleaner state would rename both the identifier AND update the mission
registry to use OpenAI voice IDs directly. Low priority — no security or runtime impact.

---

## Pass Results (spot-checked, clean)

### F-AC-06 — ADR-0265 Enforced Deployment Pipeline (PASS)

**ADR:** ADR-0265 (`docs/decisions/0265-enforced-deployment-pipeline.md`)

All 6 gates verified present:
- Gates 1–4: `~/.claude/scripts/promote-preview.sh` (global script) — not inspected but called by wrapper
- Gate 5: `infra/scripts/smoke-probe.sh preview` wired in `infra/scripts/promote-preview.sh:63`
- Gate 6: `lkg-preview-<sha>` tag logic in `infra/scripts/promote-preview.sh:84–97`

CI additions confirmed in `.github/workflows/ci.yml`:
- `edge-functions` job at line 240 — dry-run on PR, real deploy on main push
- `migration-state` job at line 296

Continuous review:
- `infra/scripts/drift-check.sh` — exists
- `infra/scripts/engine-world-write.sh` — exists, wired into promote-preview

The three additional required status checks (Enforce branch flow, pgTAP Suites,
authority-seed-parity) cannot be verified locally (ruleset is GitHub-server-side),
but workflows exist and run on PR: `pipeline-enforcement.yml`, `pgtap.yml`,
`authority-seed-parity.yml`.

---

### F-AC-07 — ADR-0281/0290 engine_world platform RPC (PASS)

**ADRs:** ADR-0281, ADR-0290

`supabase/migrations/20260526000000_engine_world_phase_1.sql` contains:
- `CREATE FUNCTION public.engine_world_observe_platform` with `SECURITY DEFINER`
- `REVOKE ALL ON FUNCTION public.engine_world_observe_platform FROM PUBLIC`
- `GRANT EXECUTE ... TO service_role`
- `GRANT EXECUTE ... TO authenticated`

`infra/scripts/engine-world-write.sh` and `engine-world-refresh.sh` both exist.
`promote-preview.sh` wires `ew_write()` fire-and-forget on both success and failure paths.

ADR-0290 constraint (SECURITY DEFINER + explicit REVOKE/GRANT) is met.

---

### F-AC-08 — ADR-0291 Journey Speed Profiles (PASS)

**ADR:** ADR-0291

`packages/journey-ir/src/speed-profile.ts` implements:
- `SpeedProfile = "full" | "normal" | "ai_companion"` type
- `SPEED_PROFILES` record with exact multipliers from ADR table:
  `full: {1,1,1}`, `normal: {3,3,2}`, `ai_companion: {8,6,3}`
- `resolveSpeedMultiplier()` pure helper

---

### F-AC-09 — ADR-0285 Staff Event Table (PASS)

**ADR:** ADR-0285

`supabase/migrations/20260429095006_staff_event.sql` — `staff_event` +
`staff_event_attendee` tables with `workspace_id`, RLS, enums.

`apps/web/src/app/dashboard/people/invitations/_actions/staff-event-actions.ts`
has `emit()` from `@smartout/telemetry`. No `gate_action` — consistent with ADR-0285
Phase 1 decision: *"C4 authority gate is not wired in Phase 1."*

---

### F-AC-10 — ADR-0276 mode→channel preservation (PASS)

**ADR:** ADR-0276

`apps/web/src/app/Botsson/_components/BotssonProvider.tsx:694`:
```ts
provider: "livekit",
```

The flip from `"ultravox"` to `"livekit"` is complete. ADR-0276 R2 (`mode→channel`
derivation unchanged) is preserved — no changes to channel derivation logic in
`apps/mobile/src/providers/botsson-provider.tsx` or web equivalents. R3 condition
(ADR-0282 R6 migration complete) is met — Phase E shipped 2026-05-10.

ADR-0276 is correctly `status: accepted`.

---

### F-AC-11 — ADR-0289 Voice Agent Tool Freeze (PASS)

**ADR:** ADR-0289

`services/voice-agent/src/tools-schedule.ts` contains exactly three propose_* tools
added in Fase 4: `propose_create_shift` (line 58), `propose_update_shift` (line 159),
`propose_delete_shift` (line 243). No additional tools were added to the parallel
array beyond these three. Tactical duplication freeze is respected.

---

### F-AC-12 — ADR-0192 Authority Seed Bootstrap Trigger (PASS)

**ADR:** ADR-0192

`supabase/migrations/20260518000000_contract_authority_seed_upsert_and_bootstrap.sql`
implements AFTER INSERT trigger on workspace (deviation from brief's BEFORE INSERT,
documented in migration header with FK-safety rationale) + `capability_default_registry`
table. All capabilities mentioned in ADR-0189/0112 CI scope are registered in the
registry. The onboarding capability has its own seed migration at
`20260524000001_onboarding_capability_authority_seed.sql`.

---

### F-AC-13 — ADR-0262 Admin File Downloads (PARTIAL, not drift)

**ADR:** ADR-0262

`apps/admin/src/app/api/avstemming/[run_id]/artifact/[type]/route.ts` — follows
the 302+createSignedUrl+emit() pattern (ADR-0262 compliant).

`apps/admin/src/app/(admin)/orders/[id]/download-csv/route.ts:46` and
`download-pdf/route.ts:46`:
```ts
// TODO(M6): convert to 302+signed URL per ADR-0262 once order-export generators ship.
```

These routes return placeholder responses (orders don't have generated artifacts yet).
The TODO is correctly scoped — waiting on M6 order-export generators. Not drift.

---

## Uncovered Accepted ADRs — No Drift Signal Found

Spot-checked, clean (no code surface to verify or code matches ADR intent):

| ADR | Title | Result |
|-----|-------|--------|
| ADR-0005 | Testing infrastructure | No code surface to verify at this scope |
| ADR-0007 | Dashboard architecture | App Router + server layout pattern present |
| ADR-0021 | Subdomain workspace routing | Middleware with `x-workspace-slug` header |
| ADR-0052 | Guardian WebSocket architecture | `routes/guardian.ts` + ws routes exist |
| ADR-0054 | Edge functions own call orchestration | Pattern in supabase/functions |
| ADR-0058 | LiveKit as WebRTC provider | See F-AC-03 for the one exception found |
| ADR-0099 | Unified authority gate | `gate_action` RPC wired in agent-router |
| ADR-0112 | Intent classifier coverage invariant | `DOCUMENTED_TOOLLESS` up to date in check-intent-coverage.ts |
| ADR-0114 | Server actions canonical mutation | `actions.ts` / `_actions/` pattern followed |
| ADR-0189 | Authority seed parity CI | `authority-seed-parity.ts` script + workflow exist |
| ADR-0200 | Atomic season activation RPC | `20260518010002_activate_season_rpc.sql` exists |
| ADR-0207 | callGateAction unification | Per-capability gate.ts files are thin adapters over `gatedMutation()` |
| ADR-0208 | MCP gateway alongside Hono | Deliberately deferred (B1 prerequisite not yet closed) |
| ADR-0213 | Campaign PRs use merge-commit | No-squash PR convention in ADR; no technical block yet (ruleset not set) |
| ADR-0281 | engine_world shared agent state | See F-AC-07 PASS |
| ADR-0282 | Voice plane consolidation | See F-AC-01, F-AC-02, F-AC-05 |
| ADR-0285 | Staff event dedicated table | See F-AC-09 PASS |
| ADR-0289 | Voice agent tool registry | See F-AC-11 PASS |
| ADR-0290 | engine_world platform RPC bypass | See F-AC-07 PASS |
| ADR-0291 | Journey speed profiles | See F-AC-08 PASS |

---

## ADRs Explicitly Skipped

- All `status: proposed` ADRs — not yet binding
- All `status: superseded` ADRs — superseded by later decisions
- All `status: draft` ADRs — ADR-0137, 0138, 0139

---

## Action Items

| Priority | Item | Owner |
|----------|------|-------|
| MEDIUM | F-AC-02: Plan landing Ultravox migration (P5) formally OR disable the broken voice widget on landing | Campaign owner |
| LOW | F-AC-01: Flip `[ ]` on ADR-0282 line 176 to `[x]` | Next commit |
| LOW | F-AC-03: Add amendment note to ADR-0058 documenting Botsson Orb exception | Next ADR window |
| INFO | F-AC-04: Add `amended_by: [ADR_0276]` + `updated: 2026-05-10` to ADR-0107 frontmatter | Next ADR cleanup |
| INFO | F-AC-05: Rename `ULTRAVOX_TO_OPENAI_VOICE` → `OPENAI_VOICE_MAP` + param `ultravoxVoice` → `voiceId`; update mission registry to native OpenAI voice IDs | Phase F |
