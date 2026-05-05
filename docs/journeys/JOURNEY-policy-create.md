---
title: Policy create flow
status: draft
updated: 2026-04-29
created: 2026-04-29
module: governance
tags: [policy, governance, hms]
---

# Journey — Policy create

## Journey 1: Admin lager ny HR-policy

**Precondition:** Admin innlogget, ingen eksisterende policies i workspace.

1. Admin åpner `/dashboard/policies` → System viser tom-state med "+ Ny policy"-knapp.
2. Admin klikker "+ Ny policy" → System åpner `PolicyCreateDialog`.
3. Admin velger type "HR", tittel "Fraværspolicy", beskrivelse "Slik håndterer vi fravær: melde inn senest 1 time før vakt." → klikker "Lagre".
4. System inserter `policy`-row med `policy_type='hr'`, `policy_scope='workspace'`, `enforcement_status='aspirational'`, `statement=description` → emit `policy.created` → toast "Policy lagret" → dialog lukker → liste viser ny rad.

**Postcondition:** Policy synlig i listen. Audit trail entry.

**Error paths:**
- Tittel tom → submit disabled.
- RLS-violation → 403 + toast.

## Journey 2: Admin ser eksisterende policies

**Precondition:** Workspace har 3 policies.

1. Admin åpner `/dashboard/policies` → System fetcher policies server-side → KPI-strip viser 3 totalt.
2. Admin scrolls listen → ser navn, type, scope, opprettelsesdato.

**Postcondition:** Read-only listing. Edit/delete er Phase 2.

## Tabell-aksessmønster

- INSERT: `createPolicy` server action → minimal payload (name, description, policy_type) + server-side defaults (policy_scope='workspace', statement=description, created_by=session-profile, workspace_id=session-workspace).
- SELECT: server-fetch i `page.tsx`, filtrert på workspace_id + `is_active=true`.
