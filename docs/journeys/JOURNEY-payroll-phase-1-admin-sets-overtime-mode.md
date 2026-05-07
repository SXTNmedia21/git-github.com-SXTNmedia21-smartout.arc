---
title: "Journey — Admin sets overtime mode"
feature: payroll-phase-1
journey: admin-sets-overtime-mode
status: verified
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-07
module: payroll
tags: [journey, payroll, admin, overtime, toil-agreement]
---

# Journey: Admin sets overtime mode (paid_out↔banked)

**Role:** admin (only)

**Precondition:**
- Ansatt har aktiv `employee_payroll_profile` for workspace
- Workspace har konfigurert `payroll.workspace_settings`
- Admin har authority `confirm` for `payroll.set_overtime_mode` (ADR-0204)

## Happy Path

### Switch til "banked" (krever signert TOIL-avtale)

1. Admin åpner `/dashboard/people/[id]/complete-data` → klikker HR-tab → finner `LonnsprofilSection`
2. Admin ser overtime_mode-select dropdown m/ 2 valg: "Utbetalt (paid_out)" eller "Avspasering (banked)" + helpertekst "Banked krever signert TOIL-avtale"
3. Admin endrer fra "Utbetalt" → "Avspasering" → System sjekker `employee_payroll_profile.toil_agreement_signed_at`:
   - Hvis NULL → System BLOKKER m/ feilmelding "TOIL-avtale ikke signert. Send avtale til ansatt før banked-mode kan aktiveres" + viser "Send avtale"-CTA
   - Hvis NOT NULL → System fortsetter
4. Admin klikker "Lagre" → Server Action kaller capability tool `set_overtime_mode(profile_id, 'banked')`:
   - Verify profile i workspace (ADR-0151)
   - Assert `toil_agreement_signed_at IS NOT NULL`
   - UPDATE `employee_payroll_profile.overtime_mode='banked'`
   - Insert `change_proposal` row m/ resolution='accepted' (audit)
   - Emit `payroll.overtime_mode_changed` w/ before/after values
5. UI: toast "Overtime-modus oppdatert til Avspasering" + section refresh viser ny verdi

### Switch tilbake til "paid_out" (ingen blocker)

6. Admin endrer dropdown tilbake → klikker "Lagre" → tool kalles m/ 'paid_out' → ingen agreement-check (downgrade alltid OK) → emit + UI refresh

**Postcondition:**
- `employee_payroll_profile.overtime_mode` oppdatert
- `activity_trail` row m/ before/after + actor_id + workspace_id (ADR-0193)
- Calc-engine fra neste recalc bruker ny mode for OT-resolver: `paid_out` → tillegg som payroll-line, `banked` → TOIL accrual i timebank
- Tillegg (50%/100%) fortsatt synlig som `paid_out` line uavhengig av mode (ifm. spec §10.2)

## Error Paths

- **TOIL-avtale ikke signert:** Switch til banked blokkert (steg 3) → admin må sende avtale via DocuSeal → ansatt signerer → `toil_agreement_signed_at` populated → admin kan retry
- **Ikke-admin role:** Ikke-admin manager prøver å endre via chat → gateAction returnerer `denied: insufficient_authority` → tool returnerer error
- **Concurrent change:** Annen admin endrer samme profil simultant → optimistic-lock conflict → UI auto-refresh w/ toast "Verdi oppdatert av annen admin"
- **Channel violation:** Tool kalt fra voice-channel → ADR-0078 PII-block → "Lønnsdata er kun tilgjengelig via chat"

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manuelt: switch m/ ikke-signert avtale BLOCKED, m/ signert OK
- [ ] activity_trail audit-row finnes m/ før/etter values
- [ ] Calc-engine produserer ulik output for samme shift basert på mode
- [ ] gateAction (ADR-0204) blokker ikke-admin
- [ ] Tool chat-only (ADR-0078) — voice rejected

**Mark `status: verified` in frontmatter when all seven boxes are checked.**
