---
title: "User Journeys — Profession System"
status: done
updated: 2026-03-28
created: 2026-03-28
module: onboarding
tags: [profession, position, authority, onboarding, journeys]
---

# User Journeys — Profession System

## Journey: Admin confirms professions and positions during onboarding

**Precondition:** Admin has completed the Join wizard. Workspace exists with intelligence_data. Onboarding confirmation wizard is loaded.

1. Admin opens `/onboarding` → System loads wizard with 5 steps
2. Admin completes Step 1 (Departments) and Step 2 (Locations)
3. Admin reaches Step 3 (Fag & Posisjoner) → System queries `profession` + `profession_industry` tables for platform professions matching the workspace NACE code + universal professions
4. System displays professions as compact group headings (Kjokken, Servering, Bartending, Ledelse) with positions as ghost cards underneath
5. Common positions are pre-selected (solid border with checkmark). Uncommon positions shown as dashed suggestions
6. Admin toggles positions on/off by clicking ghost cards → State updates immediately
7. Admin can add a custom position: clicks "Legg til egen posisjon" → selects profession from dropdown → types position name → clicks "Legg til" → Position appears as selected card under the chosen profession
8. Admin clicks "Neste" → Proceeds to Step 4 (Prosedyrer)
9. At Step 5 (Oppsummering), selected professions and positions are shown in summary
10. Admin clicks "Fullfar" → System calls finalize-workspace Edge Function with professions payload → RPC creates `position` rows with `profession_id` FK, matching department by profession name

**Postcondition:** Workspace has positions linked to professions. Positions are assigned to matching departments (Kjokken positions → Kjokken department).

**Error paths:**

- No professions returned for NACE code → Only universal professions (Ledelse) shown. Admin can still add custom positions.
- Scraping returned no locations → Default location auto-generated from business name (location bug fix).

---

## Journey: Admin assigns legal function to employee (future)

**Precondition:** Workspace exists with legal_function seed data (Verneombud, Brannvernleder, etc.). Employee profile exists.

1. Admin navigates to employee profile → Sees "Lovpaalagte funksjoner" section
2. Admin clicks "Tildel funksjon" → System shows available legal functions from `legal_function` table
3. Admin selects "Verneombud" → System creates `profile_legal_function` row with assigned_at + assigned_by
4. System seeds access scopes from legal function (hms.read, hms.write) → `profile_access` rows with `granted_by = 'legal_function'`
5. Employee now sees HMS module in their dashboard

**Postcondition:** Employee has Verneombud function assigned. HMS access granted automatically.

**Error paths:**

- Legal function already assigned → System prevents duplicate (composite PK)
- Non-admin tries to assign → RLS blocks (is_admin_in_workspace guard on manage policy)

---

## Journey: Admin sets authority level on employee profile (future)

**Precondition:** Employee profile exists with position(s) assigned.

1. Admin navigates to employee profile → Sees "Ansvarsniva" dropdown
2. Admin sets authority_level to "leader" → System updates `profile.authority_level`
3. System seeds access scopes based on authority level + employee's profession (via positions) → `profile_access` rows with `granted_by = 'authority'`
4. Employee's title updates: Kokk + leader = "Kjokkensjef"

**Postcondition:** Employee has leader authority. Access scopes seeded. Title derived from primary position + authority.

**Error paths:**

- Authority changed from leader to NULL → System removes access with `granted_by = 'authority'`. Manual and legal_function access preserved.

---

## Journey: Employee with multiple positions (future)

**Precondition:** Employee profile exists.

1. Admin assigns employee to positions: Servitor (primary) + Bartender → `profile_position` rows created
2. Employee inherits training requirements from both professions (Servering + Bartending)
3. Readiness calculated across both professions' weighted training requirements
4. On schedule, employee can be assigned to shifts requiring either position

**Postcondition:** Employee has multi-fag competence. Readiness reflects all assigned professions.

**Error paths:**

- Same position assigned twice → Prevented by composite PK
- Position deleted → CASCADE removes profile_position row
