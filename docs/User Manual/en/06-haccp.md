---
title: "HACCP and Food Safety"
id: MANUAL_06_EN
version: "1.0"
status: canonical
layer: manual
created: 2026-03-24
updated: 2026-03-24
author: claude
slug_en: haccp
tags:
  - manual
  - haccp
  - food-safety
  - compliance
  - english
---

# HACCP and Food Safety

> HACCP governance, temperature logging, deviation handling, certifications and inspection-ready documentation.

---

## What is HACCP?

HACCP (Hazard Analysis and Critical Control Points) is the international food safety system that all food service establishments in Norway must follow. SmartOut integrates HACCP directly into daily operations through the governance model.

> SmartOut does not replace your hazard analysis — it helps you document, monitor and enforce it digitally.

---

## How SmartOut handles HACCP

SmartOut links HACCP to the governance chain:

| HACCP element          | SmartOut concept            | Description                                 |
| ---------------------- | --------------------------- | ------------------------------------------- |
| Hazard analysis        | Policy (type: haccp)        | Defines the risk and the requirement        |
| Critical control point | Protocol + Asset            | Linked to physical equipment (fridge, oven) |
| Monitoring             | Routine (via hook)          | Automatically triggered temperature logging |
| Corrective action      | Runbook                     | Step-by-step on deviation                   |
| Verification           | Checklist                   | Checklist for manager                       |
| Documentation          | Operational session history | Everything is stored automatically          |

---

## Temperature logging

Temperature logging is a routine triggered by session hooks:

1. **The system notifies** the employee that it is time for a temperature check
2. **The employee** records the temperature for each control point
3. **The system checks** whether the value is within acceptable limits
4. **On deviation** — the system automatically escalates and opens corrective action

### Temperature limits

Temperature limits are configured per asset (equipment unit):

- **Refrigerator:** 0-4 °C
- **Freezer:** Below -18 °C
- **Hot holding:** Above 60 °C

> Limits can be customised per workspace based on your own HACCP plans and the Norwegian Food Safety Authority's requirements.

---

## Deviation handling

When a temperature or control value is outside limits:

1. **The deviation is logged** automatically with timestamp, value and responsible person
2. **Corrective action** is presented as a runbook
3. **The manager is notified** immediately via push notification
4. **Follow-up** — the manager confirms that the action has been completed
5. **The deviation is closed** with documentation of what was done

---

## Certifications

SmartOut tracks employees' HACCP-related certifications:

- **Food safety course** — Basic food safety training
- **Allergen handling** — Specialist course for allergen awareness
- **Fire safety** — Fire extinguishing course and evacuation drills
- **First aid** — First aid course

The system automatically alerts when certifications are approaching their expiry date.

---

## Inspection ready

SmartOut makes you ready for inspections by the Norwegian Food Safety Authority (Mattilsynet):

- **Complete log** — All temperature logging, deviations and corrective actions are documented
- **Certification overview** — Who has which courses, and when do they expire
- **Export function** — Download reports in formats accepted by the authorities
- **Timeline** — Chronological overview of all HACCP events

> During an inspection, you can show the inspector a complete digital history directly from the dashboard.
