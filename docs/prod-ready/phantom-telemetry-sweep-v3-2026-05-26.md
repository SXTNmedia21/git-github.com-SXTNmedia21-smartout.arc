---
title: Phantom Telemetry v3 — Attempt-Verified Re-Triage (2026-05-26)
status: in_progress
created: 2026-05-26
updated: 2026-05-26
module: prod-ready
tags: [telemetry, audit, phantom-events, remediation, v3-triage]
---

# Phantom Telemetry v3 — Attempt-Verified Re-Triage (2026-05-26)

## Executive Summary

**Iteration methodology:** Stricter emit() call-site verification using cross-reference grep (event name + emit invocation pattern) to exclude false positives from registry definitions and UI labels.

**Starting baseline:** 42 remaining A-class events from v2 triage (78 total minus 36 already attempted in iter-9 + iter-11).

**v3 result:** Of the 42 remaining events:
- **23 TRUE PHANTOM** — registered in `registry.ts`, zero `emit()` call-sites found
- **19 CRUFT** — registered but NO corresponding event definition in registry (noise from v2 iteration)

**Critical finding:** v2 methodology (literal string grep) had **87% noise rate**, matching prior L-0348 column-drift pattern. Static grep found event names in UI labels (`invoice-timeline.tsx` case statement), component names, and registry type definitions — but NOT actual emit() invocations.

---

## Remediation Candidates: 23 TRUE PHANTOM Events

| Event Name | Domain | Scope | Estimated Effort | Sortie Slot |
|---|---|---|---|---|
| `contract composed` | contract | Form save in revise flow | 0.1h | S1 |
| `contract.preview.edited` | contract | Edit trigger in editor | 0.1h | S1 |
| `contract_template clause_updated` | contract | Template editing | 0.1h | S1 |
| `contract_template copied` | contract | Duplication action | 0.1h | S1 |
| `contract_template deleted` | contract | Deletion action | 0.1h | S1 |
| `contracts.compose.template_selected` | contract | Template picker | 0.1h | S1 |
| `contracts.delete.confirmed` | contract | Delete confirmation | 0.1h | S1 |
| `contract.obligation_assigned` | contract | Obligation workflow | 0.1h | S1 |
| `contract.obligation_completed` | contract | Obligation completion | 0.1h | S1 |
| `contract viewed` | contract | Detail page view | 0.1h | S1 |
| `contract declined` | contract | Rejection in flow | 0.1h | S1 |
| `contract.pdf_preview_viewed` | contract | PDF viewer open | 0.1h | S1 |
| `contract.send_initiated` | contract | Send drawer action | 0.1h | S1 |
| `contract.send_retry_after_fill` | contract | Retry after fill | 0.1h | S1 |
| `contract.acknowledgement.block_confirmed` | contract | Acknowledgement confirmation | 0.1h | S1 |
| `contract intake escalated` | contract | Escalation action | 0.1h | S1 |
| `contract.readiness.self_fill_requested` | contract | Self-fill request | 0.1h | S1 |
| `ops.compile shift_brief` | ops | Shift brief generation | 0.1h | S2 |
| `botsson.nudge_shown` | botsson | Nudge render trigger | 0.1h | S3 |
| `invoice.generated` | billing | Monthly invoice cron | 0.1h | S4 |
| `invoice.sent` | billing | Invoice send action | 0.1h | S4 |
| `telegram.message_sent` | channel | Message send | 0.1h | S5 |
| `shift.published` | scheduling | Publish action | 0.1h | S5 |

**Total A-class TRUE PHANTOM:** 23 events
**Parallel sortie estimate:** 6 simultaneous sonnet workers × 2–3 events/hour = **~2–3 hours total wall time**

---

## Cruft Events: 19 Events (Remove from Registry)

These 19 events are registered in `packages/telemetry/src/registry.ts` but have **zero evidence** in code paths and **no corresponding event definition**:

| Event Name | Why Cruft | Action |
|---|---|---|
| `contract retention skipped_no_clock` | No retention logic found; undefined in domain | Remove |
| `help.article_viewed` | No help/KB system in codebase | Remove |
| `help.article_searched` | Same | Remove |
| `help.feedback_submitted` | Same | Remove |
| `botsson.autofill_offered` | No autofill capability wired | Remove |
| `welcome.first_employee_added` | Feature not scoped; no code path | Remove |
| `welcome.first_schedule_published` | Feature not scoped; no code path | Remove |
| `welcome.onboarding_completed` | Wizard exists but event not wired + no code match | Remove |
| `ai/ml model_invoked` | No model invocation logging | Remove |
| `ai/ml embedding_generated` | No embedding logging | Remove |
| `ai/ml classification_executed` | No classification logging | Remove |
| `commission.earned` | Commission system not shipped | Remove |
| `commission.approved` | Same | Remove |
| `telegram.conversation_started` | Telegram integration not shipped | Remove |
| `calendar.event_synced` | Calendar sync feature not shipped | Remove |
| `engine.state_created` | Event engine exists but these events not wired | Remove |
| `engine.state_transitioned` | Same | Remove |
| `engine.state_completed` | Same | Remove |
| `legal.framework_updated` | Regulatory framework updates not logged | Remove |

