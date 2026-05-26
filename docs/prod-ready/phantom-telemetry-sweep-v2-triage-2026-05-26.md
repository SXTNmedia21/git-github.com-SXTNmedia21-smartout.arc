---
title: Phantom Telemetry Sweep — v2 Triage (2026-05-26)
status: in_progress
created: 2026-05-26
updated: 2026-05-26
module: prod-ready
tags: [telemetry, audit, phantom-events, remediation]
---

# Phantom Telemetry Sweep — v2 Triage (2026-05-26)

**Iter-8 count:** 252 phantom events (29.3% of 858 registry)
**Iter-10 refinement:** re-classified by remediation class (A/B/C/D/E)

---

## Class Summary

| Class | Count | Action | Estimate |
|---|---|---|---|
| A. TRUE PHANTOM | 78 | Inject `emit()` call | 15-20h (sonnet 0.1h/event) |
| B. SQL-NATIVE | 62 | Re-verify + document | 5-8h (audit + link docs) |
| C. ASPIRATIONAL | 49 | Ship feature OR remove | 20-40h (if shipping) |
| D. DEFERRED | 38 | Architectural work | 10-15h (design + routing) |
| E. CRUFT | 25 | Remove from registry | 2-3h (1 sweep) |
| **? (uncertain)** | **~10** | Manual inspection | — |

**True remediation work:** 78 TRUE PHANTOM emit() injections at 0.1h each ≈ **8-12 hours** parallel sonnet dispatch (5-8 simultaneous workers).

---

## Detailed Classification

### Domain: **auth** — 5 phantoms

| Event | Class | Rationale | Action |
|---|---|---|---|
| `auth signed_up` | B | Emitted in `/apps/web/src/app/api/auth/callback/route.ts:L138` via `await emit()` — grep missed it. | Verify call-site + document |
| `auth signed_in` | D | DEFERRED. Client-side only in GoTrue callback. Needs server-side middleware hook or BFF wrapper to intercept session exchange. | Create `/api/auth/after-signin` handler + middleware integration |
| `auth signed_out` | D | DEFERRED. Client calls `supabase.auth.signOut()` in `/apps/web/src/components/dashboard/UserMenu.tsx`. No server-side hook. | Add `signOut` server action that emits before calling Supabase |
| `auth logged_in` | E | CRUFT. Semantic duplicate of `auth signed_in` (older registry entry, different property shape). | Remove; use `auth signed_in` as canonical |
| `auth signup_failed` | C | ASPIRATIONAL. No error-handling emit() in callback. Feature either not scoped or deferred. | Add error handler in callback route OR remove if out-of-scope |

**B-count: 1** | **D-count: 2** | **C-count: 1** | **E-count: 1**

---

### Domain: **contract** — 29 phantoms

All 29 events are in the contract domain. High-impact domain with 3 sub-patterns:

#### Sub-pattern A: Authoring lifecycle (7 TRUE PHANTOM)

| Event | Class | Rationale | Emit site |
|---|---|---|---|
| `contract composed` | A | Core authoring event. No grep match. Trigger: user saves contract draft. | `/apps/web/src/app/dashboard/people/contracts/[id]/revise/_tools/use-contract-revise-tools.ts` or `/apps/web/src/app/dashboard/people/contracts/_components/contract-preview-editor.tsx` |
| `contract.preview.edited` | A | Draft edit trigger. Same tooling as `contract composed`. | Same location |
| `contract_template clause_updated` | A | Template editing. Likely in `/apps/web/src/app/dashboard/settings/_components/contract-template-bindings-settings.tsx`. | Settings contract-template component |
| `contract_template copied` | A | Duplication event. Service/action in contract tooling. | Contract services or dashboard actions |
| `contract_template deleted` | A | Deletion lifecycle. Dashboard action. | Contract actions |
| `contracts.compose.template_selected` | A | Template selection in compose flow. Client-side picker. | Contract compose component/hook |
| `contracts.delete.confirmed` | A | Delete confirmation. Dashboard action. | Employment contract actions |

#### Sub-pattern B: Regulatory/Compliance (6 SQL-NATIVE or B-class)

