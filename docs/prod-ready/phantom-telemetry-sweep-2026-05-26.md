## Phantom Telemetry Sweep — 2026-05-26

**Registry totals:** 858 events declared | 620 with emit() call-sites | 238 phantom events (27.7% overhead)

### Phantom Events by Domain (Top Priority)

#### **contract** — 29 phantoms (highest impact)
- `contract compliance blocked` — compliance gate enforcement (possibly in Edge Function)
- `contract compliance overridden` — manual override (likely in contract-service or dashboard action)
- `contract composed` — core authoring workflow (contract editor)
- `contract declined` — user rejection
- `contract expired` — temporal lifecycle
- `contract framework drift detected` — monitoring event (possibly in cron)
- `contract intake escalated` — escalation workflow
- `contract retention archived` — data lifecycle
- `contract viewed` — engagement metric
- `contract.acknowledgement.block_confirmed` — sub-namespace (likely in acknowledgement flow)
- `contract.aml_14_6.validation_failed` — regulatory validation
- `contract.dispatch_failed_safe` — error handling (safe-fallback, not critical)
- `contract.obligation_assigned` — obligation workflow
- `contract.obligation_completed` — obligation completion
- `contract.obligation_due_soon` — obligation reminder
- `contract.pdf_preview_viewed` — engagement
- `contract.pii.revealed` — PII audit (possibly in contract-service GET handler)
- `contract.preview.edited` — draft editing
- `contract.readiness.self_fill_requested` — user request
- `contract.retention_anonymized_§13` — GDPR workflow
- `contract.retention_skipped_no_clock` — GDPR skip logic
- `contract.send_initiated` — dispatch workflow
- `contract.send_retry_after_fill` — retry logic
- `contract.signing_link_opened` — email tracking
- `contract_template clause_updated` — template authoring
- `contract_template copied` — template duplication
- `contract_template deleted` — template lifecycle
- `contracts.compose.template_selected` — template selection
- `contracts.delete.confirmed` — deletion confirmation

**Likely locations:** `services/contract-service/`, `apps/web/src/app/dashboard/contracts/`, `supabase/functions/contract-*`

#### **ops** — 14 phantoms (workflow events)
- `ops.act escalated`, `ops.act session_frozen`, `ops.act tasks_redistributed` — task redistribution (ops motor)
- `ops.compile shift_brief` — shift compilation (possibly in shift-generation Edge Function)
- `ops.learn pattern_extracted`, `ops.learn retention_cleaned` — analytics (possibly in batch job)
- `ops.monitor critical_task_missed`, `ops.monitor late_punchin`, `ops.monitor no_show`, `ops.monitor session_approaching_close`, `ops.monitor task_overdue`, `ops.monitor understaffing`, `ops.monitor unsigned_session` — monitoring alerts (cron-driven)
- `ops.predict generated` — prediction output

**Likely locations:** `supabase/functions/ops-*`, `supabase/functions/cron/*`, `stage-engine` (Hono service), `services/` monitoring jobs

#### **channel** — 13 phantoms (communication platform)
- `channel.call.*` — group call events (6 events)
- `channel.message.*` — message lifecycle (4 events)
- `channel.reaction.*` — reaction events (2 events)

**Status:** Likely represents integration with a real-time channel system (e.g. Telegram, WhatsApp). If not in use, should be delisted from registry.

**Likely locations:** `apps/web/src/app/dashboard/komm/`, `services/` channel adapters

#### **lovsen** — 8 phantoms (Norwegian labor-law advisor, ADR-0256)
- `lovsen.answer.composed` — AI response generation
- `lovsen.citation.stale` — cache invalidation
- `lovsen.confidence.degraded` — quality metric
- `lovsen.mcp.fetch`, `lovsen.mcp.fetch.completed`, `lovsen.mcp.fetch.failed` — API calls
- `lovsen.query.classified` — query classification
- `lovsen.skill.invoked` — skill invocation

**Status:** P1 component (ADR-0256). Events likely meant for Claude tool invocation tracking. Grep for missing `emit()` in lovsen-mcp integration.

**Likely locations:** MCP server wrapper, LLM capability tools, Lovsen skill integration (`~/.claude/skills/`)

#### **payroll** — 7 phantoms (calculation + supplement events)
- `payroll.recalc_triggered_by_supplement`, `payroll.recalc_triggered_by_tip_distribution` — trigger events
- `payroll.supplement_rule_fired`, `payroll.supplement_rule_test_run` — supplement logic
- `payroll.tariff_freeze_drift` — compliance monitoring
- `payroll.timebank_accrued`, `payroll.timebank_withdrawn` — timebank operations

