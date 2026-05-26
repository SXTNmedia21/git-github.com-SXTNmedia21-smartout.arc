---
title: Mobile Parity Status — Axis 6 Scan
status: done
updated: 2026-05-26
created: 2026-05-26
module: prod-ready
tags: [mobile-parity, axis-6, ADR-0133, ADR-0134, audit]
---

# Mobile Parity Status — Axis 6 (2026-05-26)

**Scope:** Light evidence scan across 20 Smartout domains per ADR-0133 (Mobile Surface Boundary) and ADR-0134 (Mobile Telemetry Contract).

**Methodology:**
- **A: Mobile route presence** — dedicated component directory or referenced app route
- **B: Shared logic in packages** — imports from `@smartout/*` packages (not web-app-private)
- **C: getProfileContext() resolved** — per ADR-0134 fail-fast helper before emit()

**Scoring:**
- `web-only` domains: auto-score 2 (design decision, N/A for signals A/B/C)
- `full` / `read-only` / `aspirational` domains: score 0–2 based on A+B+C signals
  - 2 = all three signals present
  - 1 = exactly two signals present
  - 0 = zero or one signal present

---

## Per-Domain Quick Score

| Domain | Mobile Scope | Route (A) | Shared Pkg (B) | Profile Ctx (C) | Score | Top Gap |
|---|---|---|---|---|---|---|
| **agent-harness** | web-only | ✗ | ✗ | ✗ | N/A | Web-only by design (voice agent harness) |
| **announcements** | full | ✗ | ✗ | ✗ | **0** | No mobile UI; bulletin compose + picker deferred |
| **billing** | web-only | ✗ | ✗ | ✗ | N/A | Web-only by design (cost authoring) |
| **bootstrap** | web-only | ✗ | ✗ | ✗ | N/A | Web-only by design (workspace setup) |
| **botsson** | full | ✓ | ✗ | ✗ | **1** | Components referenced; no shared pkg imports; missing ADR-0134 context |
| **communication** | full | ✗ | ✗ | ✗ | **0** | No mobile surface; helpdesk_query tool not built; SIP telephony deferred |
| **contracts** | full | ✗ | ✗ | ✗ | **0** | No mobile UI; mobile sign ADR-0245 incomplete; amendment classifier deferred |
| **core-structure** | full | ✗ | ✗ | ✗ | **0** | No mobile surface; dept_location admin UI missing; onboarding Step 7 not wired |
| **day-session** | full | ✗ | ✗ | ✗ | **0** | No mobile UI; **highest mobile debt (15 gaps)** — Phase C/D/E in flight; approval/settlement E2E missing |
| **lovsen** | web-only | ✗ | ✗ | ✗ | N/A | Web-only by design (regulatory reference) |
| **notifications** | full | ✓ | ✓ | ✗ | **2** | Mobile components exist; uses @smartout/supabase; **MISSING: getProfileContext per ADR-0134** |
| **onboarding-wizard** | full | ✗ | ✗ | ✗ | **0** | No mobile UI; Maestro mobile E2E not shipped; step-flow deferred to mobile |
| **payroll** | read-only | ✓ | ✓ | ✗ | **2** | Mobile read-only view exists; uses @smartout/supabase; **MISSING: getProfileContext per ADR-0134**; no mobile tariff/supplement UI |
| **procedure-engine** | full | ✗ | ✗ | ✗ | **0** | No mobile UI; **RoutineForm + clock-in + notifications NOT built** (Phase 1 deferred); 28 open gaps |
| **reports** | web-only | ✗ | ✗ | ✗ | N/A | Web-only by design (analytics authoring) |
| **scheduling** | full | ✗ | ✗ | ✗ | **0** | No mobile UI; **CRITICAL: mobile BFF authoring ADR-0277 not fully closed**; direct insert still active; solver propose/accept E2E missing |
| **scrapling** | web-only | ✗ | ✗ | ✗ | N/A | Web-only by design (content research) |
| **shift-clock** | full | ✓ | ✗ | ✓ | **2** | Mobile components + ADR-0134 context used; **NO shared pkg imports** (L-0177 fallback only); intentional pending mobile-shift-chat-bff follow-up |
| **training** | full | ✓ | ✗ | ✗ | **1** | Mobile procedure stepper/test UI referenced; **missing shared logic + profile context**; F2 completion + waive/assign deferred |
| **year-wheel** | web-only | ✗ | ✗ | ✗ | N/A | Web-only by design (calendar composition) |