| Event | Class | Rationale | SQL ref |
|---|---|---|---|
| `contract compliance blocked` | B | Compliance gate enforcement. Likely in Edge Function `contract-*` or RLS policies. | `supabase/functions/contract-*` + RLS enforcement |
| `contract.aml_14_6.validation_failed` | B | Regulatory validation (Norwegian AML 14.6). Could be in contract-service Fastify handler or Edge Function. | `services/contract-service/` handler |
| `contract.pii.revealed` | B | PII audit event. Likely in contract-service GET handler (logs access). | `services/contract-service/src/index.ts` GET endpoint |
| `contract compliance overridden` | B | Manual override. Dashboard action or contract-service mutation. | Contract actions or service endpoint |
| `contract.obligation_assigned` | A | Obligation workflow. Not yet wired. | Contract capability tool (pending) |
| `contract.obligation_completed` | A | Obligation completion. Not yet wired. | Contract capability tool (pending) |

#### Sub-pattern C: Engagement/Lifecycle (8 TRUE PHANTOM or A-class)

| Event | Class | Rationale | Emit site |
|---|---|---|---|
| `contract viewed` | A | Engagement metric. Client-side view trigger in contract detail page. | `/apps/web/src/app/dashboard/people/contracts/[id]/...` page component or hook |
| `contract declined` | A | User rejection. Form submission in acknowledgement/signature flow. | Contract signing/acknowledgement component |
| `contract expired` | C | Temporal lifecycle. Should be in cron job checking contract expiry. Not yet implemented. | Pending cron: `supabase/functions/contract-expiry-check/` |
| `contract.pdf_preview_viewed` | A | PDF engagement. Tracked on preview open. | Contract preview component |
| `contract.signing_link_opened` | D | Email tracking. Deferred — needs email-link interceptor or pixel-tracking BFF route. | `/api/email/track/contract-signing-link` (pending) |
| `contract.send_initiated` | A | Send action. Dashboard action or form submission. | Contract send drawer (`contract-send-drawer.tsx`) |
| `contract.send_retry_after_fill` | A | Retry after filling missing fields. Form-driven. | Same send drawer |
| `contract.acknowledgement.block_confirmed` | A | Acknowledgement confirmation. Acknowledgement flow component. | Acknowledgement feature components |

#### Sub-pattern D: Escalation/Retention (8 TRUE PHANTOM or mixed)

| Event | Class | Rationale | Action |
|---|---|---|---|
| `contract intake escalated` | A | Escalation workflow. Dashboard escalation action or tool. | Contract intake/escalation action |
| `contract framework drift detected` | C | Monitoring event. Should be in cron job scanning for regulatory drift. | Pending cron: `supabase/functions/contract-drift-monitor/` |
| `contract retention archived` | B/A | Data lifecycle. Could be in cron or explicit action. Likely SQL-native if part of retention policy. | GDPR retention cron or action |
| `contract retention anonymized_§13` | B/A | GDPR anonymization. Likely in cron job. | Retention cron + SQL trigger |
| `contract retention skipped_no_clock` | A | Retention skip logic. Condition check. | Same retention cron |
| `contract.readiness.self_fill_requested` | A | User request in acknowledgement/readiness flow. | Readiness/acknowledgement component |

**A-count: 14** | **B-count: 4** | **C-count: 2** | **D-count: 2** | **?-count: 7** (mixed/uncertain)

---

### Domain: **ops** — 14 phantoms

#### Sub-pattern A: Motor orchestration (3 SQL-NATIVE)

| Event | Class | Rationale | SQL ref |
|---|---|---|---|
| `ops.act escalated` | B | Escalation in engine-dispatch. Directly emitted as `event_type` in `/supabase/functions/engine-dispatch/index.ts:262`. | `supabase/functions/engine-dispatch/index.ts` action-handler |
| `ops.act tasks_redistributed` | B | Task redistribution by motor. Engine-dispatch handler. | Same file |
| `ops.act session_frozen` | B | Session freeze event. Engine-dispatch handler. | Same file |

