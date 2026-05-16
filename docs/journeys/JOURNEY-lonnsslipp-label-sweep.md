---
title: "Journey — lønnsslipp→lønnsgrunnlag label sweep"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: payroll
tags: [payroll, ux, label-sweep, adr-0346]
---

# Journey — lønnsslipp→lønnsgrunnlag label sweep

Covers user-facing outcomes after S1 label sweep (ADR-0346). Two journeys.

---

## Journey J1: Employee opens Min Lønn and sees correct label

**Precondition:**
- Employee is logged in to the web dashboard.
- No settled payroll periods exist yet (empty state).

**Steps:**

1. Employee navigates to `/dashboard/my-salary`.
   → System renders the `PeriodList` component.
   → Employee sees: "Ingen lønnsgrunnlag ennå" (not "lønnsslipp").

2. Employee navigates to `/dashboard/help`.
   → System renders `QuickPathCards`.
   → The "Lønn & timer" card description reads: "Sjekk timeoversikt, tillegg og lønnsgrunnlag."

3. Employee navigates to `/dashboard/my-profile/complete`.
   → In the address field purpose text, the word "lønnsgrunnlag/dokumenter" appears
     (not "lønnsslipp/dokumenter").

**Postcondition:**
- All three web surfaces display "lønnsgrunnlag" consistently.
- No "lønnsslipp" visible in any of these surfaces.
- Pedagogy line in LonnsgrunnlagViewer ("Dette er et lønnsgrunnlag — ikke en lønnsslipp.")
  is unchanged and still visible when a period is selected.

**Error paths:**
- If payroll periods DO exist: `PeriodList` shows the period rows (empty-state label not
  rendered); no regression introduced.

---

## Journey J2: Mobile employee opens lønnsgrunnlag-detail and sees correct label

**Precondition:**
- Employee is logged in to the mobile app.
- At least one settled payroll period exists.

**Steps:**

1. Employee taps the "Min profil" or "Me" tab.
   → System renders the `(me)/index.tsx` page.
   → The "Recent Payslips" section header reads: "Siste lønnsgrunnlag" (not "Siste lønnsslipper").

2. Employee taps "Se alle" or the bento card in the payroll section.
   → System navigates to `(me)/payroll/index.tsx`.
   → The bento card title reads: "Lønnsgrunnlag" (not "Lønnsslipper").

3. Employee taps the bento card.
   → System navigates to `(me)/payroll/payslip.tsx`.
   → Header title reads: "Lønnsgrunnlag" (not "Lønnsslipper").
   → Empty-state title reads: "Ingen lønnsgrunnlag" (not "Ingen lønnsslipper").

4. Employee taps a period row.
   → System navigates to `(me)/payroll/payslip-detail.tsx`.
   → Top bar title reads: "Lønnsgrunnlag" (not "Lønnsslipp").

5. Employee navigates to `(me)/payroll/lonnsgrunnlag-detail.tsx`.
   → Pedagogy line at line 318 reads: "Dette er et lønnsgrunnlag — ikke en lønnsslipp."
   → This line is UNCHANGED (pedagogy guard, ADR-0346 §4).

**Postcondition:**
- All mobile payroll surfaces display "lønnsgrunnlag" consistently.
- No "lønnsslipp" / "lønnsslipper" visible in user-facing strings in these surfaces.
- The pedagogy contrast line in lonnsgrunnlag-detail is preserved unchanged.
- `strings.ts` constants return "lønnsgrunnlag" in both empty-state and error-state strings.

**Error paths:**
- If no periods exist: `payslip.tsx` shows the empty state with "Ingen lønnsgrunnlag" label.
- If load fails: `strings.loadErrorPayslip` reads "Kunne ikke laste lønnsgrunnlag".