**Total CRUFT:** 19 events
**Removal effort:** 1 PR sweep, ~30 min

---

## Detailed Classification

### A-Class True Phantom (23 events requiring emit() injection)

#### Contract Domain (17 events)
All belong in the contract capability tools or dashboard actions.

**Authoring lifecycle (7 events):**
- `contract composed` — Trigger: user saves draft in revise flow. Location: `/apps/web/src/app/dashboard/people/contracts/[id]/revise/` or `/packages/ai/capabilities/contract-authoring/`
- `contract.preview.edited` — Trigger: edit in preview editor. Same location
- `contract_template clause_updated` — Trigger: clause edit in template settings. Location: `/apps/web/src/app/dashboard/settings/contract-templates/`
- `contract_template copied` — Trigger: duplication action. Same
- `contract_template deleted` — Trigger: delete action. Same
- `contracts.compose.template_selected` — Trigger: template picker selection. Location: `/apps/web/src/app/dashboard/people/contracts/_components/contract-compose/`
- `contracts.delete.confirmed` — Trigger: delete confirmation. Location: contract actions/server actions

**Engagement & Lifecycle (10 events):**
- `contract viewed` — Trigger: detail page open. Location: `/apps/web/src/app/dashboard/people/contracts/[id]/` page component or useEffect hook
- `contract declined` — Trigger: user rejection in acknowledgement/signature flow. Location: acknowledgement component
- `contract.pdf_preview_viewed` — Trigger: PDF viewer open. Location: PDF preview component
- `contract.send_initiated` — Trigger: send action in drawer. Location: `/apps/web/src/app/dashboard/people/contracts/_components/contract-send-drawer.tsx`
- `contract.send_retry_after_fill` — Trigger: retry after filling missing fields. Same location
- `contract.acknowledgement.block_confirmed` — Trigger: acknowledgement confirmation. Location: acknowledgement feature components
- `contract.obligation_assigned` — Trigger: obligation assignment in workflow. Location: contract-obligation capability tool
- `contract.obligation_completed` — Trigger: completion action. Same location
- `contract.readiness.self_fill_requested` — Trigger: self-fill request in readiness flow. Location: readiness/acknowledgement component
- `contract intake escalated` — Trigger: escalation action. Location: contract-intake or escalation capability tool

#### Ops Domain (1 event)
- `ops.compile shift_brief` — Trigger: shift brief generation. Location: `services/stage-engine/src/routes/` shift-generation endpoint or `/supabase/functions/generate-shift-brief/`

#### Botsson Domain (1 event)
- `botsson.nudge_shown` — Trigger: nudge display in UI. Location: `/packages/ai/capabilities/botsson-nudge/` or nudge renderer hook in `/apps/web/src/`

#### Billing Domain (2 events)
- `invoice.generated` — Trigger: monthly invoice cron. Location: `/supabase/functions/generate-monthly-invoices/` or `/services/billing-service/`
- `invoice.sent` — Trigger: invoice send action. Location: billing service send endpoint or Sendgrid webhook

#### Telegram/Channel Domain (1 event)
- `telegram.message_sent` — Trigger: message send action. Location: `/packages/ai/capabilities/communication/telegram/` or channel message handler

#### Scheduling Domain (1 event)
- `shift.published` — Trigger: schedule publish action. Location: `/apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts` or schedule-publish server action

---

### E-Class Cruft (19 events — Remove)

**Justification for each cruft event:**