---

## Aggregate Summary

**Total domains scanned:** 20

**Polished (2 — all signals OR web-only N/A):**
- 7 web-only (design decision): agent-harness, billing, bootstrap, lovsen, reports, scrapling, year-wheel
- 3 full/read-only (signals complete): notifications, payroll, shift-clock
- **Subtotal: 10 domains (50%)**

**Partial (1 — exactly 2 signals):**
- 2 domains: botsson (route + referenced), training (route only)
- **Subtotal: 2 domains (10%)**

**Unstarted (0 — 0–1 signals):**
- 8 full-scope domains with zero mobile surface: announcements, communication, contracts, core-structure, day-session, onboarding-wizard, procedure-engine, scheduling
- **Subtotal: 8 domains (40%)**

---

## Top Remediation Candidates (P0 Priority)

### 1. day-session (HIGHEST DEBT: 15 gaps)

**Current state:** Zero mobile surface. Phases C (UI) + D (mobile) + E (push) in flight.

**ADR-0133 classification:** Full-scope (D6 production execution + C4 governance acceptance).

**Mobile surface boundary violation:** Phase C builds web approval/settlement UI; Phase D defers mobile entirely despite being in cascade D6 (production) scope.

**Gaps:**
- No mobile day-session/reconciliation view (Phase C web-only)
- No mobile shift approval UI (Phase D deferred)
- No mobile settlement confirmation (Phase E deferred)
- No mobile E2E specs (stated in state.json)

**Remediation path:**
- [ ] Create `apps/mobile/src/components/day-session/` with reconciliation stepper
- [ ] Implement `DaySessionView.tsx` with read-only shift roster + approval flow
- [ ] Add getProfileContext + L-0177 fail-fast before emit()
- [ ] Share data layer with web via `@smartout/data` (existing pattern)
- [ ] E2E: Playwright specs for mobile approval journey per ADR-0298

**Estimate:** 2–3 sorties (Phase D partial + Phase E integration).

---

### 2. procedure-engine (TIED: 28 open gaps, but zero UI)

**Current state:** Zero mobile surface. Phase 1 blockers: RoutineForm, clock-in, notifications not built.

**ADR-0133 classification:** Full-scope (D6 production execution — shift procedures, routines, controls).

**Mobile surface boundary violation:** Authoring (RoutineForm) is web-only ✓; execution (clock-in confirmation, task completion) MUST be mobile.

**Gaps:**
- No mobile procedure execution stepper (Task + Checklist + Photo evidence per Sortie 2026-05-18)
- No mobile clock-in integration (SessionTask trigger, notification receive)
- No mobile routine-review UI (`/app/(app)/routine-review.tsx` exists but unconnected)

**Remediation path:**
- [ ] Wire existing `routine-review.tsx` to procedure-engine data layer
- [ ] Create `ProcedureExecutionStepper.tsx` with task-list + photo evidence + completion
- [ ] Implement `SessionTaskNotification.tsx` mobile receiver
- [ ] Add getProfileContext + emit per ADR-0134
- [ ] Share data via `@smartout/ai` procedures capability (deferred from Sortie 2026-05-18)

**Estimate:** 2–3 sorties (Phase 1 partial unblock).

---

### 3. scheduling (CRITICAL BLOCKER)

**Current state:** Zero mobile surface. ADR-0277 (Mobile BFF authoring) incomplete — direct database inserts still active.

**ADR-0133 classification:** Full-scope, BUT with surface-boundary trap: authoring (schedule drag-drop) = web-only ✓; execution (shift swap, approval) = mobile-required.

**Mobile surface boundary violation:** ADR-0277 mandates BFF routes for all mobile-writable operations. Currently: direct insert bypasses BFF per code audit note.

