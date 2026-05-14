---
title: Handoff — Open-Shift Marketplace V1
status: in_progress
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [handoff, marketplace, wfm]
---

# Handoff — Open-Shift Marketplace V1

## Status

Tasks 0-3 shipped + STAGE-D column drift fix. Tasks 4-6 deferred to follow-on sortie.

---

## What Was Built

**Tasks 0-3 (this sortie):**

- **5 capability tools** in `packages/ai/src/capabilities/shift_marketplace/`:
  - `post_open` — manager posts an open shift offer (Compose verb, web+chat only per ADR-0133)
  - `claim` — employee claims an offer after eligibility pre-check (Approve verb, mobile-allowed)
  - `approve_claim` — manager approves a claim; single `mutateWithGate` wraps two UPDATEs transactionally (ADR-0099)
  - `cancel_offer` — poster or manager cancels an offer in `open` or `claimed` state (both channels per ADR-0306 §51)
  - `list_open_offers` — read-only inbox, no gate, voice-allowed; G3 ADR-0306 amendment registers this as the 5th tool
- **Pull-poll BFF** — `/api/mobile/marketplace/open-offers` GET; server-derived workspace; filters `status='open'` + eligibility; LIMIT 50; TanStack Query `refetchInterval: 30_000` while tab focused. Push fanout (ADR-0136) deferred V2.
- **Web manager UI** — `/dashboard/schedule/marketplace`; Tabs (Åpne / Krav i kø / Godkjent); per-offer glassmorphism cards + status badges + Godkjenn/Avvis buttons (Lucide `Check`/`X`); empty state glassmorphism "Ingen åpne tilbud"; `motionTokens.spring` card enter + `motionTokens.springSnappy` badge transitions (Nordic Split).
- **STAGE-D fix** — `cancel_offer` column-name drift (`cancel_reason` column was named differently in early migration vs capability body); corrected to match schema.

**Foundation (PHASE 1, pre-existing):** `schedule_shift_offer` table + enum + `eligibilityFor` helper + 5 marketplace telemetry events + `shift_marketplace` authority seed.

---

## Decisions

**ADR-0306 (proposed)** — Open-Shift Marketplace V1. Registers all 5 tools with their channel/gate/voice matrix. §51 explicitly permits `cancel_offer` on both channels. §52 accepts pull-poll V1 as sufficient until push fanout infrastructure is ready (ADR-0136).

**G3 amendment to ADR-0306** — `list_open_offers` added as 5th tool after G3 council review; read-only, no gate, voice-allowed. Channel matrix updated in-place (proposed ADR).

**ADR-0321 (G3 follow-on, not yet written)** — Will cover swap↔marketplace V2 convergence (employee-to-employee swap lives in separate `shift-swap` capability, 5 tools on development since 2026-04-13) and multi-stage approval via `engine_authority_pipeline`. Not blocking V1.

---

## Learnings

**L-0271 — Capability tool silent expansion (sibling to L-0176):** Adding a 5th tool to an existing capability without updating its per-tool docstring ADR reference is the same drift class as L-0176 (docstring claims compliance the body doesn't satisfy). Solution: maintain a per-tool table in the ADR (tool name | channel | gate | voice | emit event) and update it atomically with each tool addition. Registry alone is insufficient.

**L-0273 — Column-name drift surfaces during STAGE D (applies here):** The `cancel_offer` tool body referenced a column name that drifted from the actual migration schema. The STAGE D review caught it before merge. Pattern: always grep the migration file for the exact column name used in the capability body before declaring a tool done. Running typecheck catches type-level drift but not string-literal column names in raw SQL fragments.

---

## Known Issues / Debt

| # | Issue | Severity | Action |
|---|---|---|---|
| D1 | Mobile `(shifts)/marketplace.tsx` (Task 4) — not shipped | medium | Separate follow-on sortie |
| D2 | E2E `P-marketplace-full-flow` (Task 5) — not shipped, S9 open | medium | Follow-on sortie; closes S9 |
| D3 | `approve_claim` shift UPDATE has no row-count check — stale `shift_id` silently passes; offer flips to `approved` with no assignee | low | Defensive fix deferred; guard query before UPDATE in follow-on |
| D4 | TanStack mutation `onSuccess` lacks `// emit() delegated to BFF per ADR-0134` comment marker | cosmetic | Add comment in follow-on for future audit clarity |
| D5 | Push fanout V2 (ADR-0136 token verify) deferred | low | Pull-poll V1 acceptable per ADR-0306 §52 |
| D6 | Auto-approve binary toggle exists in authority seed; multi-stage approval pipeline = ADR-0321 | deferred | ADR-0321 when first multi-stage approval is requested |
| D7 | Type regen (Task 6) deferred — `database.types.ts` not regenerated this sortie | medium | Run `npx supabase gen types typescript --local` in follow-on |

---

## Next Steps

1. **Follow-on sortie** — Ship Task 4 (mobile claim list) + Task 5 (E2E P-marketplace-full-flow, closes S9) + Task 6 (type regen + full typecheck 52/52).
2. **D3 row-count guard** — Add defensive row-count check in `approve_claim` shift UPDATE.
3. **D4 comment marker** — Add `// emit() delegated to BFF per ADR-0134` in mutation `onSuccess` callbacks.
4. **ADR-0321** — Author when first multi-stage approval use-case is requested; defines swap↔marketplace convergence + `engine_authority_pipeline` shape.