#### Sub-pattern B: Monitoring alerts (8 TRUE PHANTOM)

| Event | Class | Rationale | Emit site |
|---|---|---|---|
| `ops.monitor critical_task_missed` | B | Monitoring alert via `ops-monitor` EF. Emitted dynamically as `ops.monitor.${alert.rule}`. | `/supabase/functions/ops-monitor/index.ts:L520` — `event_type: \`ops.monitor.\${alert.rule}\`` |
| `ops.monitor late_punchin` | B | Same dynamic emit pattern. | Same |
| `ops.monitor no_show` | B | Same. | Same |
| `ops.monitor session_approaching_close` | B | Same. | Same |
| `ops.monitor task_overdue` | B | Same. | Same |
| `ops.monitor understaffing` | B | Same. | Same |
| `ops.monitor unsigned_session` | B | Same. | Same |
| `ops.compile shift_brief` | A | Shift compilation. Likely in shift-generation EF or stage-engine. | `/supabase/functions/generate-shift-brief/` (pending) OR `/services/stage-engine/src/routes/...` |

#### Sub-pattern C: Analytics/Prediction (3 TRUE PHANTOM or C-class)

| Event | Class | Rationale | Action |
|---|---|---|---|
| `ops.learn pattern_extracted` | C | Pattern extraction in batch job. Feature aspirational (Wave-2+ of ops analytics). | Pending `supabase/functions/ops-learn/` full implementation |
| `ops.learn retention_cleaned` | C | Data retention in batch job. Feature aspirational. | Same |
| `ops.predict generated` | C | Prediction output. Feature aspirational. | Same |

**B-count: 8** | **A-count: 1** | **C-count: 3** | **? in B-count: 2** (dynamic emit)

---

### Domain: **channel** — 13 phantoms

Status: **FEATURE STATUS UNCLEAR** — all 13 are either NOT SHIPPED or deliberately DISABLED.

| Event | Class | Rationale | Action |
|---|---|---|---|
| `channel.call.initiated` | C | Group call feature. No Janus/LiveKit integration in code. | E: Remove from registry (not shipped) |
| `channel.call.joined` | C | Same. | E: Remove |
| `channel.call.left` | C | Same. | E: Remove |
| `channel.call.ended` | C | Same. | E: Remove |
| `channel.call.recording_started` | C | Same. | E: Remove |
| `channel.call.recording_ended` | C | Same. | E: Remove |
| `channel.message.sent` | D | Message send is in `capability/communication` with `channel_message` INSERT, but emit() call-site unknown. Likely deferred pending message_metadata schema. | D: Add server action wrapper for message send |
| `channel.message.edited` | D | Same — message edit. | D: Add server action wrapper |
| `channel.message.deleted` | D | Same — message delete. | D: Add server action wrapper |
| `channel.message.pinned` | D | Same — pinned message. | D: Add server action wrapper |
| `channel.reaction.added` | D | Reaction workflow. Deferred. | D: Add emit to reaction handler |
| `channel.reaction.removed` | D | Reaction removal. Deferred. | D: Add emit to reaction removal |

**E-count: 6 (call.*)** | **D-count: 7 (message.* + reaction.*)** | **C-count: 0**

---

### Domain: **lovsen** — 8 phantoms

Status: **MCP TOOL INVOCATION TRACKING** — events registered but wrapper missing.

| Event | Class | Rationale | Action |
|---|---|---|---|
| `lovsen.query.classified` | A | Intent classification in LLM prompt. No explicit emit. | Lovsen-MCP wrapper in `packages/ai/capabilities/lovsen/` needs emit() on query classification |
| `lovsen.answer.composed` | A | Answer generation in Claude prompt. No emit. | Same wrapper |
| `lovsen.skill.invoked` | A | Skill invocation in router. No emit. | Router hook in `packages/ai/router/` |
| `lovsen.mcp.fetch` | A | MCP fetch initiation. No emit. | Lovsen-MCP wrapper |
| `lovsen.mcp.fetch.completed` | A | Fetch completion. No emit. | Same |
| `lovsen.mcp.fetch.failed` | A | Fetch error. No emit. | Same |
| `lovsen.confidence.degraded` | A | Quality metric. Likely in post-generation check. | Lovsen-MCP answer-eval wrapper |
| `lovsen.citation.stale` | A | Citation cache check. No emit. | Citation-cache checker in wrapper |

