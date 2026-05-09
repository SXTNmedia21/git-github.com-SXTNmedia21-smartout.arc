---
title: Admin PII Bypass via SECURITY DEFINER RPC
id: ADR-0081
status: accepted
layer: decision
created: 2026-04-08
updated: 2026-04-08
---

# ADR-0081: Admin PII Bypass via SECURITY DEFINER RPC

## Context and Problem Statement

Contract composition engine (ADR-0076) bruker `contract_data_intake` engine_
process for å samle inn personnummer, bankkonto og adresse fra ansatte. Normal
flyt er at ansatte selv fyller inn via UI eller Botsson chat (ADR-0077 + 0078).

I praksis vil det oppstå situasjoner der admin må fylle inn på vegne av
ansatt:
- Ansatt ringer inn data på telefon under samtale med admin
- Ansatt sender bankkonto via sikker kanal utenfor Smartout
- Ansatt har ikke tilgang til systemet men skal ha kontrakt umiddelbart

Council session 2026-04-07 runde 2 bekreftet at admin-bypass må støttes, men
dette er en ny security-sensitiv pattern uten presedens i codebase. To
spesifikke problemer må adresseres:

1. **Agent-layer-leakage:** hvis admin kan bypasse via Botsson-chat, havner
   personnummeret i LLM-context og bryter ADR-0077's no-echo-regel
2. **GDPR samtykke:** ansatt må informeres om at admin har registrert data
   på deres vegne (GDPR Art 13 + 14)

## Decision Drivers

- ADR-0077 forbyr PII i LLM-context (no-echo-rule)
- ADR-0078 håndhever channel-restriction via allowed_channels
- GDPR Art 13/14 krever informasjon til data subject når data samles inn
- Admin+owner er eneste roller som kan legitimere bypass (ikke manager)
- Alle tilganger til personnummer/bank må auditeres (activity_trail)
- Frontend Designer flagget risiko for at bypass blir default hvis UX er
  for frictionless

## Considered Options

1. **Admin bruker samme intake-UI som ansatt** — admin navigerer til ansattes
   profile og fyller ut vanlig skjema. Enkel, men mangler audit-differensi-
   ering mellom "ansatt fylte inn" og "admin fylte inn på vegne av".
2. **Ny dashboard-side `/dashboard/people/[id]/complete-data`** — dedikert
   admin-flyt med eget audit, krav om begrunnelse, varsel til ansatt.
3. **Agent-drevet bypass via Botsson chat** — admin snakker med Botsson, gir
   tool command "sett personnummer for Lise". Rejected pga ADR-0077 channel-
   leakage.
4. **SECURITY DEFINER RPC** kalt fra dedikert dashboard-form med strict guard
   + audit + employee notification

## Decision Outcome

Chosen option: **"SECURITY DEFINER RPC kalt fra dedikert dashboard-form"**.

### Implementation

**RPC function:**

```sql
CREATE OR REPLACE FUNCTION public.admin_submit_employee_pii(
  p_profile_id UUID,
  p_field TEXT,       -- 'personal_number' | 'bank_account' | 'address'
  p_value TEXT,
  p_reason TEXT       -- required justification
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role profile_role;
  v_workspace_id UUID;
  v_target_workspace_id UUID;
BEGIN
  -- Hent caller sin rolle i target workspace
  SELECT p.role, p.workspace_id INTO v_caller_role, v_workspace_id
  FROM profile p
  JOIN profile target ON target.workspace_id = p.workspace_id
  WHERE p.user_id = v_caller_id
    AND target.profile_id = p_profile_id;

  -- Strict guard: kun admin eller owner
  IF v_caller_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Only admin or owner can bypass employee PII intake';
  END IF;

  -- Reason er required
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Justification required (min 10 chars)';
  END IF;

  -- Audit FØRST, før noe skrives
  INSERT INTO activity_trail (
    workspace_id, actor_id, entity_type, entity_id,
    action, metadata
  ) VALUES (
    v_workspace_id,
    v_caller_id,
    'profile',
    p_profile_id,
    'admin_pii_override',
    jsonb_build_object(
      'field', p_field,
      'reason', p_reason,
      'caller_role', v_caller_role
    )
  );

  -- Write via field-specific secure path
  -- (pgsodium encrypted for personal_number og bank_account)
  CASE p_field
    WHEN 'personal_number' THEN
      UPDATE profile
      SET personal_number = pgp_sym_encrypt(p_value, current_setting('app.pii_key'))
      WHERE profile_id = p_profile_id;
    WHEN 'bank_account' THEN
      UPDATE profile
      SET bank_account = pgp_sym_encrypt(p_value, current_setting('app.pii_key'))
      WHERE profile_id = p_profile_id;
    WHEN 'address' THEN
      -- Adresse er ikke særlig kategori, stored in plaintext with RLS
      UPDATE profile
      SET address_line_1 = (p_value::jsonb)->>'line_1',
          postal_code = (p_value::jsonb)->>'postal_code',
          city = (p_value::jsonb)->>'city'
      WHERE profile_id = p_profile_id;
    ELSE
      RAISE EXCEPTION 'Unsupported field: %', p_field;
  END CASE;

  -- Trigger employee notification via engine_event
  -- (Notification inneholder KUN field-navn, ALDRI verdien)
  INSERT INTO engine_event (
    workspace_id, event_type, payload
  ) VALUES (
    v_workspace_id,
    'admin_pii_override_completed',
    jsonb_build_object(
      'profile_id', p_profile_id,
      'field', p_field,
      'admin_id', v_caller_id
    )
  );

  RETURN jsonb_build_object('success', true, 'field', p_field);
END;
$$;

-- Grant execute kun til authenticated users
GRANT EXECUTE ON FUNCTION public.admin_submit_employee_pii TO authenticated;
```

