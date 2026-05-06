---
title: Benchmark — Planday
status: in_progress
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [benchmark, planday, competitor, payroll, scheduling, norway, hospitality]
---

# Benchmark — Planday

> Gold-standard benchmark for Norwegian hospitality workforce management.
> Confidence notes: HIGH = directly from Planday docs/help center. MEDIUM = inferred from API docs or review sites. LOW = third-party or extrapolated.

**Sources used:** planday.com · help.planday.com · openapi.planday.com · developer.planday.com · G2/Capterra/GetApp reviews · Nordic9 acquisition reporting

---

## 1. Product Positioning + Market

**Founded:** 2004 (Denmark). Acquired by Xero March 2021 for ~€155.7M (~$241M).

**Post-Xero changes:**
- Expanded from core Nordic markets (DK, NO, SE, UK, DE, FR) to AU and US
- Deep Xero accounting integration became a primary integration path
- Product strategy shifted to SMB + enterprise; dedicated phone support added at Pro tier
- Australia region since retired (deprecated Oct 2024, `X-OpenAPI-Region` header removed)

**Primary markets:** Denmark, Norway, Sweden, UK, Germany, France (Nordics = home base; UK = largest non-Nordic market)

**Target industries:** Hospitality (restaurants, bars, cafés, hotels), retail, healthcare, fitness, entertainment

**Pricing tiers (GBP — UK pricing, approximate):**

| Tier | Price | Key inclusions |
|---|---|---|
| Starter | £2.99/user/month (min 5) | Scheduling, simple time tracking, working time rules, basic payroll report, team comms |
| Plus | Not published (mid-range) | Leave/absence, payroll integrations + report, revenue reporting, API access, employee documents |
| Pro | Custom pricing | Auto-scheduling, configurable org structure, custom permissions/roles, dedicated phone support |
| Enterprise | Custom | Multi-portal linking, custom account setup, onboarding workshops |

- 30-day free trial, no credit card
- Minimum 12-month contract (reported pain point in reviews)
- Norway pricing likely in NOK/DKK at similar relative points [MEDIUM]

