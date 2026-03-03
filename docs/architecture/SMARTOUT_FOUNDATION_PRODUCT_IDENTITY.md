---
title: "Foundation — Product Identity"
id: FOUND_PRODUCT_ID
version: "1.0"
status: canonical
layer: architecture
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - foundation
  - product-identity
  - market
  - pricing
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout — Product Identity

> **Smartout.ai** — Foundation documentation
> Version 1.0 | February 2026
> **Source:** SMARTOUT_COMPLETE_DOCUMENTATION.md, Section 0

---

## 0. Product Identity

> **Summary:** Smartout is an Employee Readiness System targeting 75% annual turnover in Norway's service industry. It serves restaurants, hotels, cafés, and bars with per-employee/per-month SaaS pricing. The core value proposition: employees are "ready" when all assigned protocols are completed.

### 0.1 What Is Smartout

Smartout is an **Employee Readiness System** — a holistic platform that makes employees _ready_ for their shifts: trained, compliant, equipped, and informed. Unlike traditional HR tools or scheduling apps, Smartout's measure of success is a concrete **Readiness Score**: percentage of assigned protocols completed.

### 0.2 Core Problem

~75% annual turnover in the Norwegian service industry (down from 125% in 2021, but still critical). New hires are expensive (~$2,305 per hourly replacement, ~$16,770 per general manager), undertrained, and often leave before becoming productive. 88% of operators report increased labor costs. 27% still use paper or whiteboards for scheduling.

### 0.3 Target Market

| Segment                     | Description                                         | Priority |
| --------------------------- | --------------------------------------------------- | -------- |
| Restaurants (1–3 locations) | Owner/manager runs operations daily                 | Primary  |
| Hotels                      | Operations manager coordinates multiple departments | Primary  |
| Chains / Franchises         | Operations director oversees multiple locations     | Primary  |
| HR in HoReCa                | HR manager focused on compliance and retention      | Primary  |
| Retail                      | Shift-based retail operations                       | Roadmap  |

### 0.4 Pricing

Per employee / per month. Plan tiers define feature access and maximum profile count per workspace. Stripe handles all billing. Trial period included at signup.

### 0.5 Personas

| Persona             | Platform      | When                      | Core Need                    |
| ------------------- | ------------- | ------------------------- | ---------------------------- |
| Owner / Admin       | Desktop (90%) | Before & after operations | Setup, governance, oversight |
| Manager / Team Lead | Both (50/50)  | Before, during, and after | Plan, run, review            |
| Active Employee     | Mobile (95%)  | During shift              | Know what to do right now    |
| Trainee             | Mobile (90%)  | Before first shift        | Learn the system safely      |

### 0.6 Competitive Differentiation

Smartout differentiates through:

1. **Readiness Score** — no competitor measures employee readiness as a first-class metric
2. **Governance Model** — Policy → Protocol enforcement chain unique to platform
3. **Norwegian-first** — built for Norwegian labor law, HACCP, A-melding
4. **AI-native** — 8 specialized engines, not bolted-on AI features
5. **Season concept** — operational time periods with gamification
6. **Unified platform** — scheduling + operations + training + compliance in one system

Competitors serve parts of this: Planday (scheduling), Quinyx (workforce management), 7shifts (restaurant scheduling), Deputy (shift management). None offer the integrated readiness/governance/AI model.

---

_See also: workforce-management-research-report.md for detailed persona research and competitive analysis._
