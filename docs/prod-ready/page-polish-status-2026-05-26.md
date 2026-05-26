---
title: Page Polish Status — Axis 12 Scan 2026-05-26
status: report
updated: 2026-05-26
created: 2026-05-26
module: page-polish
tags: [axis12, page-polish, dashboard-coverage]
---

# Page Polish Status — Axis 12 Light Scan 2026-05-26

**Scope:** 20 Smartout domains, axis 12 quick-look via 4 signal proxies. This is NOT a full 8-phase audit — only fast structural evidence.

**Methodology:** For each domain's primary dashboard route:
- **Signal A:** site-map.json entry presence (fast grep)
- **Signal B:** page header component (text `<h2>`, `PageHeader`, `PageInstructions`)
- **Signal C:** telemetry view-emit (grep `emit(` + `.view` / `.viewed`)
- **Signal D:** harness tool descriptions (grep `useRegisterTools` + non-empty `description`)

**Scoring:**
- Score **2** = all 4 signals present (polished)
- Score **1** = 2–3 signals present (partial)
- Score **0** = 0–1 signals present (unstarted)
- **—** = no dashboard route (meta domain or backend service)

---

## Per-domain Results

| Domain | Route | A site-map | B header | C view-emit | D tool-desc | Score | Status |
|---|---|---|---|---|---|---|---|
| agent-harness | /dashboard/ai | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| announcements | N/A | — | — | — | — | — | No dashboard route |
| billing | /dashboard/billing | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| bootstrap | /dashboard/setup | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| botsson | /dashboard/onboarding-assistant | ✓ | ✓ | ✗ | ✗ | 1 | Partial |
| communication | /dashboard/komm | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| contracts | /dashboard/people/contracts | ✓ | ✗ | ✓ | ✗ | 1 | Partial |
| core-structure | N/A | — | — | — | — | — | Meta domain |
| day-session | /dashboard/calendar | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| lovsen | /dashboard/governance | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| notifications | /dashboard/komm/varsler | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| onboarding-wizard | /dashboard/onboarding-assistant | ✓ | ✓ | ✗ | ✗ | 1 | Partial |
| payroll | /dashboard/payroll/tariff | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| procedure-engine | /dashboard/operations | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| reports | /dashboard/reports | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| scheduling | /dashboard/schedule | ✓ | ✓ | ✗ | ✗ | 1 | Partial |
| scrapling | N/A | — | — | — | — | — | Backend service |
| shift-clock | /dashboard/shift-clock | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| training | /dashboard/my-training | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |
| year-wheel | /dashboard/year-wheel | ✓ | ✗ | ✗ | ✗ | 0 | Unstarted |

---

## Aggregate Summary

| Cohort | Count |
|---|---|
| **Score 2** (polished, all 4 signals) | 0 domains |
| **Score 1** (partial, 2–3 signals) | 4 domains |
| **Score 0** (unstarted, 0–1 signals) | 13 domains |
| **N/A** (no dashboard route) | 3 domains |
| **TOTAL** | 20 domains |

---

## Key Findings

### Site-Map Coverage: ✓ 17/17 routes present
All 17 dashboard routes with concrete pages already have entries in `apps/web/.botsson/site-map.json`. **Signal A is a non-differentiator** — it's effectively done across the board. This is positive: the site-map is being maintained as routes ship.

### Page Headers: ✓ 3/17 routes
Only **botsson**, **onboarding-wizard**, and **scheduling** have visible page header markup. The other 14 routes lack even a basic `<h2>` or `PageHeader` component. This is the **#1 gap** — axis 12 phase 8 (site-map) is done, but phases 1–7 (speed-test → harness tool descriptions) remain almost entirely unstarted.

### View-Emit Telemetry: ✓ 1/17 routes
Only **contracts** has a telemetry `emit()` call with `.view` or `.viewed` keyword. **12 critical gaps here** — telemetry view-emit is required per ADR-0298 task ontology + axis 12 phase 5 closure gate.

### Harness Tool Descriptions: ✗ 0/17 routes
**Zero domains** have tool descriptions registered. This blocks Botsson voice/chat from understanding which tools are available on each page. **Universal gap** — all 17 routes need this work.