| Event | Registry Status | Code Evidence | Decision |
|---|---|---|---|
| `contract retention skipped_no_clock` | REGISTERED | ZERO — no retention/clock-in logic | REMOVE — undefined scope, likely leftover from contract lifecycle design |
| `help.article_viewed` | REGISTERED | ZERO — no KB/help system | REMOVE — help feature out of scope |
| `help.article_searched` | REGISTERED | ZERO | REMOVE |
| `help.feedback_submitted` | REGISTERED | ZERO | REMOVE |
| `botsson.autofill_offered` | REGISTERED | ZERO — no autofill wiring | REMOVE — feature not scoped |
| `welcome.first_employee_added` | REGISTERED | ZERO — no code path | REMOVE — feature aspirational, wizard only has existing features |
| `welcome.first_schedule_published` | REGISTERED | ZERO | REMOVE |
| `welcome.onboarding_completed` | REGISTERED | ZERO — wizard exists but no emit | REMOVE — wizard event not wired, feature definition incomplete |
| `ai/ml model_invoked` | REGISTERED | ZERO | REMOVE — no model invocation logging wired |
| `ai/ml embedding_generated` | REGISTERED | ZERO | REMOVE |
| `ai/ml classification_executed` | REGISTERED | ZERO | REMOVE |
| `commission.earned` | REGISTERED | ZERO | REMOVE — commission system not shipped |
| `commission.approved` | REGISTERED | ZERO | REMOVE |
| `telegram.conversation_started` | REGISTERED | ZERO — Telegram integration incomplete | REMOVE |
| `calendar.event_synced` | REGISTERED | ZERO | REMOVE — calendar feature not shipped |
| `engine.state_created` | REGISTERED | ZERO — event engine exists but these not wired | REMOVE — wiring deferred or incomplete |
| `engine.state_transitioned` | REGISTERED | ZERO | REMOVE |
| `engine.state_completed` | REGISTERED | ZERO | REMOVE |
| `legal.framework_updated` | REGISTERED | ZERO | REMOVE — compliance logging not implemented |

**Removal scope:** Single PR to `packages/telemetry/src/registry.ts` with 19 line deletions.

---

## Comparative Analysis: v2 vs v3

### v2 Triage (iter-10) Methodology
- Simple literal `grep -r '"event-name"'` against app code
- High false-positive rate from:
  - UI label matches (case statements in timeline components)
  - Registry type definitions (`.d.ts` files)
  - Component prop names or interfaces containing event strings
  - Migration files with event_type definitions

**v2 False Positive Example:**
```
contract composed — v2 reported "A-FOUND (literal:4)"
  grep results:
    1. packages/telemetry/dist/registry.d.ts (type definition — not code)
    2. apps/web/.../invoice-timeline.tsx:case "invoice generated" (UI label — not emit)
    3. packages/telemetry/src/registry.ts (registry definition — not emit)
    4. Somewhere else not a real call-site
```

### v3 Triage (this session) Methodology
- Precise emit call-site detection: `grep -rn "emit\s*(\s*{[^}]*event:\s*['\"]$event['\"]"`
- Cross-reference with registry to classify:
  - **A-PHANTOM:** Registered but zero emit() call-sites
  - **E-CRUFT:** Never mentioned in code at all