**Market position:** Direct competitor to Quinyx (SE), Deputy (AU/US), 7shifts (restaurants), When I Work. G2 overall score 8.9/10. Analyst rating ~81/100. Well-established — 20+ years, significant Norwegian hospitality penetration (trusted by Heim, Costa Coffee, Domino's, First Camp, Bespoke Hotels, Pasture Restaurants).

---

## 2. Core Scheduling Features

**Schedule editor:**
- Drag-and-drop rota builder (implied by "create rotas in a couple of clicks" and position-based week view) [MEDIUM — not explicitly confirmed drag-drop in docs]
- Department-scoped views; employees see only their department
- Draft shifts — "test, plan and perfect rotas" before publishing
- Copy current week to next; roll out templates
- Reusable schedule templates (save + redeploy)
- Multi-site deployment from single view (enterprise)
- Week view standard; month view not explicitly documented [MEDIUM]

**Auto-scheduling (Pro only):**
- Assigns open shifts at one click based on: contracted hours, availability, absence, working time rules, employee groups + skills, hire/deactivation dates, conflicting shifts
- Prioritises employees who marked themselves available; excludes unavailable
- Iterative solver — "the longer it runs, the more likely it is to find a solution"
- Cannot undo approved schedules (entire week deletion only)
- Does not work with "Intervals" availability setting
- Uses historical data + demand forecasting for staffing suggestions [per AI article — MEDIUM]

**Open shifts / shift bidding:**
- Unassigned shifts appear highlighted red; push notification sent to eligible employees
- Employees filtered by group membership + required skill
- Manager reviews applications from Pending requests → Shift Requests tab; first applicant shown first
- Manager selects from applicants and assigns

**Shift swap / handover / sell:**
- Three modes: Swap (mutual exchange), Handover (direct transfer, both confirm), Sell (shift goes yellow, any eligible employee can request)
- Both parties must confirm before manager approval
- Configurable approval cutoff (hours threshold, e.g. 48h = requires approval; 0 = no approval; 50000 = always approve)
- Swap requests tab in manager view

**Templates + recurring patterns:**
- Named templates saved from existing schedule
- Copy-forward from current to next week
- No explicit "recurring pattern" builder documented [MEDIUM — may exist at Pro tier]

**Department + role + skill matching:**
- Skills required per shift or per position; enforced — only employees with skill can be assigned
- Employee group required per shift (mandatory entity in Planday's model)
- Position labels for what employee does during shift (e.g. "Waiter tables 1-5")
- Auto-schedule respects all three dimensions simultaneously

**Conflict detection:**
- Visual colour indicators: green (on contracted hours), yellow (under), red (over)
- Conflicting shifts across departments block auto-schedule assignment
- Working time rules violations flagged

**Compliance overlays:**
- Automated working time rule enforcement (max hours, rest periods)
- Break management tied to schedule and punch clock
- "Local regulations" support — configurable per market [HIGH for existence; LOW for Riksavtalen-depth]
- Contract rules verify employees work agreed hours
- Revenue-based staffing recommendations visible on schedule

---

## 3. Time Clock / Punch-In

**Methods supported:**

| Method | Notes |
|---|---|
| Mobile app (iOS/Android) | GPS geofencing OR WiFi-network restriction |
| Web browser (kiosk.planday.com) | IP whitelist; activation code required |
| iPad/Android tablet kiosk | PIN codes + activation codes; no GPS dependency |
| Planday app on personal device | Geofence (location-based) or WiFi-network lock |

**No biometric support documented** (fingerprint/face ID not mentioned anywhere in Planday docs) [HIGH confidence this is absent]

**Location restrictions:**
- GPS geofencing — employee can only punch in/out within defined area; configurable per department
- WiFi network restriction — must be on workplace WiFi to punch (alternative to GPS)
- IP whitelist — fixed IPs per department; PIN code-only in browser with registered IP
- Kiosk mode — no GPS/IP dependency; shared device with PIN or employee-list selection

**Time rounding:**
- Increments: 5, 10, 15, 20, 30, 60 minutes
- Common rules: no rounding (show punch time or shift time), round up, round down
- Custom rules (per dept/group/type): round to nearest, early/late punch variants with max-deviation threshold
- Yellow flag = difference between scheduled and punched times; manager can override before approval

**Break handling:**
- Employees can clock in/out of breaks via punch clock
- Breaks unpaid by default; manager can toggle to paid per entry
- Auto-deduct rules configurable; rounding rules may conflict with deviation rules (must be managed carefully)
- Break data via API: `GET /punchclock/{id}/breaks`; manual breaks require Payroll API separately

**Forgotten punch-out:**
- System flags missing punch-out with red indicator
- Manager manually enters end time in Punch Clock approval screen
- Approving the manual entry simultaneously closes the shift

**Corrections + audit:**
- Manager edits: start/end times (unless deviation rules lock them), break toggle
- Bulk approval or individual approval via Pending actions widget or Schedule → Punch Clock
- Deviation rules lock start/end editing when applied; approval web-only (not mobile) when deviation rules active
- Schedule History (`Schedule > Tools > Schedule History`) shows shift status and change history
- Mobile approval limited to last 7 days; older entries web-only

**Deviation rules:**
- Three types: lateness, overtime, undertime
- Per-rule config: deviation type, final shift type, minimum length threshold (0 = all deviations), start of shift, max length
- Filterable by shift type, department, employee group, employee type
- Suggestions surfaced in punch clock approval; override by manager

---

## 4. Payroll Integration Features

**Norway-specific integrations (confirmed from Planday's own market list):**

| Category | Integrations |
|---|---|
| Payroll | Tripletex, Visma Lønn, Visma.net, Uni Economy, Uni Micro, Huldt & Lillevik, Nettlønn (24 Seven Office), Power Office Go Lønn, Lessor, Crona Lön, Hogia lön/Plus, Xledger |
| POS | Ajour, Favrit, OnlinePOS, PCkasse, Quickorder, Munu, Superb, Zettle, Lightspeed, KDR, Ancon, Com2gether, OpenSolution, Vectron |
| HR | Learningbank, Monotrone, Relesys, Runwell, Staffers |
| Analytics | Apicbase, Plecto, PMI by d2o |

**How OT/supplements flow to payroll:**
- Salary codes assigned to each supplement type; codes mapped to payroll provider's pay-item codes
- Setup: Settings → Payroll → Salary Codes + Payroll Supplements
- Export flow (Tripletex example): approve shifts → export file → import into Tripletex → validate codes/hours/depts → run pay-run
- "Group by wage" in payroll settings shows supplement hours on distinct lines in export
- Configurable columns in CSV/Excel export: fields, ordering, decimal formatting, header names

**A-melding / Norwegian statutory reporting:**
- Not handled directly by Planday — passes data to Tripletex/Visma who handle A-melding submission [HIGH confidence; Planday is a scheduling/time tool, not a payroll system of record]
- No direct Skatteetaten integration documented in Planday

**Pay rules engine:**
- 7 supplement types: Normal (time-of-day or hour threshold), Week-based, Day-based, Manual (fixed per shift or hourly), Contract Rules (OT from contract), Personal (fixed monthly), Seniority (employment-length-based)
- Per-supplement config: eligibility filters (employee type/group/shift type/weekday/holiday/date range), calculation basis (fixed amount or %), application method (fixed window or shift-relative), break interaction, midnight-crossing behavior
- Highest-value supplement wins when multiple apply (unless "Enforced payment" enabled)
- Double-trigger risk when supplement applies to both weekday AND bank holiday (applies twice)
- Processing delay: auto supplements up to 10–15 min to appear in reports after changes
- Salaried employee limitation: requires "Affects salaried employee" toggle; shift-based pay blocks supplements entirely

**Salary type mapping:**
- Employee groups hold standard pay rates and salary codes
- Individual wages editable per employee or bulk-updated via "Edit wages"
- Salary codes free-text (letters + numbers), mapped per group and per supplement type

---

## 5. Time-Banks + Leave Management

**Leave types supported:**
- Annual leave, sick leave, parental leave (explicit)
- TOIL (Time Off in Lieu / overtidsavspasering)
- Vacation, unpaid leave, absence [MEDIUM — exact type list configurable per workspace]
- Training, off-site (as shift types, not leave types proper) [MEDIUM]

**Accrual methods:**
- Fixed leave: given as set amount (e.g. 25 days/year)
- Accrued leave: earned based on hours worked OR periodic accumulation (e.g. monthly)
- Bank holiday calendars configurable; national holidays excluded from leave balance impact

**TOIL / overtime banking:**
- Three automation modes: (1) Punch clock deviations → automatic TOIL calculation, (2) Specific shift types that adjust balance, (3) Contract rules: hours beyond contracted = designated overtime
- Accounts per individual or employee group
- Balance visible on employee profile or Time-off account overview
- Manager can manually adjust balances (add/delete transferred hours)
- When TOIL is paid off: manager adjusts balance to reflect payout
- No documented payout-vs-time-off toggle per employee (manager decides manually) [MEDIUM]
- No documented expiry rules in published help content [MEDIUM — likely configurable]

**Sickness handling:**
- Self-certification not explicitly documented as a specific flow [MEDIUM — likely handled via leave request]
- Absence types tracked for attendance trend reporting (sick days visible in reports)
- "Sick" is a standard shift type in Planday's model

**Leave approval workflow:**
- Employee submits via app or web → manager reviews → accept/decline with optional note
- All actions recorded in request history
- Approved leave displayed on schedule automatically
- Data transmitted to payroll systems from approved leave

**Multi-type leave per employee:** Supported — employees can have multiple leave accounts [MEDIUM — implied by account-per-type model]

**Carry-over + expiry:** Not documented explicitly in public help content [LOW — likely in Pro/Enterprise config]

---

## 6. Communication Features

**Messaging:**
- 1:1 direct messages
- Group messages
- "Required reply" — messages that demand employee response; send/receive/read/act tracked
- File + image attachments
- Merge fields for personalization (auto-inserts recipient's name from profile)
- Read receipts: manager can see who has/hasn't read a message [HIGH]

**Announcements / news feed (Planday Hub):**
- Company news and updates publication
- Team events with sign-up tap
- Documentation library (employee handbooks, training materials)
- "Virtual noticeboard"

**Documents library:**
- General employer documents (handbooks, policy docs)
- Employee-specific: payslips, employment contracts, signed/unsigned documents needing attention
- E-signature support for contracts and agreements
- Auto-notify when documents near expiration

**Push notifications:**
- Open shift alerts to eligible employees
- Schedule change alerts
- Swap request notifications
- Manager configures notification recipients via Settings → Your organisation → Notifications

**Shift notes:** Managers add notes to specific shifts informing staff of expectations before they clock in

---

## 7. Workforce Management Policies — Configurable

Everything admins can configure (confirmed from docs):

**Scheduling rules:**
- Working time rules (max daily/weekly hours, rest periods, break requirements)
- Compliance warnings on schedule
- Local labor law rules (configurable per market; depth varies)
- Availability preference rules (available/unavailable/intervals)
- Draft shift toggle (test vs. publish)
- Shift swap approval threshold (0 hours = free swap; 50000 = always needs approval)
- Revenue-based staffing targets per department

**Punch clock policies:**
- Access methods per profile (GPS, WiFi, IP whitelist, kiosk, personal device)
- Rounding rules (common + custom per dept/group/type)
- Break rules (paid/unpaid, auto-deduct)
- Deviation rules (lateness, OT, undertime; per dept/group/type; min length threshold)
- Kiosk display mode (username/password or employee-list selection)
- Activation codes for kiosk devices

**Payroll policies:**
- Salary codes per employee group
- Supplement rules (7 types with full eligibility/calculation config)
- Payroll report column configuration
- Lock periods (no retroactive supplement changes in locked periods)
- "Group by wage" export setting

**Leave policies:**
- Fixed vs. accrued leave policy per type
- Bank holiday calendar integration
- Leave account creation (manual, bulk, or auto by dept/type)

**User permissions:**
- Configurable access levels per role
- Custom user roles (Pro tier)
- Employee form set-up: which fields visible and who can see them
- Department visibility scoping

**Skills + certifications:**
- Skills created with optional expiry dates, seniority levels, category/description
- Time-limited certifications with expiry tracking
- Required per shift or per position
- Scheduling enforcement: only matching employees assignable

**Compliance tools:**
- Contract rules engine (verify employees work contracted hours)
- Document expiry notifications
- Working time rule enforcement in schedule
- Note: Riksavtalen-deep tariff logic (specific NHO Reiseliv supplement tables, seniority brackets per Fellesforbundet agreement) NOT documented as native Planday functionality [HIGH confidence this is a gap]
- No explicit AML (Arbeidsmiljøloven) specific compliance rules documented; generic "working time rules" only [MEDIUM]

---

## 8. Reporting + Analytics

**Built-in report types:**
- Staff costs (by department, daily/weekly/yearly, real-time as schedule builds)
- Payroll report (scheduled vs. actual hours, clocked time, pay rates, OT, supplements, salary codes)
- Revenue forecasting (input manual or import from POS)
- Labor cost vs. revenue (payroll % of expected revenue, daily/weekly/monthly/yearly)
- Attendance trends (holidays, sick days, lateness — filterable by location/role/employee)
- Schedule compliance report (contracted hours coverage — green/yellow/red)
- Payroll cost vs. revenue overview chart

**Custom report builder:**
- Custom revenue charts: bar or line, configurable metrics
- Payroll report: configurable columns, reordering, renaming, decimal formatting
- Filter by department, team, location, role, employee, period
- Export charts to Excel [HIGH]

**Data export formats:**
- PDF (schedule overview, payroll)
- Excel/CSV (payroll report with configurable columns)
- Direct sync to payroll providers via integrations
- API access (Reports namespace: shift data + approval status + breaks)

**Labor cost vs. revenue:**
- Real-time cost as % of expected revenue on schedule
- Scheduled vs. actual comparison after punch clock approval
- Daily revenue budget API endpoints (added Sep 2025)
- Salary budget per daily revenue budget (added Sep 2025)

**Notable gap:** No advanced visualization dashboards, custom dashboard builder, or BI-level analytics [confirmed by user reviews — HIGH]

---

## 9. Mobile App Capabilities

**Platform:** iOS + Android. App version 10.20.0 (May 2025). Available at `kiosk.planday.com` for browser-based kiosk.

**Employee features:**
- View upcoming shifts (with colleague names, location, position)
- Punch in/out (with geofence or WiFi restriction)
- Clock in/out of breaks
- View and request open shifts
- Swap, handover, or sell shifts
- Mark availability (available/unavailable periods)
- Request time off / absence
- View leave balances and request status
- View approved + scheduled hours (monthly breakdown)
- See estimated pre-tax earnings by pay period
- 1:1 and group messaging
- Read and act on news/announcements
- Access documents, payslips, employment contracts
- View colleague directory
- Sync shifts to external calendar
- Manage multiple Planday accounts (multi-employer)

**Manager features:**
- Approve/decline punch clock entries (last 7 days; older requires web)
- Approve leave requests
- Send messages (including required-reply)
- View schedule and team status in real-time
- Approve shift swaps (within threshold)
- Add payroll supplements: NOT possible on mobile app [HIGH — documented limitation]
- Deviation rule approval: NOT possible on mobile [HIGH — web-only]

**Offline mode:** Not documented; assumed not supported [MEDIUM]

**Performance issue (confirmed in reviews):** App loading times 30–45 seconds in some cases; sync delays between schedule updates and mobile display

---

## 10. API + Extensibility

**API documentation:** https://openapi.planday.com

**Auth model:** OAuth2, Authorization Code flow. Bearer token. API application created in Settings → API access. Per-portal authorization required per portal the integration accesses.

**API namespaces / endpoints:**
- `Absence` — vacation + overtime account data, balances, transactions
- `Contract Rules` — employee contract rule configuration
- `HR` — employee details sync
- `Pay` — pay rates + salary management
- `Payroll` — detailed payroll information
- `Portal` — portal details
- `Punchclock` — clock in/out entries (read + write)
- `Reports` — shift data, approval status, breaks
- `Revenue` — update revenue data
- `Schedule` — shift info + costs
- `Security Group Membership` — employee group management

**Rate limits:**

| Bucket | Per portal | Per client ID |
|---|---|---|
| Per second | 20 req | 100 req |
| Per minute | 750 req | 2,000 req |

Headers: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`. 429 on breach.

**Webhooks:** Not documented in public API docs [LOW confidence they exist; likely absent or private partner-only]

**Public SDK:** None documented. Community GitHub repos exist (e.g. `pmsanz/planday`, `csmichaelkamal/planday-schedule-api-techtest`) but these are third-party clients, not official SDKs.

**Partner program:** https://openapi.planday.com/gettingstarted/become-an-integration-partner/ — formal integration partner path exists. Contact: apisupport@planday.com.

**ID scoping gotcha:** Only `portalId` is globally unique. All other IDs (employee, shift, department) are portal-scoped. Cross-portal composites needed for enterprise multi-portal setups.

---

## 11. What Planday Does WELL — Copy These

1. **7-supplement-type pay rules engine with stacking logic.** Normal, week-based, day-based, manual, contract rules, personal, seniority — covers virtually every Norwegian tariff scenario. Highest-value-wins + enforced-payment toggle is smart. Our `DYNAMIC-SUPPLEMENTS.md` should match this depth.

2. **Shift swap approval threshold (hours-based cutoff).** Dead simple UX: one number controls whether swaps need manager approval. "0 = always free, 50000 = always approve" is elegant config. We should adopt this exact pattern rather than a multi-toggle.

3. **Skills with expiry dates required per shift or per position.** Time-limited certifications tracked automatically, enforced in scheduling. Exactly the kind of compliance-as-byproduct behavior we want. Our skill matrix should replicate expiry + auto-block.

4. **Open shifts with push notifications + eligibility filtering.** Eligible = group + skill match. Notification fires automatically. Manager approves from queue. This is the right model for our open-shift fill flow.

5. **Draft shifts before publish.** Lets manager plan privately, iterate, then release. Prevents accidental notifications. We should build this into our schedule editor from day one.

6. **Punch clock deviation rules with minimum-length threshold.** Config: "ignore deviations under 5 minutes" eliminates noise; "lateness rule → maps to specific shift type" turns clock deviations into payroll events cleanly. Strong architecture signal.

7. **Revenue vs. labor cost real-time overlay on the schedule editor.** Payroll % of expected revenue visible as you build the rota. This is exactly what a restaurant manager needs on a Saturday — not just hours but cost impact. Smartout should show this in D6 session view.

8. **Multi-employer support in employee mobile app.** Employee works at two venues using Planday — one app, context switch. Relevant for Norway where multi-employer is common in hospitality.

9. **Required-reply messages with read receipts.** Messages that demand a response + visible who hasn't read. Critical for shift-change comms in hospitality. Our `MODULE_COMMUNICATION.md` should explicitly include this.

10. **Norway-specific payroll integrations depth.** 12 payroll connectors for Norway alone (Tripletex, Visma Lønn, Uni, Huldt & Lillevik, Xledger, etc). This is table-stakes; we need parity on at least Tripletex + Visma Lønn as Phase 1.

---

## 12. What Planday Does Poorly / Gaps for Smartout

**Confirmed weaknesses (from reviews + docs):**

1. **No Riksavtalen-native tariff logic.** Planday's supplement engine is generic and configurable, but it does NOT ship with pre-built Riksavtalen profiles (NHO Reiseliv seniority brackets, specific tillegg for kveld/helg/helligdag, Fellesforbundet overtime tables). A Norwegian restaurant manager must build these rules manually. **Smartout's tariff_rate_table + regulatory_framework cascade (K1a/D3) is a direct moat here.**

2. **No A-melding.** Planday hands off to Tripletex/Visma for Skatteetaten reporting. We can offer direct A-melding from the product via our Skatteetaten Edge Function (ADR-0250). Smartout could be the first tool where A-melding is automatic, not an accountant integration step.

3. **Chat is async / email-style, not real-time.** Users consistently criticise the messenger for feeling like email (separate threads, no real-time feel). WhatsApp has trained staff to expect instant replies. Our Botsson-integrated chat should feel conversational.

4. **No AI colleague / onboarding.** Planday's "AI" is auto-scheduling (shift assignment solver) and demand forecasting. Zero employee-facing AI for training, onboarding guidance, procedure queries, or daily briefing. This is Botsson's entire value prop — untouched by Planday.

5. **No procedure / compliance content layer.** Planday has documents and a news feed; it does NOT have the policy → protocol → procedure hierarchy that makes compliance a byproduct of competence. It's a scheduling tool that stores documents. We build the operating system.

6. **Mobile app performance.** 30–45 second load times, sync delays. Restaurant floor — unacceptable. Our React Native + Expo stack must be optimized from day one. This is a differentiator if we nail it.

7. **No offline mode documented.** In a restaurant kitchen or cellar with poor connectivity, this matters. We should build offline-capable mobile actions (clock-in queue, procedure reading).

8. **Payroll supplements can't be added from mobile.** Managers on the floor can't annotate a shift with a manual supplement. Any correction requires web access. We should allow manager mobile supplement entry gated by C4.

9. **No proactive leave/absence intelligence.** Planday tracks balances but does not proactively warn "you're about to go understaffed because 3 employees have expiring TOIL that they haven't used." Our Event Engine + proactive AI is a direct gap-filler.

10. **12-month minimum contract and sales pressure.** Multiple reviews call out aggressive contract lock-in. We can compete with monthly pricing + transparent self-serve. Stripe-first billing (ADR-0262) enables this.

11. **Advanced reporting gated at Plus/Pro.** Basic reports are Starter-tier; labor cost vs. revenue requires Plus; auto-scheduling requires Pro. Progressive feature gating creates upgrade friction. We can make core analytics table-stakes at all tiers.

---

## 13. UX Patterns Relevant to Our `dashboard/payroll` Build

**Planday payroll review screen (inferred — no public screenshots found):**
- Manager navigates to `Schedule > Punch Clock` for approval queue
- Shows list of shifts with punch-in/out times, deviation flags (yellow/red), calculated hours
- Editable start/end fields per row with rounding suggestion visible
- Bulk-select + bulk-approve checkboxes
- Payroll report = separate view: customizable column export (CSV/Excel/PDF)
- "Pending actions" widget on front page surfaces un-approved entries

**Approval workflow pattern (directly applicable to Smartout `/dashboard/payroll`):**
- Deviation surfaced → manager reviews → edits if needed → approves → flows to payroll
- Period lock prevents retroactive changes
- Supplements visible per shift line in export

**Manager UI patterns worth copying:**
- Pending actions dashboard widget (quick glance at what needs attention today)
- Colour-coded contract hours status (green/yellow/red) on schedule = immediate staffing health
- Payroll % of revenue overlay on schedule editor (cost-as-you-plan)
- Rounding suggestion visible before approval (manager can accept or override)
- Shift notes field (manager leaves instruction on shift; employee sees on punch-in)

**Mobile UX for time-bank balance + leave request (from employee app docs):**
- Monthly hours breakdown with pre-tax earnings estimate on same screen
- Leave request submitted via single tap; balance shown alongside
- Leave status visible (pending/approved/declined) in app
- Shift calendar view = primary home screen with availability toggle

---

## 14. Data Model Hints (Inferred)

From API docs, help center, and structure guide:

**Core entity hierarchy:**
```
Portal (workspace equivalent, globally-unique ID)
  └─ Department (physical location / section)
       └─ Employee Group (mandatory on every shift — role class)
            └─ Section (organizational label)
                 └─ Position (shift responsibility descriptor)
                      └─ Shift (work instance)
                           └─ ShiftType (normal/sick/training/overtime/etc.)
```

**Key tables inferred:**

| Entity | Key fields |
|---|---|
| `portal` | `portalId` (globally unique) |
| `department` | `departmentId` (portal-scoped) |
| `employee_group` | `groupId`, standard pay rate, salary codes |
| `employee` | `employeeId`, `employeeTypeId`, `salaryIdentifier`, `hiredFrom`, `deactivationDate`, `PrimaryDepartmentId` |
| `shift` | `shiftId`, `employeeId`, `departmentId`, `positionId`, `shiftTypeId`, `start`, `end`, `status` |
| `punch_clock_shift` | `punchClockShiftId`, `shiftId`, `employeeId`, `punchIn`, `punchOut`, `isApproved`, breaks |
| `leave_account` | `employeeId`, `leaveType`, `balance`, `transactions` |
| `toil_account` | `employeeId`, `balance`, `transactions` |
| `payroll_supplement` | type, eligibility rules, rate/%, shift/weekday/holiday filters |
| `skill` | `skillId`, expiry, seniority levels, employee group |
| `revenue_budget` | `departmentId`, `date`, `amount`, `salaryBudget` |

**Architecture signals:**
- `portalId` scoping = multi-tenant SaaS monolith or per-tenant database [MEDIUM — leans toward shared DB with portal partitioning]
- Sub-portal (master + sub portal linking) = likely separate Postgres schemas or tenant rows, not separate clusters
- `isApproved` field on punch entries + period locking = event-sourced-ish approval state on top of mutable records (not immutable events like our `payroll_calculation` model)
- API namespaces (Schedule, Punchclock, Payroll, HR, Absence) as separate versioned APIs = likely microservice or modular monolith boundaries
- No webhook documentation = likely polling-based integrations for all external connectors [MEDIUM]
- Australia region retired Oct 2024 = probable move away from multi-region deployment toward single-region global

---

## 15. Risks for Smartout if Planday Becomes More Competitive

**Where Planday could move into our space:**

1. **AI-powered briefing / Botsson-lite.** Planday's 2025 tech trends report explicitly calls out AI for "taking over time-consuming admin like scheduling and payroll." They are watching this space. A Planday-native AI assistant for employees (shift briefing, procedure lookup) is a 12–18 month product bet away.

2. **Deeper Norway tariff pre-configuration.** If Planday builds Riksavtalen profiles as a Norway-market template (they have the integrations, the market presence, and the supplement engine skeleton), the manual configuration barrier disappears.

3. **Xero accounting tighter integration.** Xero ownership means deeper accounting + payroll integration is a natural roadmap move. A-melding via Xero → Planday bridge is plausible.

4. **AI auto-scheduling expansion.** Current auto-scheduler is a constraint solver. Adding demand forecasting from POS data + historical punch patterns (they have all this data) puts them squarely in our C1 Calibration and D4 Demand territory.

5. **Better mobile app.** The current mobile performance is a known weakness. One engineering sprint + React Native migration could close this gap. Don't assume it stays slow.

**Smartout's defensible moat (what Planday cannot easily replicate):**

| Moat | Why durable |
|---|---|
| Cascade architecture (I1 → D1–D6 → C1–C4) | Multi-dimensional constraint system baked into schema from day 1; not bolt-on |
| Mr. Botsson as AI colleague | Onboards, guides daily, maintains competence — fundamentally different from a scheduling assistant |
| Procedure = atomic truth | Policy → Protocol → Procedure hierarchy makes compliance a competence byproduct; Planday has documents, not procedures |
| Norwegian tariff native (Riksavtalen + AML deep) | Pre-built tariff profiles in K1a; regulatory_framework in D3; not generic config |
| Direct A-melding (ADR-0250) | Skatteetaten Edge Function; accountant integration not needed |
| Employee readiness as product metric | "Ready" = all Policies learned + Protocols completed — entirely outside Planday's model |
| Proactive Event Engine | Cascading automated responses to operational events; Planday is reactive |

**Biggest near-term competitive risk:** Planday prices down and bundles AI scheduling for free at Starter. Norwegian restaurant managers who already know Planday may not switch for incremental improvements. The Smartout value prop must be **existentially different**, not marginally better — and Botsson is the hinge.

---

## Appendix: Key URLs

| Resource | URL |
|---|---|
| Main site | https://www.planday.com |
| Pricing | https://www.planday.com/pricing/ |
| Features overview | https://www.planday.com/features/overview/ |
| Scheduling | https://www.planday.com/how-it-works/scheduling |
| Punch clock | https://www.planday.com/how-it-works/time-tracking/punch-clock |
| Absence & leave | https://www.planday.com/how-it-works/absence-and-leave-management |
| Communication | https://www.planday.com/how-it-works/communication |
| Reporting | https://www.planday.com/how-it-works/reporting/ |
| Hospitality | https://www.planday.com/who-we-help/hospitality |
| Integrations (Norway) | https://help.planday.com/en/articles/101819-planday-integrations-availability-by-market |
| Tripletex integration | https://www.planday.com/how-it-works/integrations/tripletex |
| Payroll supplements | https://help.planday.com/en/articles/30495-overview-of-payroll-supplements |
| TOIL management | https://help.planday.com/en/articles/30614-toil-management-explained |
| Auto-schedule | https://help.planday.com/en/articles/30439-how-to-use-the-auto-schedule-tool |
| Skills setup | https://help.planday.com/en/articles/30445-how-to-set-up-and-use-skills |
| Punch clock approval | https://help.planday.com/en/articles/30452-how-to-manage-and-approve-punch-clock-entries |
| Rounding rules | https://help.planday.com/en/articles/30453-punch-clock-configure-rounding-rules |
| Developer portal | https://openapi.planday.com |
| API rate limits | https://openapi.planday.com/gettingstarted/rate-limiting/ |
| Planday structure | https://openapi.planday.com/guides/planday-structure/ |
| Xero acquisition | https://nordic9.com/news/planday-was-acquired-for-1557-million-by-us-based-xero/ |
