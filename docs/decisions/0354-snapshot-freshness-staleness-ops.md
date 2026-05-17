---
title: "Snapshot freshness/staleness ops — heartbeat cron + drift detector + admin re-derive flow"
id: ADR_0354
status: proposed
date: 2026-05-17
layer: decision
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [lovsen, freshness, staleness, cron, drift, snapshot, payroll, phase-7d, heartbeat]
amends: [ADR-0342, ADR-0348]
related_adrs: [ADR-0186, ADR-0342, ADR-0347, ADR-0348, ADR-0350, ADR-0352, ADR-0353]
---

# ADR-0354: Snapshot freshness/staleness ops

> ADR-0342 `verify_citation_freshness` was designed to serve CI/test-time fixture validation. Under the dynamic-MCP-fetch pivot (ADR-0353), the same tool acquires a second operational role: production drift detector. This ADR defines the daily heartbeat cron, the tariff_drift_event schema, severity graduation, and the admin re-derivation flow that closes the loop.

**Tre ekstremt-viktige punkter for leseren i 2027:**

1. **Dynamic-MCP-fetch pivot means workspace tariff snapshots can drift.** ADR-0353 stores fetched Riksavtalen rates in `tariff_snapshot` at workspace bootstrap. When Lovdata text changes (lønnsoppgjør protocol, paragraph renumbering), the stored snapshot becomes stale — silently, unless something checks it. This ADR defines that check.
2. **Aml. §14-15 lønnstrekk-forbud forbids blocking payroll on staleness alone.** Log, flag, and surface drift to admin — do NOT block calc. The legal violation of withholding wages outweighs the legal risk of using a stale rate for one pay period. Only period-close (ADR-0341 §F6 conditional) may block on high-severity unresolved drift.
3. **One MCP method, two operational contexts.** `verify_citation_freshness` (ADR-0342) is consumed by both CI golden-month tests (existing role, unchanged) and the production heartbeat cron (new role, defined here). The MCP contract is identical; only the consumer and scheduling differ.

## Context and Problem Statement

ADR-0342 `verify_citation_freshness` exists to make CI stale-detection operational for golden-month fixture tests (ADR-0341 F6). Under the static fixture-cert model, it was exclusively test-time validation — CI batched hashes, MCP responded, CI gated on results.

ADR-0353 introduces `tariff_snapshot` rows written at workspace bootstrap (dynamic-MCP-fetch). The fetch happens once; the snapshot persists. Between bootstraps, Riksavtalen text on Lovdata may change — paragraph renumbering (structural, non-material), or lønnsoppgjør rate adjustment (rate-material, high-priority). The workspace snapshot has no mechanism to detect this drift today. ADR-0348 (two-hash model) provides the discrimination vocabulary (`structureHash` vs `rateHash`, `SCHEMA_DRIFT` vs `RATE_STALE`); ADR-0354 defines the operational machinery that uses it in production.

Coordinator Phase 5 council (2026-05-17) concluded: `verify_citation_freshness` role splits into (a) audit-provenance for CI (existing, ADR-0342) and (b) production drift detector for snapshots (new, this ADR). ADR-0348 two-hash model survives the split unchanged — it is the classification layer both consumers read.

## Decision Drivers

- **ADR-0348 two-hash semantics:** `structureHash` drift = `SCHEMA_DRIFT` (notify low-priority); `rateHash` drift = `RATE_STALE` (notify high-priority, potential underpayment risk)
- **Lovsen Phase 5 lønnsoppgjør lag:** 2026 protocol lands on Lovdata months after NHO circular. The heartbeat cron is the only mechanism that catches rate changes between workspace bootstrap events
- **Aml. §14-15 lønnstrekk-forbud:** Blocking payroll on staleness = worse legal violation than using a stale rate for one period. Drift detection must surface admin action opportunity, not auto-block
- **ADR-0186 telemetry routing:** Heartbeat events route to both `activity_trail` (audit) and `engine_event` (admin inbox) per established routing pattern
- **Admin always in control:** Re-derivation requires explicit admin confirm (gate_action) — no auto-re-derive in v1