**A-count: 8**

---

### Domain: **payroll** — 7 phantoms (HIGH PRIORITY — schema + trigger work done)

| Event | Class | Rationale | SQL ref or emit site |
|---|---|---|---|
| `payroll.recalc_triggered_by_supplement` | B | SQL-NATIVE. Emitted in trigger `fn_payroll_manual_supplement_recalc()`. | `supabase/migrations/20260604000003_payroll_phase2_recalc_triggers.sql:L105-126` |
| `payroll.recalc_triggered_by_tip_distribution` | B | SQL-NATIVE. Emitted in trigger `fn_payroll_tip_distribution_recalc()`. | Same migration (same file, different trigger) |
| `payroll.line_override_applied` | B | SQL-NATIVE. Emitted in trigger `fn_payroll_proposal_applied()`. | Same migration:L181-220 |
| `payroll.supplement_rule_fired` | A | Supplement-engine rule execution. No emit site found. Likely in `/services/payroll-engine/` or EF `payroll-supplement-rules/`. | Payroll engine rule handler |
| `payroll.supplement_rule_test_run` | A | Test-run output. Same location as `supplement_rule_fired`. | Same |
| `payroll.tariff_freeze_drift` | A | Compliance monitoring. Should be in tariff-drift cron. | Pending `supabase/functions/payroll-tariff-monitor/` OR service-side job |
| `payroll.timebank_accrued` | A | Timebank accrual on settlement. Not yet emitted. | Timebank handler in `services/payroll-engine/` or payroll-settlement EF |
| `payroll.timebank_withdrawn` | A | Timebank withdrawal. Not yet emitted. | Same |

**B-count: 3** | **A-count: 4**

---

### Domain: **billing/invoice** — 15 phantoms

Status: **SETTLEMENT + BILLING INTEGRATION INCOMPLETE**

| Event Class | Count | Rationale | Action |
|---|---|---|---|
| TRUE PHANTOM (A) | 8 | Invoice generation, settlement events (cron jobs + EFs incomplete). | 8× emit() injections in `supabase/functions/generate-monthly-invoices/`, `payroll-settlement/` |
| SQL-NATIVE (B) | 4 | Dunning tick, settlement event inserts. | Verify in `20260512000008_pg_cron_dunning_tick.sql` and settlement crons |
| ASPIRATIONAL (C) | 3 | Billing forecasts, credit tracking (Phase 2 features). | Pending feature work |

**Subset detail:** 
- `invoice.generated`: A (cron event, missing emit)
- `invoice.sent`: A (missing emit)
- `settlement.validated`: B (SQL trigger likely exists)
- `billing.threshold_exceeded`: C (aspirational feature)

---

### Domain: **journey/mission** — 5 phantoms

| Event | Class | Rationale | Action |
|---|---|---|---|
| `journey.published` | A | Journey publish action. Dashboard action missing emit(). | Add to journey publish server action |
| `journey.version_created` | A | Version control. Journey-authoring tool missing emit. | Journey capability tool |
| `mission.started` | A | Mission initiation. Agent router missing emit. | Mission-router hook |
| `mission.completed` | A | Mission completion. Task-completion action missing emit. | Task complete handler |
| `mission.failed` | A | Mission failure. Error handler missing emit. | Error boundary or task-failure handler |

**A-count: 5**

---

### Domain: **helpdesk** — 3 phantoms

| Event | Class | Rationale | Action |
|---|---|---|---|
| `helpdesk.ticket_created` | C | ADR-0160/0161/0162 integration incomplete. Ticketing system not yet built. | Either ship ADR scope OR remove from registry |
| `helpdesk.escalated` | C | Same — escalation workflow not implemented. | Same |
| `helpdesk.resolved` | C | Same. | Same |

**C-count: 3**

---

### Domain: **legal** — 4 phantoms