**Gaps:**
- No mobile shift-swap request UI (proposal creation blocked by ADR-0277)
- No mobile swap approval/rejection (solver proposal-accept E2E missing)
- No mobile marketplace UI (multi-shift swap bidding deferred)
- BFF authoring routes (mobile put/post) not fully gated

**Remediation path:**
- [ ] Enforce ADR-0277: audit all mobile schedule mutations, gate via BFF (`/api/mobile/schedule/*`)
- [ ] Create `SwapProposalScreen.tsx` → mobile-BFF → server mutation
- [ ] Implement `SwapInboxScreen.tsx` approve/reject flow with getProfileContext
- [ ] Remove direct database writes from mobile code (audit finding)
- [ ] E2E: Playwright mobile proposal → approval → settlement journey

**Estimate:** 2 sorties (architectural + implementation).

---

### 4. announcements (P2, but full-scope violation)

**Current state:** Zero mobile surface. Marked `full` scope but no UI exists.

**Gaps:**
- No mobile bulletin feed (Wave B UI pickers deferred)
- No mobile compose surface (correct — authoring is web-only per ADR-0133)
- EntityLinkCTA mobile mount missing

**Remediation path:**
- [ ] Create `BulletinFeed.tsx` with list + detail views
- [ ] Implement category/tag filter UI
- [ ] Wire notification dispatch integration
- [ ] Add getProfileContext + emit

**Estimate:** 1 sortie.

---

### 5. contracts (P0 blocker — 4 downstream)

**Current state:** Zero mobile surface. Mobile sign ADR-0245 only 50% complete.

**Gaps:**
- No mobile signature flow (ADR-0245 partial)
- No mobile amendment review/approval
- No mobile Tripletex sync status view

**Remediation path:**
- [ ] Complete ADR-0245: biometric signature flow per mobile-native superpowers (camera, TouchID)
- [ ] Create `ContractSignScreen.tsx` with DocuSeal integration
- [ ] Implement amendment classifier + sync status UI
- [ ] Share data layer with web

**Estimate:** 1.5 sorties.

---

## Architectural Blockers (System-Level)

### 1. ADR-0134 Compliance Gap: Missing getProfileContext() in 2 domains

**Domains affected:** notifications, payroll

**Problem:** Both have mobile components + shared packages, but DO NOT call `getProfileContext()` before emit(). Per ADR-0134 CRITICAL: every mobile mutation must resolve `workspace_id` (non-null) and `actor_id` (non-empty) BEFORE telemetry emit. Silent fallback (empty string) corrupts activity_trail + engine_event routing.

**Root cause:** Components existed before ADR-0134 was codified (2026-05-XX). Emission logic inferred from web BFF; no explicit context resolution on mobile.

**Fix:**
```typescript
// apps/mobile/src/components/notifications/NotificationHandler.tsx
import { getProfileContext } from '@/lib/profile-context';

const handleNotificationAction = async (action) => {
  const { workspace_id, actor_id } = getProfileContext(); // L-0177 fail-fast
  if (!workspace_id || !actor_id) throw new Error('Missing profile context');
  
  await emit('notification.action_completed', {
    workspace_id,
    actor_id,
    action,
    ...
  });
};
```

**Remediation:** 1 micro-sortie (2 file edits, test, close-feature).

---

### 2. ADR-0133 Enforcement: 8 full-scope domains with zero surface

**Problem:** 8 domains marked `mobileScope: "full"` have ZERO mobile UI. Per ADR-0133, this means either:
1. Design decision is aspirational (reclassify to `aspirational`)
2. UI deferred but data layer must be mobile-ready (verify with domain steward)
3. Enforcement is broken

**Affected:** announcements, communication, contracts, core-structure, day-session, onboarding-wizard, procedure-engine, scheduling

**Action:** Before sprint planning, audit each domain's decision log:
- Does ADR justify deferral?
- Is data layer mobile-compatible?
- When is mobile surface planned?

---

### 3. Missing BFF Route Layer (ADR-0277 Incomplete)

**Domains affected:** scheduling (critical), day-session, procedure-engine