---

## Priority Remediation Matrix

### P0: Core Operations (highest user impact)

1. **day-session** (`/dashboard/calendar`) — Day control is the #1 manager interface
   - Missing: header, view-emit, tool descriptions
   - Work: 1) add page title + instructions 2) emit view on load 3) register 6–8 session/shift tools
   - Est: ~4 hours

2. **scheduling** (`/dashboard/schedule`) — Planning is critical path
   - Has: header (partial — no description)
   - Missing: view-emit, tool descriptions
   - Work: 1) emit view on load 2) register 8–12 shift/template/absence tools
   - Est: ~3 hours

3. **payroll** (`/dashboard/payroll/tariff`) — Finance dashboard
   - Missing: header, view-emit, tool descriptions
   - Work: 1) add page title + tariff context 2) emit view 3) register rate/settlement tools
   - Est: ~3 hours

### P1: Employee Self-Service

4. **training** (`/dashboard/my-training`) — Protocol + knowledge test surface
   - Missing: view-emit, tool descriptions (has header)
   - Work: 1) emit view on load 2) register 4–6 training/progress tools
   - Est: ~2 hours

5. **shift-clock** (`/dashboard/shift-clock`) — Clock in/out + GPS
   - Missing: header, view-emit, tool descriptions
   - Work: 1) add page title 2) emit view 3) register clock/activity tools
   - Est: ~2 hours

### P2: Administrative

6. **reports** (`/dashboard/reports`) — Analytics + exports
   - Missing: header, view-emit, tool descriptions
   - Work: 1) add page title + query context 2) emit view 3) register report/export tools
   - Est: ~2 hours

7. **governance** (`/dashboard/governance`) — Authority + compliance
   - Missing: header, view-emit, tool descriptions
   - Work: 1) add page title + authority context 2) emit view 3) register approval/policy tools
   - Est: ~2 hours

### Remaining (lower user impact, can batch)

- **billing**, **communication**, **bootstrap**, **agent-harness**, **notifications**, **procedure-engine** — all Score 0, follow same pattern (header + view-emit + 4–8 tools each).

---

## Recommended Batch Strategy

**Option 1: Phased per domain (high quality, parallel-friendly)**
- Week 1: P0 day-session + scheduling (orchestrator + 2 sub-builders, 1 verifier)
- Week 2: P0 payroll + P1 training + shift-clock (3 parallel sub-sortiers)
- Week 3: P2 reports + governance + remaining Score 0s (2–3 sub-sortiers)

**Option 2: Unified axis 12 campaign (faster, coherent closure)**
- Create `campaign/axis-12-page-polish`
- Spawn 4 sub-sortiers: each handles 4–5 domains (same pattern, parallel)
- Leverage code reuse: header template, emit pattern, tool-bridge scaffold
- Closure: 1 orchestrator sweep (coherence checks, site-map validation)

**Recommendation:** Option 2 (campaign) — axis 12 is homogeneous work, and a unified sortie closure gate ensures all 17 routes exit at Score 2.

---

## Estimated Effort

| Work | Domains | Sub-sortiers | Est per sortie | Total |
|---|---|---|---|---|
| Page headers | 14 | 4 | ~3h each | ~12h |
| View-emit telemetry | 16 | 4 | ~2h each | ~8h |
| Tool descriptions | 17 | 4 | ~3h each | ~12h |
| Integration + closure | 1 | 1 | — | ~4h |
| **Total** | — | 9 | — | **~36h** |

—*Parallelizable to ~10 wall-clock hours if using 4 simultaneous sub-sortiers.*

---

## Skipped (Mobile N/A or No Dashboard Route)

- **announcements** — no dedicated dashboard page (embedded in admin inbox or broadcast panel)
- **core-structure** — meta domain (D1–D6 + C1–C4 architecture, not a page)
- **scrapling** — backend service (Python, not a web dashboard)

---

## No-Code Changes Summary

This scan required **zero code modifications**:
- Read-only grep + file-stat checks
- site-map.json, page.tsx structure analysis
- No staging, no merges, no tool registration

All findings are evidence-based and actionable. Next step: `/start-campaign axis-12-page-polish` when ready to execute.