## Considered Options

1. **A — Detect drift only at period close** — check snapshot freshness when admin attempts to lock the payroll period. If stale, block (or warn). Rejected: too late. Drift may have accumulated over months; forcing discovery at close creates time pressure and reduces operator agency. Contradicts Aml. §14-15 interpretation.
2. **B — Re-derive snapshot automatically on drift** — cron detects drift and auto-updates snapshot without admin confirm. Rejected: auto-re-derivation without admin review violates the "confident ≠ authorized" principle (C4 governance, ADR-0076). Rate changes affect current pay period calculations; admin must see the delta before it takes effect.
3. **C (chosen) — Daily heartbeat cron with admin inbox surface + gate_action re-derivation flow.** Cron detects drift proactively, emits typed events with severity, surfaces inbox card, admin reviews and confirms re-derivation via `change_workspace_tariff` flow. Blocking only at period-close for high-severity unresolved drift (conditional per ADR-0341 §F6).

## Decision Outcome

Chosen option: **C — Daily heartbeat cron + admin inbox + gate_action re-derive.**

### Cron architecture

Heartbeat job `freshness-check.sh` runs daily at **06:00 Oslo time** per the `~/.claude/scripts/heartbeat-notify.sh` pattern (HEARTBEAT.md job entry, cooldown: 23h).

**Per-run algorithm:**

1. Query all `workspace_framework_binding` rows where `effective_to IS NULL` (active bindings only)
2. For each active binding: retrieve associated `tariff_snapshot` row + supplement hashes
3. Group supplement citations by source MCP (Lovdata vs NHO Reiseliv — per ADR-0342 routing table)
4. Call `verify_citation_freshness(hashes[])` batched ≤100 per MCP via Lovsen bridge (ADR-0350)
5. For each stale result: determine severity (see Severity rules below) → INSERT `tariff_drift_event` → emit `workspace.tariff_drift_detected`
6. Rate: at most one drift detection run per workspace per day. Idempotent within 24h window (ADR-0256 TTL).

Non-tariff-bound workspaces have no `tariff_snapshot` → skip (no snapshot to drift).

### tariff_drift_event table (Phase 7f migration)

