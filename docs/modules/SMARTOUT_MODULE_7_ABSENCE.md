# Module 7: Fravær & Permisjon (Absence & Leave)

> **Smartout.io** — Functional documentation for migration
> Version 1.0 | February 2026
> **Dependencies:** Core Architecture v2 (Profile, Department, Workspace), Module 3 (Scheduling), Module 8 (Payroll)
> **Status:** PLACEHOLDER — requires detailed specification

---

## 1. Module Overview

Covers vacation requests, sick leave (egenmelding + sykemelding), other leave types (parental, military, welfare), absence overview with calendar views, and the approval flow. Integrates with Norwegian labor law for employer period, NAV, and entitlements.

### What This Module Covers

- Vacation requests and balance management
- Sick leave (self-reported egenmelding + doctor's sykemelding)
- Other leave types (parental, military, welfare, training, unpaid)
- Absence overview with calendar and statistics
- Request and approval workflows
- Integration with scheduling (conflict detection) and payroll (absence pay)

---

## 2. Vacation Requests

> **TODO:** Detailed specification needed

- Employee submits vacation request with dates
- Display of vacation balance (feriesaldo)
- Manager approves/rejects with optional comment
- Conflict check against existing shifts in schedule
- Vacation calendar overview per department
- Norwegian statutory minimum: 25 days (Ferieloven)
- Transferable days rules
- Employer-mandated vacation periods

---

## 3. Sick Leave

> **TODO:** Detailed specification needed

### 3.1 Egenmelding (Self-Reported)
- Max 3 calendar days per instance (Folketrygdloven)
- Max 4 instances per 12-month period (with IA-avtale: up to 24 days)
- Employee registers in app
- Automatic notification to manager
- Day counting logic

### 3.2 Sykemelding (Doctor's Note)
- Registered by admin/manager
- Day counting and periods
- Employer period: first 16 calendar days
- NAV takeover after employer period
- Graded sick leave (e.g., 50%)
- Follow-up plans (oppfølgingsplan) at 4 weeks, 7 weeks

### 3.3 Sick Leave Rules
- Cannot be denied (employee right)
- Must notify as soon as possible
- Self-certification vs. medical certification thresholds

---

## 4. Other Leave Types

> **TODO:** Detailed specification needed

| Leave Type | Paid | Duration | Legal Basis |
|-----------|------|----------|-------------|
| Parental leave | Yes (NAV) | Up to 49/59 weeks | Folketrygdloven |
| Military service | Yes (limited) | Duration of service | Arbeidsmiljøloven §12-12 |
| Training leave | Varies | As agreed | Arbeidsmiljøloven §12-11 |
| Welfare leave | Varies | Short-term | Tariffavtale |
| Unpaid leave | No | As agreed | Agreement-based |
| Care of sick child | Yes | 10 days/year | Folketrygdloven |

---

## 5. Absence Overview

> **TODO:** Detailed specification needed

- Calendar view per employee
- Department-level statistics
- Absence patterns and trends
- Balance overview: vacation days, flextime, TOIL, sick days used
- Export capabilities for payroll and reporting

---

## 6. Request & Approval Flow

> **TODO:** Detailed specification needed

- Request types mapped to `_requestTypes` enum
- Approval chain: Employee → Team Leader → Manager (configurable)
- Notification at each stage
- Status tracking with history
- Integration with Module 3 (schedule adjustment on approval)

---

## 7. Data Model

> **TODO:** Detailed table schemas needed

**Expected tables:**
- `absence_request` — request with type, dates, status, approver
- `absence_balance` — running balance per employee per type
- `sick_leave_period` — detailed sick leave tracking with employer/NAV split

**Expected enums:**
- `AbsenceType`: sick_leave | parental_leave | vacation | unpaid_leave | military | training | welfare
- `RequestType`: available | not_available | vacation | sick_day | flextime | shift_swap | other

---

## 8. Integration Points

| Module | Integration |
|--------|------------|
| **Module 3 (Scheduling)** | Conflict detection, schedule adjustment, availability blocking |
| **Module 4 (Operations)** | Session task reassignment when employee absent |
| **Module 8 (Payroll)** | Absence pay calculation, NAV refund tracking |
| **Module 9 (Communication)** | Absence notifications to team/manager |
| **Module 10 (Reports)** | HR absence statistics, patterns |

---

*This module requires detailed specification. The content above is extracted from SMARTOUT_COMPLETE_DOCUMENTATION.md and the master index. A full spec should include complete data models, API endpoints, UI screens, Norwegian labor law edge cases, and the full approval workflow.*
