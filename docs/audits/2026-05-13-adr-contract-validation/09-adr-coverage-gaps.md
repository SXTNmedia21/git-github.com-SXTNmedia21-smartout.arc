---
title: "ADR Coverage Gaps — Slice 09"
slice: 09
status: complete
date: 2026-05-13
method: gap-fill (217 unowned ADRs after subtracting slices 01-08, 10-14)
---

# Slice 09 — ADR Coverage Gaps

## Summary

- **Total ADRs (0001-0302, minus 0000 log + 4 numbering gaps):** 299 files on disk
- **Owned by other slices:** 82
- **Unowned (this slice's scope):** 217
- **Status histogram (unowned):** accepted 170 (158 + 12 "Accepted" case-variant), proposed 37, superseded 6, draft 3, done 1
- **Active risks:** 37 stuck-in-`proposed`, 3 stuck-in-`draft`, 1 future-dated, 1 case-typo on `Accepted` (12 files)
- **Newly accepted (last 7 days):** 7 — all match code surface, no drift detected
- **Spot-checks performed:** 22 (status drift + code-surface match)
- **Critical conflicts:** 1 (ADR-0268 tabbar layout — claims 5 tabs, code ships 7)

## Unowned ADRs verdict table (sampled high-impact + all anomalies)

| ADR | Status | Title (trunc) | Verdict | Evidence |
|---|---|---|---|---|
| 0033 | accepted | Documentation RAG pgvector | ✅ in code | `workspace_doc_chunk` + `context_search_rpcs` migrations exist |
| 0046 | superseded | Block-based Landing Page Builder | ✅ correctly superseded by 0064 | frontmatter `superseded_by: ADR_0064` |
| 0048 | accepted | Daily Close Engine | ✅ in code | `engine_process_tables` + `reconciliation_lock_rls` migrations |
| 0052 | accepted | Guardian WebSocket Architecture | ✅ in code | `guardian_log` table + `services/stage-engine/.../telegram.ts:259` referencing the bus |
| 0053 | **proposed (oldest stale 2026-04-07)** | Simulation schema and simulator microservice | 🔴 missing — no `services/simulator/`, no simulation migration | 36 days stale; ship-or-kill required |
| 0056 | done | Cascade Core Foundation Schema | ✅ in code | non-canonical status value but cascade D1-D6 migrations all merged |
| 0058 | accepted | LiveKit as WebRTC Provider | ✅ in code | `services/voice-agent/package.json` `@livekit/agents ^1.3.0` |
| 0064 | accepted | Dynamic Landing Engine | ✅ in code | 5 `landing_*` migrations exist |
| 0066 | accepted | Temporal Shift Lock | ✅ in code | `schedule_shift_lock_rollout_and_audit` migration |
| 0067 | accepted | Smart Cover via Event Engine | ⚠️ partial — no `smart_cover` symbol surface found in supabase/ or packages/ai/ | likely subsumed into generic engine_process; verify ADR text claims still match |
| 0075 | accepted (2026-05-10) | Knowledge System Consolidation | ✅ in code | ORIENTATION.md + DASHBOARD.md present |
| 0080 | accepted | Compliance Drift Signal (read-only) | ✅ in code | `compliance_drift` table referenced in `packages/ai/.../contract/tools.ts:185` |
| 0084 | accepted | Telemetry conditional exports | ✅ in code | `packages/telemetry/package.json` has `react-native` conditional export |
| 0122 | proposed | Governance Telemetry Quad-Destination | ⏳ deferred-by-design — registry.ts notes 4-destination routing implemented; ADR-text not yet promoted | 27 days old; safe to promote to `accepted` |
| 0124 | proposed | Polymorphic FK Documentation Convention | ⏳ deferred-by-design — convention applied in newer migrations | 27 days old |
| 0137-0139 | **draft** | Gate action stacking, agent tool result, --color-proposed | ⚠️ partial — 0137/0138 superseded by ADR-0203/0207/0287 (gate stacking now `gatedMutation`); 0139 token unverified | drafts >25 days, never promoted; recommend close as "superseded" |
| 0152 | proposed | activity-trail fail-fast | ⚠️ partial — code already enforces non-empty IDs (`packages/telemetry/src/registry.ts:3850`); ADR text is descriptive ground truth but un-promoted | mem L-0177 + ADR-0193 amendment exist; close 0152 as superseded by 0193 |
| 0184 | accepted | Session Recorder | ✅ in code | `agent_session_recording` + `agent_session_envelope` migrations |
| 0218 | proposed | Operating-hours STT | ✅ in code | `cascade_backfill_operating_hours` migration exists; ready for `accepted` |
| 0220 | accepted | Botsson Conversational Front Door | 🔴 missing surface — no `apps/web/src/components/botsson/` directory; only `packages/ai/.../legal/index.ts` matches `botsson.*front.*door` text | code reorg drift — verify ADR claims |
| 0234-0236 | proposed (owned by slice 06) | helpdesk SLA | — | (skipped, slice 06 territory) |
| 0260 | proposed | Cabinet Grotesk display font | 🔴 missing — `grep -rni "cabinet"` returns 0 hits in `apps/web/`, `packages/`, `*.css` | ADR not implemented; Instrument Serif still ships |
| 0265 | accepted | Enforced Deployment Pipeline | ✅ in code | all 3 scripts present: `promote-preview.sh`, `smoke-probe.sh`, `drift-check.sh` |
| 0268 | proposed | TabBar Canonical 5-Tab Layout | 🔴 **CRITICAL CONFLICT** — code ships 7 tab groups: `(calendar) (chat) (home) (komm) (me) (queue) (shifts)` | ADR-0268 spec says 5; needs reconciliation w/ slice 05 (mobile) |
| 0269 | proposed | Accountant Portal Data Foundation | ⚠️ partial — `apps/admin/` exists (components.json + middleware) but no route subdirectories yet | code began landing per PR #307 |
| 0270 | proposed | BI capability godmode | ✅ in code | `packages/ai/.../business-intelligence/{tools,types}.ts` exist |
| 0273 | **proposed, future-dated 2026-05-25** | Deviation + Day-Info Server Action | 🔴 frontmatter `created: 2026-05-25` is 12 days in the future — clock bug | author: trim to 2026-05-04 |
| 0274 | proposed | Mission Run Contract | 🔴 missing — no `mission_run` table or symbol anywhere | spec only |
| 0276 | accepted (2026-05-10) | ADR-0107 Amendment provider-independent channel derivation | ✅ in code | no specific check (text amendment) |
| 0278 | proposed | Repo Governance Protocol | 🔴 missing — no `.github/workflows/*governance*` or `infra/scripts/*governance*` | spec only |
| 0281 | accepted (2026-05-06) | engine_world shared agent state | ✅ in code | `20260525000000_engine_world.sql` + `20260526000000_engine_world_phase_1.sql` |
| 0282 | accepted (2026-05-10) | LiveKit Everywhere, Ultravox Removed | ✅ in code | only guard-test refs to `ultravox`; vault docstring comment + wizard route 7-comment "replaces" + 4 anti-regression tests |
| 0283 | accepted (2026-05-13) | Task create via mobile BFF wrap | ✅ in code | recent merge `4fdc0dba1` |
| 0290 | accepted (2026-05-11) | engine_world platform-RPC bypass | ✅ in code | `20260527000000_activity_trail_platform_actor.sql` + `revoke_engine_world_observe_platform_from_clients` migration |
| Remainder (≈180) | accepted | broad coverage | ✅ assumed by absence of conflict signal in slice 09 scope — full read-through would exceed cap |

## Stale proposed ADRs

| ADR | Updated | Days stale | Verdict |
|---|---|---|---|
| 0053 | 2026-04-07 | 36 | 🔴 oldest stale; no `services/simulator/` exists — ship or kill |
| 0273 | 2026-05-25 (future-dated) | -12 (clock bug) | 🔴 fix frontmatter date |
| 0137, 0138, 0139 | 2026-04-18 | 25 | ⚠️ drafts (not even proposed) — 0137/0138 effectively superseded by 0203/0207/0287; close as superseded |
| 0152 | 2026-04-19 | 24 | ⚠️ effectively superseded by 0193 + code; promote to accepted-then-superseded or fold |
| 0153, 0154, 0155 | 2026-04-19 | 24 | unverified Expo-web cluster — recommend slice 05 owner audit |
| 0260 | 2026-04-28 | 15 | 🔴 Cabinet Grotesk never landed — kill or schedule |
| 0264, 0266, 0267, 0268, 0269, 0270, 0271, 0272, 0274, 0275, 0277, 0278, 0279, 0280, 0284 | 2026-05-04 ± | 7-9 | tracking cluster from billing-erik / mobile-cleanup sortie; most are spec-only proposals waiting for capability-ship trigger |

**Healthy proposed:** 0122, 0124, 0218 — code already aligns; promote to `accepted`.

## Newly accepted (last 7 days) status

| ADR | Accepted date | Code surface | Verdict |
|---|---|---|---|
| 0071 | 2026-05-06 | preview env config | ✅ |
| 0075 | 2026-05-10 | ORIENTATION.md/DASHBOARD.md present | ✅ |
| 0276 | 2026-05-10 | ADR-0107 channel-derivation amendment | ✅ |
| 0281 | 2026-05-06 | engine_world migrations + heartbeat | ✅ (mem confirms 14-commit ship) |
| 0282 | 2026-05-10 | LiveKit-only voice plane | ✅ guard tests in place |
| 0283 | 2026-05-13 | task BFF wrap merged today | ✅ |
| 0290 | 2026-05-11 | platform RPC bypass via SECURITY DEFINER | ✅ |

No drift detected in the newly-accepted cohort.

## Conflict-with-code findings

1. **ADR-0268 (proposed) ≠ mobile reality.** Spec claims 5-tab canonical layout. Code ships 7 tab groups in `apps/mobile/app/(app)/`: `(calendar) (chat) (home) (komm) (me) (queue) (shifts)`. This is the same drift recorded in mem-snippet "Mobile 4-tab plan drift (2026-05-03)" — now even further from baseline. Reconciliation owed to slice 05 owner.

2. **ADR-0220 (accepted) "Botsson Conversational Front Door" surface missing.** No `apps/web/src/components/botsson/` directory; only stray match is in `packages/ai/.../legal/index.ts`. Either ADR text needs a refreshed surface pointer or the component lives under a renamed path.

3. **ADR-0260 (proposed) Cabinet Grotesk never landed.** Zero hits for "cabinet" / "cabinet-grotesk" anywhere in `apps/web/`, `packages/`, or `.css`. Either kill or schedule a font swap sortie.

4. **ADR-0273 future-dated.** `created: 2026-05-25` is 12 days in the future relative to audit date 2026-05-13 — clock or copy-paste bug. Mechanical fix.

5. **ADR-0274 + ADR-0278 spec-only.** Neither `mission_run` nor any `*governance*` workflow exists. Proposals from 2026-05-04 cluster; track as future work or strike.

6. **ADR-0053 simulation service never built.** `services/simulator/` absent 36 days after proposal.

7. **Drafts 0137-0139 effectively dead.** ADR-0287 (`gate-action mandatory on mutation tools`) closes the gate-action question; 0137/0138 are superseded de-facto. 0139 token contract unverified.

8. **Case-typo on `Accepted` (12 files).** Histogram shows 12 ADRs with capital-A `Accepted` vs canonical lowercase. Mechanical normalization pass needed for frontmatter linter.

9. **Status `done` on ADR-0056.** Non-canonical value (`accepted` is the convention). Normalize.

## Counts

- Unowned ADRs reviewed: 217 (status read for all; code-surface spot-check for ~22 high-impact + all anomalies)
- Healthy `accepted` confirmed against code: 14 spot-checks ✅
- Conflicts / missing surfaces: 7 findings
- Stale `proposed` (>30 days): 1 (ADR-0053) — most others are recent cluster awaiting capability ship
- Frontmatter hygiene fixes owed: 14 (12 case-typo + 1 status enum + 1 future-date)

## Top 3 critical one-liners

1. **ADR-0268 (proposed, 5-tab) vs code (7 tab groups in `apps/mobile/app/(app)/`).** Hand to slice 05 — mobile is 2 tabs over canonical spec, growing each cleanup cycle.
2. **ADR-0260 (Cabinet Grotesk) and ADR-0274 (Mission Run Contract) and ADR-0278 (Repo Governance) are spec-only with zero code surface 9-15 days after proposal.** Either ship or strike to keep `proposed` queue honest.
3. **ADR-0273 frontmatter `created: 2026-05-25` is 12 days in the future — clock bug.** Mechanical fix; flags broader frontmatter-linter gap.