**Status:** ADR-0057 (Payroll Phase 1). Missing from cascade procedures or supplement-engine.

**Likely locations:** `supabase/functions/payroll-*`, `services/payroll-engine`, `packages/ai/agents/payroll-calc`

#### **auth** — 5 phantoms (authentication lifecycle)
- `auth logged_in` — session established (likely redundant with `auth signed_in`)
- `auth signed_in`, `auth signed_out`, `auth signed_up` — core auth flow
- `auth signup_failed` — error case

**Status:** HIGH PRIORITY. Core auth events missing. Likely in GoTrue callback or `apps/web/src/lib/auth.ts`.

**Likely locations:** `apps/web/src/app/api/auth/callback`, middleware authentication handler

### Other Notable Phantom Domains

| Domain | Count | Status | Likely Reason |
|--------|-------|--------|--------|
| **helpdesk** | 3 | ADR-0160/0161/0162 | Chat+escalation integration incomplete |
| **legal** | 4 | Regulatory framework | Manual compliance logging missing |
| **help** | 4 | ADR-0219 | Hub integration incomplete |
| **engine** | 3 | Event Engine runtime | Dispatch logging incomplete |
| **botsson** | 3 | Core AI agent | Tool invocation tracking incomplete |
| **celebration** | 3 | ADR-? | Feature not shipped or disabled |
| **commission/telegram** | 18 total | Integration | Telegram/channel bridge incomplete |
| **welcome/onboarding** | 8 total | Wizard flows | Setup wizard missing emit() calls |
| **invoice/billing** | 15 total | Settlement + billing | Cron jobs + Edge Functions missing logging |
| **journey/mission** | 5 total | Journey Engine | Mission lifecycle logging incomplete |

### False-Positive Check

**Dynamic event names:** Events passed as strings (e.g. `eventName` variable, `eventMap[key]`) will NOT be detected by static grep. Spotted 3 cases in code review:
- `apps/web/src/app/dashboard/_actions/transition-session-action.ts` — uses `eventName` variable
- `apps/web/src/app/dashboard/schedule/_hooks/use-employee-roster.ts` — uses `eventMap[data.responseAction]`
- `apps/web/src/app/dashboard/komm/_hooks/use-call-invite.ts` — uses `eventMap` lookup

**Remediation:** Grep these files for hardcoded event names they emit. May reduce phantom count by 5-10%.

### Top-Impact Remediation Priorities

1. **auth (5 phantoms)** — Add emit() to auth callback handler. HIGH CRITICALITY.
2. **contract (29 phantoms)** — Audit contract-service + dashboard actions. 90% likely in contract-authoring workflow.
3. **ops (14 phantoms)** — Add emit() to ops.* cron jobs + motor procedures. Likely in shift-compilation + monitoring.
4. **lovsen (8 phantoms)** — Wire lovsen-mcp tool invocation tracking (Claude AI tool calls).
5. **channel (13 phantoms)** — Either add missing emit() or delist channel.* events if feature not shipped.

### Methodology Notes

- **Event extraction:** `grep -o 'event: "[^"]*"' registry.ts` → 858 unique events
- **Emit detection:** `grep -r "emit({" ... -A 1 | grep "event:"` → 620 with call-sites
- **Phantom definition:** 0 emit() call-sites in codebase (apps/, packages/, services/)
- **Limitations:** Static grep misses dynamic event names; 3 confirmed cases spotted in code review
- **False negatives possible:** If event names are constructed at runtime or passed via config, they won't show up

### Domains with Axis 4 Clean (All Events Emitted)

Scanning for any domains where ALL events have emit() call-sites (inverse):
- `ai` — majority emitted
- `approval` — majority emitted
- `booking` — emitted
- `botsson.turn.*` — emitted (except autofill/nudge/intent)
- `calendar` — emitted
- `cascade` — emitted
- `checklist` (partial) — `checklist deviation_flagged` phantom, `checklist overdue` phantom
- `day_schedule` — emitted
- `person` — emitted
- `schedule` — emitted (shift publish/complete/etc.)
- `user` — emitted

No domain has 100% axis 4 completeness. **lovsen** is closest (only 8 of ~16 phantom) — likely missing wrapper only.

---

**Summary:** 238 phantom events (27.7%) = material audit gap. Recommend sortie per domain (auth + contract + ops first). Estimate 40-60 hours across 5 parallel sortier to close all axes.