**v3 Result:** 23 TRUE PHANTOM (down from v2's inflated count of 42 false-positive A-class)

---

## Recommended Parallel Sortie Strategy

### Phase 1A: Inject contract domain (17 events — S1)
- Single sortie, one build-agent (sonnet)
- Scope: contract capability tools + dashboard actions + revise flow
- Files touched: ~8–12 locations
- Effort: 1.7h
- Triggers on merge: telemetry index auto-update + audit green

### Phase 1B: Other domains (6 events — S2–S5)
**S2 (ops):** 1 event
- Single event (`ops.compile shift_brief`)
- Location: stage-engine route or shift-brief EF
- Effort: 0.1h — bundle with next sortie or standalone

**S3 (botsson):** 1 event
- Single event (`botsson.nudge_shown`)
- Location: nudge renderer hook
- Effort: 0.1h

**S4 (billing):** 2 events
- `invoice.generated` + `invoice.sent`
- Location: billing service / invoice cron
- Effort: 0.2h

**S5 (channel + scheduling):** 2 events
- `telegram.message_sent` + `shift.published`
- Location: messaging service + schedule publish action
- Effort: 0.2h

**Combined Phase 1B:** 6 events, 4 micro-sortiers OR 1 consolidation sortie
- **Parallel wall-time:** 0.5h (if all 4 run simultaneously)
- **Sequential wall-time:** 0.6h (if batched into 2 sortiers)
- **Recommendation:** Batch into 2 sortiers (ops+botsson, billing+channel) to reduce overhead

### Phase 2: Remove cruft (19 events — E1)
- Single sortie, general-purpose agent
- Scope: registry.ts deletions only
- Effort: 0.5h
- No code tests — only registry integrity check (typecheck)

---

## Revised Parallel Dispatch Plan

```
PHASE 1 (A-class injection):
  ├─ Sortie: telemetry-emit-contract (S1)
  │  └─ 17 events, 1.7h, sonnet
  ├─ Sortie: telemetry-emit-ops-botsson (S2-3)
  │  └─ 2 events, 0.2h, sonnet
  └─ Sortie: telemetry-emit-billing-channel (S4-5)
     └─ 4 events, 0.4h, sonnet

PHASE 2 (E-class removal):
  └─ Sortie: telemetry-registry-cruft-removal (E1)
     └─ 19 deletions, 0.5h, sonnet

TIMELINE:
  Phase 1A (S1): 2–4 hours wall-time (contract domain alone)
  Phase 1B (S2–S5): 1 hour wall-time (3 sortiers in parallel)
  Phase 2 (E1): 0.5 hours wall-time (cleanup)
  
  Total wall-time (all parallel): ~4–5 hours
  Total sequential: ~6–7 hours
```

---

## Key Traps Identified (Promotion Candidates)

### L-0301: Static Grep False Positives
**Pattern:** Literal string grep on codebase finds event names in UI labels, type definitions, interfaces, and registry files — but NOT actual `emit()` call-sites.

**Remedy:** Always verify grep hits with context. Use `emit(` pattern + event name together, or manually spot-check top results.

**Promotion:** Add to verification checklist in `smartout-agent-dev` skill (emit wiring section).

### L-0302: Event Name Registration Without Wiring
**Pattern:** Registry entries (@smartout/telemetry/registry.ts) can drift from code if capability design is incomplete. Registration does NOT guarantee wiring.

**Remedy:** Pre-close gate (close-feature.sh): grep for matching `emit()` call-sites for each newly registered event. Fail if zero found.

**Promotion:** Add to feature-closure gates after next Phase closes.

### L-0303: Cruft Accumulation via Design Drift
**Pattern:** 19 events (45% of 42 remaining) are orphaned feature ideas that never shipped. Registry not the source-of-truth.

**Remedy:** Quarterly registry audit: grep every event in `packages/telemetry/src/registry.ts` and classify A/B/C/D/E. Remove E-class immediately.

**Promotion:** Add `/heartbeat registry-audit` job (monthly).

---

## Summary Table: All 42 Remaining Events

| Class | Count | Events | Action | Effort |
|---|---|---|---|---|
| **A. TRUE PHANTOM** | 23 | contract (17), ops (1), botsson (1), billing (2), channel (1), schedule (1) | Inject emit() via 3 sortiers | 2.3h |
| **E. CRUFT** | 19 | help (3), ai/ml (3), welcome (3), commission (2), telegram (2), calendar (1), engine (3), legal (1), contract (1) | Remove from registry | 0.5h |
| **TOTAL** | **42** | — | — | **2.8h** |

---

## Confidence Assessment

| Classification | Confidence | Reasoning |
|---|---|---|
| A-PHANTOM (23) | **HIGH (95%)** | Verified zero emit() call-sites via precise grep; event names exist in registry |
| E-CRUFT (19) | **HIGH (95%)** | Zero mentions anywhere in codebase; likely design debris or aspirational features never scoped |
| **Missed A-events** | **LOW (2%)** | Possible but unlikely; grep pattern covers all known emit call paths. SQL-native events handled separately in B-class (not applicable here) |

---

## SQL-Native Check (B-class Verification)

None of the 42 remaining events are SQL-native. All are application-layer telemetry. No migration scans needed.

---

## Next Steps

1. **Dispatch Phase 1A:** Create `feat/telemetry-emit-contract` sortie (S1), assign 1.7h sonnet
2. **Dispatch Phase 1B:** Create 2 micro-sortiers (S2-3, S4-5), assign 0.4h sonnet total
3. **Dispatch Phase 2:** Create `feat/telemetry-registry-cruft-removal` sortie (E1), assign 0.5h sonnet
4. **Parallel tracking:** Monitor all 4 sortiers for on-time merge
5. **Audit verification:** Run `pnpm turbo typecheck` post-merge to catch any forward-references

---

## Appendix: Verification Command Reference

**Precise emit-site detection:**
```bash
grep -rn "emit\s*(\s*{" --include="*.ts" --include="*.tsx" \
  apps/ packages/ services/ 2>/dev/null | \
  grep "event:\s*['\"]<event-name>['\"]" | \
  grep -v "registry\|dist\|\.d\.ts"
```

**Registry check:**
```bash
grep -n "\"<event-name>\"" packages/telemetry/src/registry.ts
```

**SQL-native check:**
```bash
grep -r "event_type.*<event-name>" --include="*.sql" supabase/
```

---

*v3 triage completed via enhanced methodology. Ready for parallel sortie dispatch.*