```sql
-- payroll schema, workspace-scoped
CREATE TABLE payroll.tariff_drift_event (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.workspace(id),
  binding_id     uuid NOT NULL REFERENCES payroll.workspace_framework_binding(id),
  detected_at    timestamptz NOT NULL DEFAULT now(),
  severity       text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  drift_payload  jsonb NOT NULL,  -- workspace.tariff_drift_detected event payload
  resolved_at    timestamptz,
  resolved_by    uuid REFERENCES public.profile(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

### Drift event payload (extends ADR-0348 `lovsen.citation.stale`)

```typescript
type TariffDriftDetectedEvent = {
  event: 'workspace.tariff_drift_detected';
  workspace_id: string;
  binding_id: string;
  stale_supplements: Array<{
    supplement_type: string;
    paragraph_ref: string;
    drift_axis: 'structure' | 'rate' | 'both';
    cached_hash: string;           // structureHash or rateHash from snapshot
    live_hash: string;             // hash from live Lovdata fetch
    cached_rate_value_ore: number; // rate stored in snapshot, in øre
    live_rate_value_ore: number;   // rate from live fetch (if rate axis drifted)
  }>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;             // ISO-8601
};
```

### Severity rules

Severity is determined per binding (not per supplement) based on the worst drift axis found:

| Drift condition | Severity | Action |
|---|---|---|
| `structureHash` drift only (SCHEMA_DRIFT) | `low` | Admin inbox card, non-blocking. Paragraph renumbering — inform, no urgency. |
| `rateHash` drift only, live_rate > cached_rate (RATE_STALE, potential underpayment) | `high` | Admin inbox URGENT. Block period-close until reviewed (ADR-0341 §F6 conditional). |
| `rateHash` drift only, live_rate ≤ cached_rate (RATE_STALE, no underpayment) | `medium` | Admin inbox, non-blocking. |
| Both axes | `high` | Same as rateHash-only RATE_STALE. |
| `rateHash` drift AND live_rate < cached_rate (potential underpayment, CRITICAL) | `critical` | Admin inbox URGENT + escalate via `payroll.calc_blocked_on_drift`. Block period-close. |

`critical` is reserved for cases where stored rate exceeds live rate — meaning current calc may have underpaid employees. This is the highest-risk drift class and triggers the same escalation path as ADR-0341 §F6 CRITICAL.

### Admin re-derivation flow

Triggered from admin inbox card when drift event is surfaced:

1. Admin sees inbox card: "Tariff snapshot drifted — X supplements changed. Severity: [high/critical]. Review?"
2. Click → opens `change_workspace_tariff` flow (ADR-0353 § re-derivation path)
3. Capability tool `change_workspace_tariff` re-fetches via `derive_supplement_set` MCP (ADR-0352) → presents diff (cached rates vs live rates per supplement)
4. Admin confirms → new `tariff_snapshot` row inserted + new `workspace_framework_binding` row (effective_from = today; previous binding `effective_to` = today - 1 day)
5. `tariff_drift_event.resolved_at` + `resolved_by` stamped on previous drift events for this binding
6. Amendment classifier per ADR-0252:
   - Rate increase (UP): allowed immediately
   - MATERIAL change (underpayment risk resolution): routes to employee notification flow (ADR-0252 owns; out of scope here)
   - ENDRINGSOPPSIGELSE: routes to ansatt-signering (ADR-0252 owns; out of scope here)

### Telemetry events (register in `packages/telemetry/src/registry.ts` Phase 7e)

| Event | When | Routing |
|---|---|---|
| `workspace.tariff_drift_detected` | Per drifted workspace per cron run | `activity_trail` (audit) + `engine_event` (admin inbox) |
| `workspace.tariff_snapshot_re_derived` | After admin confirms re-derivation | `activity_trail` + `engine_event` |
| `payroll.calc_blocked_on_drift` | Period-close attempted with unresolved high/critical drift | `activity_trail` + `engine_event` |
| `lovsen.citation.stale` | Per stale supplement from `verify_citation_freshness` | Existing registration — unchanged (registry.ts L7369) |

Routing follows ADR-0186 telemetry routing rules: `activity_trail` for audit permanence, `engine_event` for reactive surface (admin inbox card render).

### CI consumer split (ADR-0342 audit-provenance retained)

ADR-0342 `verify_citation_freshness` remains the golden-month CI consumer (F6 gate in ADR-0341) — role unchanged. This ADR adds a SECOND consumer: the daily production cron. The MCP method contract is identical; no API changes required.

Summary:

| Consumer | Context | Schedule | Fixture mode |
|---|---|---|---|
| `pnpm test:golden-month` (ADR-0341 F6) | CI / golden-month test run | Per commit + PR | `LOVSEN_FIXTURE_MODE=true` → all hashes stale: false |
| `freshness-check.sh` | Production heartbeat | Daily 06:00 Oslo | Live Lovdata fetch |

## Rules & Consequences

- **Good, because** drift is detected proactively at 06:00, not reactively at period-close under time pressure. Admin has days or weeks to review and confirm before the next payroll run.
- **Good, because** severity graduation maps directly to legal risk. `critical` (potential underpayment) surfaces immediately; `low` (paragraph renumbering) is informational. Operators are not habituated to ignore critical alerts by structural noise.
- **Good, because** admin is always in control — no auto-re-derivation. The re-derivation flow shows rate delta explicitly before commit. Consistent with C4 governance principle.
- **Good, because** one MCP method (`verify_citation_freshness`) serves both CI and production without duplication. ADR-0342 contract is load-bearing and remains stable.
- **Bad, because** daily cron generates load on Lovsen MCPs — mitigated by 24h idempotency window (ADR-0256 TTL; one workspace = one check per day) and ≤100 hash batching.
- **Bad, because** admin inbox volume increases with workspace count. Mitigation: severity sorting (critical/high shown first), resolved drift events hidden by default, 7-day auto-archive for `low` severity unresolved.
- **Bad, because** the `tariff_drift_event` table grows indefinitely without a retention policy. Phase 8: add 90-day archive job. Not blocking for v1.
- **Agent Impact:** Heartbeat job `freshness-check.sh` is new (T1). Migration adds `tariff_drift_event` table (T2). Three telemetry events registered (T3). Admin inbox card UI requires `engine_event` consumer (T4). Period-close block on high/critical unresolved drift wires into ADR-0341 §F6 conditional path (T5). Auto-re-derive is explicitly out of scope (Phase 8+).

## Out of scope (this ADR)

- Auto-re-derivation without admin confirm. Phase 8+ optimization if drift volume becomes operational burden.
- Multi-workspace bulk re-derivation in single admin action. Phase 8.
- Drift detection for non-tariff-bound workspaces. No snapshot exists → no drift possible. Skip.
- NHO Reiseliv lønnsoppgjør cirkulær as freshness signal. ADR-0347 scopes NHO MCP to employer-interpretive auxiliary. The effectiveness date of NHO cirkulær is a useful hint for scheduling re-derivation; wiring it to the cron trigger is Phase 8.

## Implementation gates (Phase 7f)

- **T1:** Heartbeat job `freshness-check.sh` per `~/.claude/scripts/` pattern. HEARTBEAT.md entry: `- [ ] tariff-freshness [cooldown: 23h] — Daily tariff snapshot drift detection`. Cron schedule: 06:00 Oslo via existing heartbeat runner.
- **T2:** Migration `payroll.tariff_drift_event` table. RLS: workspace-scoped, admin-read, service-role-write.
- **T3:** Register three telemetry events in `packages/telemetry/src/registry.ts`: `workspace.tariff_drift_detected`, `workspace.tariff_snapshot_re_derived`, `payroll.calc_blocked_on_drift`.
- **T4:** Admin inbox card UI — reads `engine_event` rows with event type `workspace.tariff_drift_detected`, renders per-supplement diff, links to `change_workspace_tariff` flow.
- **T5:** Period-close block — in period lock gate (ADR-0341 §F6 path): query `tariff_drift_event` for unresolved rows with `severity IN ('high', 'critical')`. If found → emit `payroll.calc_blocked_on_drift` + return structured error `PERIOD_CLOSE_BLOCKED_DRIFT` with drift event IDs. Admin must resolve via re-derivation flow before period close proceeds.

## References

- ADR-0186 — Telemetry routing: `activity_trail` + `engine_event` dual-destination
- ADR-0252 — Amendment classifier (UP / MATERIAL / ENDRINGSOPPSIGELSE) — owns employee notification paths
- ADR-0341 §F6 — Period-close gates + conditional staleness block (consumer of T5)
- ADR-0342 — `verify_citation_freshness` MCP tool (production cron consumer, unchanged contract)
- ADR-0347 — Lovdata canonical source for Riksavtalen
- ADR-0348 — Two-hash model (`structureHash` / `rateHash`, SCHEMA_DRIFT / RATE_STALE classification)
- ADR-0350 — Lovsen MCP→capability bridge transport (cron uses bridge to call verify_citation_freshness)
- ADR-0352 — `derive_supplement_set` MCP contract (re-derivation flow calls this)
- ADR-0353 — `workspace_framework_binding` bootstrap (produces `tariff_snapshot` rows this ADR monitors)
- `packages/telemetry/src/registry.ts` L7369 — `lovsen.citation.stale` (existing, extended by ADR-0348)
- Coordinator Phase 5 council 2026-05-17 — verified ADR-0342 role split and ADR-0348 two-hash survival

---

> Detected early, resolved with intent. Drift is not a failure — undetected drift is.

> Registered in `docs/decisions/0000-decision-log.md`. Amends ADR-0342 (adds production cron as second consumer) + ADR-0348 (operational machinery that consumes two-hash severity graduation). Status `proposed` pending Pontus accept.