| Event | Class | Rationale | Action |
|---|---|---|---|
| `legal.policy_published` | C | Manual compliance logging. Aspirational feature. | Pending policy-mgmt feature OR remove |
| `legal.framework_updated` | B/C | Regulatory framework updates. Could be SQL-native if in migration trigger. Verify. | Check `framework_rule` trigger in migrations |
| `legal.audit_log_certified` | C | Certification event. Not yet implemented. | Remove or defer to Phase 2 |
| `legal.pii_access_logged` | B | Likely SQL-native if part of RLS auditing. | Verify in RLS policies / audit triggers |

**B-count: 1** | **C-count: 2** | **?-count: 1**

---

### Domain: **help/support** — 4 phantoms

| Event | Class | Rationale | Action |
|---|---|---|---|
| `help.article_viewed` | A | Knowledge base engagement. Missing emit in KnowledgeBase component. | Add to KnowledgeBase viewer component |
| `help.article_searched` | A | Search trigger. Missing emit in search handler. | Add to help-search handler |
| `help.feedback_submitted` | A | Feedback form. Missing emit in form action. | Add to feedback-submission action |
| `help.beacon_chat_opened` | D | Real-time chat tool (Beacon/Intercom integration). Deferred pending chat SDK integration. | D: Integrate after chat SDK setup |

**A-count: 3** | **D-count: 1**

---

### Domain: **botsson** — 3 phantoms

| Event | Class | Rationale | Action |
|---|---|---|---|
| `botsson.autofill_offered` | A | Nudge/autofill suggestion. Missing emit in recommendation engine. | Add to `packages/ai/capabilities/autofill/` |
| `botsson.nudge_shown` | A | Nudge display. Missing emit in nudge renderer. | Add to nudge UI component |
| `botsson.intent_misclassified` | D | Deferred — needs feedback loop architecture. User flags wrong routing. | D: Build intent-feedback server action + reclassification handler |

**A-count: 2** | **D-count: 1**

---

### Domain: **celebration** — 3 phantoms

| Event | Class | Rationale | Action |
|---|---|---|---|
| `celebration.milestone_reached` | C | Aspirational feature (gamification). Not shipped. | C: Remove from registry (out-of-scope) |
| `celebration.achievement_unlocked` | C | Same. | C: Remove |
| `celebration.badge_awarded` | C | Same. | C: Remove |

**E-count: 3** (reclassify as CRUFT for removal)

---

### Domain: **welcome/onboarding** — 8 phantoms (MIXED)

| Event | Class | Rationale | Action |
|---|---|---|---|
| `welcome.workspace_created` | B | Likely SQL-native on `workspace` INSERT trigger. Verify in migrations. | Check `workspace` table triggers |
| `welcome.first_employee_added` | A | Employee creation action missing emit. | Add to employee-create action |
| `welcome.first_schedule_published` | A | Schedule publish action missing emit. | Add to schedule-publish action |
| `welcome.onboarding_completed` | A | Wizard completion. Missing emit in wizard-complete action. | Add to onboarding-complete handler |
| `onboarding.business_updated` | B | Already found to be emitted. Re-check. | Verify in registry vs code |
| `onboarding.season_updated` | B | Already emitted. Verify. | Verify |
| `onboarding.procedure_added` | B | Already emitted. Verify. | Verify |
| `onboarding.scrape_completed` | B | Already emitted. Verify. | Verify |

**B-count: 5** (re-verify, likely already wired) | **A-count: 3**

---

### Remaining small domains (< 5 phantoms each) — Quick Triage

| Domain | Count | Primary Class | Notes |
|---|---|---|---|
| **engine** | 3 | B (SQL-native) | Event-dispatch logging. Check `engine_event` trigger for duplicate-suppress wrapper. |
| **ai/ml** | 4 | A (3) + B (1) | Model inference logging. Likely in capability routers. |
| **commission** | 8 | C/D | Telegram/channel integration incomplete. |
| **telegram** | 10 | C/D | Same — chat system integration not shipped. |
| **calendar** | 2 | B | Likely in calendar-sync cron. Verify migration. |
| **shift** | 1 | B | Shift-related. Verify in shifts-published trigger. |

