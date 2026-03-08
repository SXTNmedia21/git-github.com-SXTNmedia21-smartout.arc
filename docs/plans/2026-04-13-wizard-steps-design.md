---
title: "Design — WorkspaceSetupWizard 7 Steps"
status: approved
updated: 2026-04-13
created: 2026-04-13
module: cross-cutting
tags: [wizard, onboarding, governance, handbook, payroll, employment, team, schedule, season]
---

# Design — WorkspaceSetupWizard 7 Steps

## Steps

| #   | id             | Title               | Component                      |
| --- | -------------- | ------------------- | ------------------------------ |
| 1   | governance     | Dine retningslinjer | GovernanceSetupStep (enhanced) |
| 2   | handbook       | Din personalhandbok | HandbookSetupStep              |
| 3   | payroll        | Lonn og tillegg     | PayrollSetupStep               |
| 4   | employment     | Ansettelsesvilkar   | EmploymentSetupStep            |
| 5   | team           | Ditt team           | TeamSetupStep                  |
| 6   | shift-template | Din forste vaktmal  | ShiftTemplateSetupStep         |
| 7   | season         | Din sesong          | SeasonSetupStep                |

## Scroll Fix

Remove `justify-center` from content area parent. Keep `items-center`. Content scrolls naturally.

## Step 1: Governance (enhanced)

Add Collapsible to each TemplateCard. Click card body toggles expand. Click Switch toggles selection (stopPropagation). Expanded shows: longDescription, item summary, training flow explanation, legalBasis (if present). Add `longDescription` and `legalBasis` fields to GovernanceTemplate type.

## Step 2: Handbook

10 fixed chapters from chapters.ts. Each row: icon + title + "Skriv"/"Hopp over". "Skriv" opens inline Tiptap editor (@tiptap/react + StarterKit, bold/italic/headings/lists). Saves to handbook_chapter (chapter_key, title, content as Json, workspace_id, updated_by). Checkmark for chapters with content. Complete when >= 1 chapter saved.

## Step 3: Payroll

Del 1: Tariff RadioGroup (Riksavtalen, Hotelloverenskomsten, Ingen, Annen). Prefills supplement rates.
Del 2: Editable supplement table (kveldstillegg, helgetillegg, helligdagstillegg, overtid 50%, overtid 100%).
Del 3: Position wages from position table, hourly_rate input per position.
Saves as policy rows with policy_type: 'payroll', rules_json.

## Step 4: Employment Terms

Del 1: Employment forms checkboxes (fast heltid 37.5t/1mnd, fast deltid/1mnd, tilkalling/14d, laerling 37.5t/1mnd). Each expandable with hours/notice inputs.
Del 2: Common terms (provtid 6mnd, feriedager 25 +toggle 5, feriepenger 10.2%, OTP 2%, arbeidsgiveravgift 14.1%).
Del 3: Preview text summary.
Saves as policy with policy_type: 'hr', rules_json. Complete when saved.

## Step 5: Team

Invite rows: fornavn, etternavn, e-post, avdeling dropdown, ansettelsesform dropdown, stilling dropdown, grunnlonn (auto from payroll step). Send via create-invitation EF batch mode. Per-row status. Complete when > 0 sent.

## Step 6: Shift Template

Department list from workspace. Per dept: add template (name, start_time, end_time). Creates schedule_template + schedule_template_shift. Complete when >= 1 created.

## Step 7: Season

Name, start_date, end_date. INSERT season with status draft. Complete when season exists.
