---
title: "User Journeys — HMS Phase 1"
status: done
updated: 2026-03-22
created: 2026-03-22
module: hms
tags: [journeys, hms, phase-1]
---

# User Journeys — HMS Phase 1

## Journey: Admin views HMS overview

**Precondition:** Admin is logged in, workspace has active protocols with assignments.

1. Admin clicks "HMS" in sidebar -> System navigates to `/dashboard/hms` -> Admin sees Oversikt with sub-nav (5 tabs)
2. Admin sees Status block -> System shows readiness %, open deviations (0, Phase 2), overdue count, protocol count
3. Admin sees Attention block -> System lists protocols with expired assignments (red) and low completion (yellow)
4. Admin clicks an attention item -> System navigates to `/dashboard/hms/training`
5. Admin sees Action block -> System shows buttons: Tildel opplaering, Logg kontroll, Inspeksjonspakke

**Postcondition:** Admin has a clear picture of what requires attention now.

**Error paths:**

- No protocols exist -> Status shows 0% readiness, 0 protocols, Attention shows "Ingen varsler akkurat na"
- Data fails to load -> Spinner shown, error state if query fails

---

## Journey: Employee views readiness

**Precondition:** Employee is logged in, has protocol assignments.

1. Employee clicks "HMS" in sidebar -> System navigates to `/dashboard/hms` -> Employee sees readiness ring
2. Employee sees their readiness percentage and remaining count -> System calculates from protocol_assignment completion
3. Employee sees next recommended protocol with progress bar -> System picks first incomplete assignment
4. Employee clicks "Fortsett" -> System navigates to `/dashboard/hms/training`

**Postcondition:** Employee knows their readiness status and next action.

**Error paths:**

- No assignments -> Ring shows 0%, message "Ingen opplaering tildelt enna"
- All assignments completed -> Ring shows 100%, message "Alt fullfort!"

---

## Journey: Admin browses compliance documents

**Precondition:** Admin is logged in, workspace has policies, protocols, and procedures.

1. Admin clicks "Dokumenter" tab -> System shows two-panel layout: tree (left) + empty viewer (right)
2. Admin types in search box -> System filters tree by name match
3. Admin clicks a policy node -> System expands to show protocols, viewer shows policy statement
4. Admin clicks a protocol node -> System expands to show procedures, viewer shows protocol description
5. Admin clicks a procedure -> System shows procedure steps as ordered list with action bar
6. Admin clicks "Start opplaering" in action bar -> System navigates to `/dashboard/hms/training?procedure=<id>`
7. Admin clicks "Administrer" -> System navigates to `/dashboard/hms/procedure/<id>`

**Postcondition:** Admin has located and reviewed a compliance document.

**Error paths:**

- No documents exist -> Tree shows "Ingen dokumenter funnet"
- Document not found -> Viewer shows "Dokument ikke funnet"

---

## Journey: Admin reviews competence matrix

**Precondition:** Admin is logged in, workspace has employees with protocol assignments.

1. Admin clicks "Opplaering" tab -> System shows competence matrix (person x protocol table)
2. Admin sees rows per employee, columns per protocol, cells showing OK/Pagang/Forfalt/--
3. Admin sees readiness % per employee in rightmost column
4. Admin clicks department filter -> System filters rows to selected department
5. Admin identifies employees with low readiness or expired protocols

**Postcondition:** Admin has visibility into team-wide training compliance.

**Error paths:**

- No assignments -> "Ingen protokolltildelinger funnet"
- Single department -> Filter buttons hidden

---

## Journey: Employee views training list

**Precondition:** Employee is logged in, has protocol assignments.

1. Employee clicks "Opplaering" tab -> System shows existing ProtocolList (reused from my-training)
2. Employee sees assigned protocols with progress bars
3. Employee expands a protocol -> System shows procedures, tests, confirmations

**Postcondition:** Employee sees their training assignments and progress.

**Error paths:**

- No assignments -> Empty state from ProtocolList

---

## Journey: Admin views procedure detail

**Precondition:** Admin is logged in, procedure exists.

1. Admin navigates to `/dashboard/hms/procedure/<id>` -> System shows ProcedureDetailTabs
2. Admin sees header: procedure name, status badge, policy type, protocol name
3. Admin clicks "Steg" tab -> System shows ordered steps with training content (if populated)
4. Admin clicks "Quiz" tab -> System shows placeholder (Phase 2)
5. Admin clicks "Bekreftelse" tab -> System shows placeholder (Phase 2)

**Postcondition:** Admin has full visibility into procedure structure and content.

**Error paths:**

- Invalid procedure ID -> "Prosedyre ikke funnet"

---

## Journey: Employee learns a procedure

**Precondition:** Employee is logged in, procedure exists.

1. Employee navigates to `/dashboard/hms/procedure/<id>` -> System shows ProcedureExperience with LearnFlow
2. Employee sees 5-stage progress bar: Forsta / Ov / Test / Bekreft / Fullfort
3. Employee reads step content (training_content if available, otherwise description)
4. Employee clicks "Neste" to advance through steps -> System shows next step
5. Employee completes all steps -> System shows "Neste fase" to advance to Practice stage
6. Employee advances through remaining stages (Practice, Test, Confirm -> placeholders in Phase 1)
7. Employee reaches Done stage -> System shows green success state

**Postcondition:** Employee has reviewed all procedure steps.

**Error paths:**

- No steps defined -> "Denne prosedyren har ingen steg enna"
- Procedure not found -> "Prosedyre ikke funnet"

---

## Journey: User navigates from old governance URL

**Precondition:** User has bookmarked or linked to `/dashboard/governance`.

1. User navigates to `/dashboard/governance` -> System redirects to `/dashboard/hms`
2. User sees HMS Oversikt page with sub-nav

**Postcondition:** Old governance URL still works via redirect.

**Error paths:** None — redirect is unconditional.

---

## Journey: User navigates between HMS tabs

**Precondition:** User is on any HMS page.

1. User clicks any tab in sub-nav (Oversikt, Drift, Opplaering, Dokumenter, Avvik)
2. System navigates to corresponding route, active tab highlights
3. Drift and Avvik show Phase 2 placeholder with icon and description

**Postcondition:** User can navigate all HMS sections.

**Error paths:** None — all tabs always render.
