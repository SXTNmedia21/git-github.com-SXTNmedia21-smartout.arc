---
title: "Open-Shift Marketplace — Sidecar Offer Table, C4-Gated Claim"
id: ADR_0306
status: proposed
layer: decision
created: 2026-05-13
updated: 2026-05-13
---

# ADR-0306: Open-Shift Marketplace — Sidecar Offer Table, C4-Gated Claim

## Context and Problem Statement

Hulltetting (filling unstaffed shifts) is the manager's most-repeated task.
Today Botsson AI proposes assignments and manager confirms — fully top-down.
Hospitality WFM standard pattern is peer-to-peer: manager posts open shift,
qualified employees see + claim on mobile, manager 1-tap approves. This offloads
Botsson, increases employee agency, and matches When-I-Work / 7Shifts UX
employees expect. Smartout cascade has all required data (D2 competence,
D3 rules, C4 authority) but no marketplace surface.

## Decision Drivers

- Hulltetting is bottleneck; current flow scales poorly past 30 employees / workspace.
- Mobile execute-verb fits ADR-0133 (employees claim from mobile = D6 production verb).
- C4 authority must gate claim: some workspaces auto-approve, some require manager.
- Cannot duplicate `schedule_shift` row per offer (would corrupt D2 staffing-state queries).

## Considered Options

1. **New `schedule_shift_offer` sidecar table** — one offer row per posting, references shift_id; status lifecycle open→claimed→approved→complete.
2. **Status field on `schedule_shift`** — minimal schema; conflates shift identity with offer lifecycle; breaks D6 invariants.
3. **Generic `change_proposal` reuse** — already exists for cascade proposals; semantically wrong (proposal = solver suggestion, offer = manager intent).

## Decision Outcome

Chosen option: **Option 1 — sidecar `schedule_shift_offer` table**.

**MVP scope (sjapp / lightweight first iteration):**

- Schema (one migration):
  - `public.schedule_shift_offer` — id, workspace_id, shift_id (FK schedule_shift), posted_by_profile_id, posted_at, expires_at, status enum (`open` | `claimed` | `approved` | `expired` | `cancelled`), claimed_by_profile_id (nullable), claimed_at, approved_by_profile_id, approved_at, cancel_reason text, created_at, updated_at.
  - Enum `schedule_shift_offer_status`.
  - Indexes: `(workspace_id, status, expires_at)`, unique partial `(shift_id) WHERE status IN ('open','claimed')` (one active offer per shift).
  - RLS: workspace member read; offer poster + assigned-shift owner write (per dual-auth pattern).
- New capability `shift_marketplace` with 4 tools:
  - `post_open` (manager+) — accepts shift_id, expires_at; INSERT offer row, telemetry `shift_offer.posted`.
  - `claim` (employee+) — checks competence vs `framework_rule` + absence overlap; UPDATE status='claimed'; pushes to manager.
  - `approve_claim` (manager+) — UPDATE shift assignee + offer status='approved' in transaction; emits `shift_offer.approved`.
  - `cancel_offer` (poster) — UPDATE status='cancelled' + reason.
- Auto-approve path: `engine_authority_config` row `shift_marketplace.auto_approve_claim` controls whether `claim` proceeds straight to `approved` status (skips manager). Default OFF (workspace must opt in).
- Push notification: on `post_open`, Edge Function fans out to qualified profiles (role match + competence match per existing patterns); reuses ADR-0136 mobile push channel.
- Mobile UI: new tab content under Vakter — list of open offers, claim button, status pill.
- Web UI: offer list in `/dashboard/schedule/marketplace` (manager view of pending offers + approve action).
- Telemetry events (new in registry): `shift_offer.posted`, `shift_offer.claimed`, `shift_offer.approved`, `shift_offer.expired`, `shift_offer.cancelled`.

**Out of scope V1:** swap (employee-to-employee shift trade), cascading offer (auto-post if first claimer rejected), offer auctions, fairness algorithms (next claim = least-worked employee), tip-pool adjustment on claim.

## Rules & Consequences

- **Good, because** offloads hulltetting from Botsson + manager; matches industry-standard UX.
- **Good, because** sidecar pattern keeps `schedule_shift` integrity (D6 production verb stays clean).
- **Good, because** C4 auto-approve path optional; safe default = manager approval.
- **Bad, because** push-notification fanout on post → notification storm risk for large workspaces. Mitigation V1: cap qualified-recipient set at 20, randomized.
- **Bad, because** competence-check at claim time duplicates logic in scheduler-solver (ADR-0307); both must call same helper. Risk of drift if helper changes shape.
- **Agent Impact:**
  - Capability `shift_marketplace` MUST use `mutateWithGate` per ADR-0287 on every write tool.
  - Voice channel: `claim` + `approve_claim` chat-only V1 (irreversible C4 acts; ADR-0288 policy).
  - When building swap (V2), separate ADR — swap requires two-sided consent + deeper C4 gate.
  - Cascade D6 readers MUST treat offers as transient — never query offer table for production-state; always read `schedule_shift` post-approval.

---

> Register in `docs/decisions/0000-decision-log.md`. First sortie: `feat/shift-marketplace-mvp` — schema + capability + mobile claim list + manager approve. Estimated 4-6 days.