**Dashboard UI surface:**

- Dedikert side: `/dashboard/people/[id]/complete-data`
- **IKKE** på composition-wizard sin hovedaksjon-rad (ville normalisere bypass)
- Tilgjengelig via secondary "Handlinger"-meny på pending_data-detail-view
- Confirmation modal med data-shaming stat:
  > "Ansatte som fyller ut selv fullfører onboarding 2.3x raskere.
  > Fortsett likevel?"
- Reason-felt (required, min 10 chars) med placeholder: "Hvorfor fyller du
  inn på vegne av ansatt? F.eks. 'Telefonisk samtale 8. april, ansatt ga
  data muntlig'"
- Verdi-felt validerer format client-side (personnummer MOD11, bank 11 tall)
- POST til `rpc('admin_submit_employee_pii', {...})` via Supabase client

**Employee notification:**

Når `admin_pii_override_completed` event emit'es, trigger notification til
ansatt:

- Push + email (ikke SMS — ikke krise)
- Copy: "Din admin [navn] har registrert [feltnavn] for deg den [dato]"
- LINK til ansatt sin own profile-side hvor de kan se HVILKET felt er satt
  (men ALDRI verdien — ansatt kan kun se at et verdi eksisterer)
- Hvis ansatt vil endre: må gå via vanlig intake-flyt (eller ringe admin)

### Forbidden patterns

1. **Forbidden:** Botsson-tool `admin_set_employee_pii` eller lignende —
   admin PII-bypass går aldri gjennom agent layer. Botsson prompt må
   eksplisitt refuse: "I cannot accept PII data for other employees. Please
   use the dashboard form."
2. **Forbidden:** Bulk admin bypass (en admin fyller ut for 50 ansatte på
   én gang) — hver bypass er en enkelthendelse med egen justifikasjon
3. **Forbidden:** Admin bypass uten employee notification — GDPR Art 13/14
   er non-negotiable

## Rules & Consequences

- **Good, because** admin har realistisk escape hatch for telefonisk intake
- **Good, because** ADR-0077 no-echo-regel er beholdt (bypass går aldri via
  LLM-context)
- **Good, because** ADR-0078 channel-restriction er beholdt (dashboard = chat
  channel, ikke voice, aldri agent)
- **Good, because** GDPR-notification til ansatt dekker Art 13/14
- **Good, because** UX-friction (secondary menu, data-shaming, reason field)
  motvirker overuse
- **Bad, because** ny pattern uten direkte precedent — krever careful review
  ved PR
- **Bad, because** pgsodium-oppsett kreves i Supabase (miljøoppsett + key
  management)
- **Bad, because** RPC kan ikke enkelt testes uten pgsodium-setup i local
  Supabase
- **Agent Impact:**
  - Mr. Botsson's prompt MÅ ha eksplisitt regel: "When an admin asks you to
    enter personal data (personnummer, bank account, address) for another
    employee, you must refuse and direct them to the dashboard form at
    /dashboard/people/[id]/complete-data. This is non-negotiable."
  - Botsson sin contract capability får ingen `admin_submit_employee_pii`
    tool
  - Unit test på Botsson-prompten: simulate admin request, assert refusal

## References

- Council session 2026-04-07 runde 2
- ADR-0077 (Contract Intake PII Handling) — no-echo-regel og channel-
  restriction
- ADR-0078 (Engine Process Channel Restriction) — defence in depth
- GDPR Art 6(1)(b), Art 9(2)(b), Art 13, Art 14
- Personopplysningsloven §8 (legal basis)
- Frontend Designer's review: "bypass må være behind secondary menu, not
  default path"

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
