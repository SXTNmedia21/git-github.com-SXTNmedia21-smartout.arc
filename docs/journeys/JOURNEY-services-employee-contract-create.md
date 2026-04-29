---
title: "Journey — Admin creates employee contract"
feature: employee-contract
status: superseded
superseded_by: docs/architecture/contract-service/JOURNEY-contract-module.md
updated: 2026-04-29
created: 2026-04-28
module: other
tags: [journey, contracts, admin]
---

# Journey: Admin creates employee contract

**Precondition:** Admin logged in, workspace has at least one active employee profile + at least one contract template configured.

## Happy path

1. Admin clicks "Lag kontrakt" in `/dashboard/contracts` → `CompositionDrawer` opens.
2. Admin selects employee → System pre-fills `profile_id`, employment type defaults from prior contract if any → User sees employee card with name + role.
3. Admin selects position + employment percentage → System derives proposal via `composeMutation` → User sees ghost-value cards with reasoning links.
4. Admin acknowledges generated values in BekreftStep → System sets acknowledgement state → User sees green check on each acknowledged item.
5. (Optional) Admin edits contract HTML in BekreftStep editor → System captures `state.editedHtml` → User sees Manuelle endringer badge appear in SendStep.
6. Admin reaches SendStep → User sees "Send kontrakt" button + manual-edits badge if applicable.
7. Admin clicks "Send kontrakt" → System POSTs to `/api/employment-contracts` with `editedHtml` if present → User sees success toast + drawer closes + table refreshes.

**Postcondition:** Contract row exists in `employment_contract` with status=`draft` (or `pending_signature` if auto-sent), `editedHtml` persisted in `content_html`, audit_trail row written, telemetry `contracts.compose.submitted` emitted with `has_manual_edits` flag.

## Error paths

- **No employee selected:** "Neste" button disabled, tooltip explains why.
- **Compose mutation fails (network/500):** SendStep shows inline error banner, "Try again" button re-triggers derive without losing state.
- **Manual edit then template change:** `editedHtml` cleared, toast warns "Mal endret — manuelle endringer fjernet".
- **Drawer closed mid-edit:** UnsavedChangesGuard intercepts → "Forkast endringene?" dialog → user can keep editing or discard.
- **Submit during pending state:** Button disabled, spinner visible, prevents double-submit.