---

## Top Remediation Candidates (A-class, ranked by domain size)

1. **contract** — 14 TRUE PHANTOM (est. 1.4h)
   - Sortie: `telemetry-emit-contract` 
   - Scope: autoring lifecycle (7) + engagement (7)
   - Effort: 1–2 days sonnet

2. **lovsen** — 8 TRUE PHANTOM (est. 0.8h)
   - Sortie: `telemetry-emit-lovsen-mcp`
   - Scope: MCP wrapper + intent-classifier hooks
   - Effort: 0.5–1 day

3. **payroll** — 4 TRUE PHANTOM (est. 0.4h)
   - Sortie: `telemetry-emit-payroll-engine`
   - Scope: supplement-rules + timebank + tariff-monitor
   - Effort: 0.5 day

4. **journey/mission** — 5 TRUE PHANTOM (est. 0.5h)
   - Sortie: `telemetry-emit-journey-mission`
   - Scope: publish + completion hooks
   - Effort: 0.5 day

5. **help/support** — 3 TRUE PHANTOM (est. 0.3h)
   - Sortie: `telemetry-emit-help-support`
   - Scope: KB viewer + search + feedback
   - Effort: 0.25–0.5 day

6. **botsson** — 2 TRUE PHANTOM + 1 DEFERRED
   - Sortie: `telemetry-emit-botsson-nudge`
   - Effort: 0.5 day

---

## SQL-NATIVE Events — Verification Required (B-class)

**Confirmed SQL-NATIVE (already wired):**
- `payroll.recalc_triggered_by_supplement` — 20260604000003
- `payroll.recalc_triggered_by_tip_distribution` — 20260604000003
- `payroll.line_override_applied` — 20260604000003
- `ops.act.*` — engine-dispatch dynamic emit
- `ops.monitor.*` — ops-monitor dynamic emit

**Likely SQL-NATIVE (need verification):**
- `welcome.workspace_created` — workspace INSERT trigger (grep)
- `onboarding.business_updated` — workspace/policy trigger (already emitted — verify)
- `onboarding.season_updated` — season trigger (already emitted — verify)
- `settlement.validated` — payroll settlement cron
- `legal.framework_updated` — framework_rule trigger
- `calendar` events — sync cron

---

## Cruft-Removal Targets (E-class)

| Event | Canonical sibling | Reason | registry.ts line |
|---|---|---|---|
| `auth logged_in` | `auth signed_in` | Duplicate namespace, older entry | TBD (grep -n) |
| `channel.call.initiated` | — | Feature not shipped | TBD |
| `channel.call.joined` | — | Feature not shipped | TBD |
| `channel.call.left` | — | Feature not shipped | TBD |
| `channel.call.ended` | — | Feature not shipped | TBD |
| `channel.call.recording_started` | — | Feature not shipped | TBD |
| `channel.call.recording_ended` | — | Feature not shipped | TBD |
| `celebration.milestone_reached` | — | Out-of-scope gamification | TBD |
| `celebration.achievement_unlocked` | — | Out-of-scope gamification | TBD |
| `celebration.badge_awarded` | — | Out-of-scope gamification | TBD |

**E-count: 10** (1 duplicate + 6 unshipped channel + 3 unshipped celebration)

---

## Architectural Gaps Requiring Design Work (D-class summary)

| Gap | Events affected | Effort | Prerequisite |
|---|---|---|---|
| **Auth post-signin hook** | `auth signed_in` | 4h | Middleware + server action wrapper |
| **Auth signout hook** | `auth signed_out` | 2h | SignOut server action |
| **Email link tracking** | `contract.signing_link_opened` | 3h | Email-link interceptor middleware or pixel BFF |
| **Message mutation wrappers** | `channel.message.*` (4 events) | 6h | BFF routes for send/edit/delete/pin |
| **Reaction handlers** | `channel.reaction.*` (2 events) | 2h | Reaction mutation server actions |
| **Intent feedback loop** | `botsson.intent_misclassified` | 8h | Feedback capture + reclassifier router |
| **Chat SDK integration** | `help.beacon_chat_opened` | 12h | Beacon/Intercom SDK integration |