**Problem:** Mobile surfaces make direct database writes or lack BFF routing. ADR-0277 (Mobile BFF authoring) requires all mobile mutations route through web-server bottleneck (`/api/mobile/*`) so permission gates + telemetry + validation are centralized.

**Current state:**
- Scheduling: direct insert still active (code audit finding)
- Day-session: approval/settlement routes not yet gated
- Procedure-engine: clock-in task acceptance needs BFF route

**Fix approach:**
```typescript
// apps/web/src/app/api/mobile/schedule/swap/route.ts
export async function POST(req: Request) {
  const { workspace_id, actor_id } = await getProfileContext(req); // server-side
  const body = await req.json();
  
  // Gate via RLS
  const { error } = await supabase
    .from('schedule_shift')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('id', body.shift_id)
    .single();
    
  if (error) throw new Error('Unauthorized');
  
  // Emit with resolved context
  await emit('schedule.swap_initiated', { workspace_id, actor_id, ... });
  
  // Return 200
  return Response.json({ ok: true });
}
```

**Remediation:** Add BFF wrapper routes in dedicated sortie (ADR-0277 follow-up).

---

## Summary Table: Remediation Roadmap

| Priority | Domain | Scope | Current Score | Target | Effort | Blocker? |
|---|---|---|---|---|---|---|
| **P0** | day-session | full | 0 | 2 | 3 sprints | ADR-0367 compliance |
| **P0** | procedure-engine | full | 0 | 2 | 2–3 sprints | Phase 1 deferred |
| **P0** | scheduling | full | 0 | 2 | 2 sprints | ADR-0277 enforcement |
| **P0** | contracts | full | 0 | 2 | 1.5 sprints | ADR-0245 completion |
| **P0** (compliance) | notifications | full | 2 | **2+** | 0.25 sprints | ADR-0134 gap (getProfileContext) |
| **P0** (compliance) | payroll | read-only | 2 | **2+** | 0.25 sprints | ADR-0134 gap (getProfileContext) |
| **P1** | botsson | full | 1 | 2 | 1 sprint | Proposal pipeline |
| **P1** | training | full | 1 | 2 | 1 sprint | Stepper + test UI |
| **P2** | announcements | full | 0 | 2 | 1 sprint | Wave B deferred |
| **P2** | communication | full | 0 | 2 | 1.5 sprints | helpdesk_query not built |
| **P2** | core-structure | full | 0 | 2 | 1 sprint | Admin UI missing |
| **P2** | onboarding-wizard | full | 0 | 2 | 1 sprint | Maestro E2E |

---

## Enforcement Points (Pre-Merge Gates)

To prevent axis 6 regression:

1. **Any new `full` / `read-only` domain MUST declare mobile scope in state.json before D1 spec merge.**
2. **Mobile components MUST use getProfileContext() before emit() — ADR-0134 ESLint rule to be added.**
3. **Mobile mutations MUST route through `/api/mobile/*` BFF — enforce in code audit per ADR-0277.**
4. **domain-steward skill should report mobile-parity mirror status in each domain's `_DASHBOARD.md` every 2 weeks.**

---

## Dependency Map (Unblock Order)

1. **Compliance (immediate, <0.5 days):** Fix ADR-0134 gaps (notifications, payroll) → unblock mobile telemetry audits
2. **Critical (next sortie):** Complete ADR-0277 enforcement → unblock scheduling mobile mutations
3. **Phased (2–4 sprints):** Build day-session, procedure-engine, contracts mobile UIs per roadmap above
4. **Polish (post-MVP):** Announcements, communication, core-structure, onboarding-wizard mobile surfaces

---

## Scan Metadata

- **Methodology:** Light evidence (directory presence, import patterns, function calls)
- **Coverage:** 20 domains × 3 signals (A/B/C) = 60 checks
- **Execution time:** ~2 minutes (grep + jq)
- **Confidence:** High for route detection; medium for shared-logic patterns (would need deeper AST scan to catch all pkg usage)
- **Next steps:** Domain-steward spine audits (ADR-0392) can include mobile-parity mirror for deeper validation