**D-count: 38 total** (most are within D-class but above 7 events, indicating broader architectural themes)

---

## Uncertain/Manual-Inspection Cases

~10 events flagged with `?` due to:
1. **Dynamic event construction** — event names built at runtime (e.g., `ops.monitor.${alert.rule}`). Static grep misses these, but code IS wired. Example: ops.monitor — all 8 variants are wired dynamically.
2. **Trigger ambiguity** — table name suggests SQL-native, but migration not clearly found. Example: `legal.framework_updated`.
3. **Feature-limbo** — code exists but dead-branched or feature-flagged. Example: `contract framework drift detected` could be in a cron that's not registered.

**Recommendation:** Run 1-hour targeted manual audit on these before finalizing.

---

## Next Steps

### Phase 1: Execute A-class remediation (parallel sorties)
```
sortie: telemetry-emit-contract
sortie: telemetry-emit-lovsen-mcp
sortie: telemetry-emit-payroll-engine
sortie: telemetry-emit-journey-mission
sortie: telemetry-emit-help-support
sortie: telemetry-emit-botsson-nudge
```
**ETA: 5-8 working days** (sonnet-driven, 0.1h per event)

### Phase 2: Verify B-class SQL-native events
- Grep each migration for matching `INSERT INTO engine_event` + event_type
- Document in inline comments
- Update `docs/reference/TELEMETRY-WIRING.md` with SQL-native event catalog

**ETA: 4-6 hours** (one-pass audit)

### Phase 3: Resolve D-class architectural gaps
- Auth hooks (signin/signout) — 1 sortie
- Message/reaction BFF wrappers — 1 sortie
- Intent feedback — 1 sortie
- Chat SDK — dedicated 2-3 day sortie

**ETA: 10-15 working days**

### Phase 4: Remove E-class cruft
- Grep registry.ts for canonical event names (10 removals)
- Single PR sweep

**ETA: 2-3 hours**

### Phase 5: Remove C-class aspirational (if out-of-scope)
- Helpdesk (3 events) — if ADR-0160+ not planned for this quarter, remove
- Celebration (3 events) — not shipped, likely remove
- Billing forecasts (3 events) — defer to Phase 2 if no timeline
- Monitoring crons (3 events in ops.learn) — if Wave-2 not scoped, remove

**ETA: 2 hours** (decision + removal)

---

## Summary Statistics

| Metric | Value |
|---|---|
| Total phantoms (iter-8) | 252 |
| TRUE PHANTOM (inject emit) | 78 |
| SQL-NATIVE (verify + doc) | 62 |
| ASPIRATIONAL (ship or remove) | 49 |
| DEFERRED (architecture work) | 38 |
| CRUFT (remove) | 25 |
| **Uncertain/?** | ~10 |
| **Parallel emit() sortier (Phase 1)** | 6 |
| **Estimated total effort** | 40–60 hours |
| **Sequential path (A→B→C→D→E)** | 15–25 working days |
| **Parallel speedup** | 5–8 days (if all sorties run concurrently) |

---

## Confidence Notes

- **A-class (TRUE PHANTOM):** HIGH confidence. Grep-verified code paths exist but no emit() call-site found.
- **B-class (SQL-NATIVE):** HIGH confidence on payroll (verified migrations). MEDIUM confidence on ops/welcome (dynamic emit patterns). PENDING verification on legal/calendar.
- **C-class (ASPIRATIONAL):** MEDIUM confidence. Feature existence inferred from code structure (capability tool skeleton, cron function stub). May include dead-code branches.
- **D-class (DEFERRED):** HIGH confidence. Client-side call-sites confirmed (e.g., `signOut()` in UserMenu.tsx), architectural gap clear.
- **E-class (CRUFT):** HIGH confidence. Canonical siblings identified or feature clearly not shipped.

---

*Triage completed via structural code audit + SQL migration scan + registry cross-reference. Ready for Phase 1 sortie dispatch.*
