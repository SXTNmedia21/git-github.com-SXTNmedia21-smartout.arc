---
title: Contract Drafts Are Not Versions — Versioning Starts at Send
id: ADR-0082
status: accepted
layer: decision
created: 2026-04-08
updated: 2026-04-08
---

# ADR-0082: Contract Drafts Are Not Versions — Versioning Starts at Send

## Context and Problem Statement

Under brainstorm av contract composition engine (ADR-0076) foreslo vi at
admin skulle kunne "edit og re-send som ny versjon" (decision 4.4c). Dette
reiste et subtilt spørsmål: hvis admin edit'er et draft 5 ganger før hen
sender det, skal hver endring være en egen "versjon"?

Frontend Designer flagged dette i council runde 2: **draftendringer er ikke
versjoner**. Å modellere det sånn skaper version-number inflation der admin
signet "v5" når ansatt ikke har sett noen tidligere versjon. Versjoner bør
reflektere noe ansatt har sett og potensielt reagert på.

## Decision Drivers

- Versjonsnummer er en sosial kontrakt mellom admin og ansatt — "dette er
  versjon 2 fordi versjon 1 ble sendt, du så den, så ble den endret"
- Pre-send draft er admin sitt eget arbeidsdokument, ikke en juridisk
  artefakt
- Ansatt skal kunne stole på at "versjon N" er noe hen kan referere til
- Audit trail må skille mellom "admin endret draft" (ikke juridisk relevant)
  og "admin re-sendte etter endring" (juridisk relevant)
- `parent_contract_id` FK (fra 5.4) er for versjonering, ikke for draft-
  historikk

## Considered Options

1. **Hver admin-endring = ny versjon (autosaved)** — `employment_contract_v1`,
   `v2`, `v3` selv om ingen er sendt. Admin sin musebevegelse blir historie.
2. **Versjon starter ved første send** — alt før første `sent`-event er én
   mutable draft. Første send opprettsettes som versjon 1. Re-send etter
   edit = ny rad med parent_contract_id + versjon 2. Admin endringer før
   send er kun metadata på draft.
3. **Eksplisitt "Save as version" knapp** — admin velger når en versjon
   skal snapshotes. Mer kontroll men mer friksjon + mentalt overhead.

## Decision Outcome

Chosen option: **"Versjon starter ved første send"**.

### Rules

1. **Før første send:**
   - `employment_contract`-raden er mutable
   - Admin kan edit'e alle felt (position, hourly_rate, start_date, etc.)
   - Compliance-validering kjører live ved hver endring
   - Ingen versjonsnummer vises i UI
   - `parent_contract_id` er NULL
   - Telemetry: kun `contract.composed` når første send trigges, ikke per
     keystroke

2. **Ved første send:**
   - Atomic transition: status → `sent`
   - Fra nå av er dette offisielt "versjon 1"
   - UI begynner å vise "v1 — sendt 8. april 2026"
   - `framework_snapshot` locked in (immutable snapshot per ADR-0076)
   - DocuSeal-envelope opprettes og sendes

3. **Hvis admin vil edit'e etter send:**
   - Eksisterende rad kan IKKE mutes (juridisk bindende at det ble sendt)
   - Admin klikker "Endre kontrakt" → ny composition-wizard åpnes
   - Prefill fra eksisterende rad, men ny rad opprettes ved save
   - Ny rad får `parent_contract_id` = forrige rad sin `contract_id`
   - Forrige rad transitioneres til `cancelled` (status update), DocuSeal-
     envelope voides
   - Ved neste send blir dette "v2"

4. **Etter signing:**
   - `signed` er terminal — ingen videre endringer til den raden
   - Ny composition (f.eks. ny stilling 2 år senere) følger samme parent/
     child pattern og blir "v2" av en ny lineage, eller "ny kontrakt" i UI

### UI copy rules

- Pre-send: "Utkast" (ingen versjonsnummer)
- First-send: "v1 — sendt [dato]"
- Post-edit pre-second-send: "Utkast — basert på v1 sendt [dato]"
- Second send: "v2 — sendt [dato]"
- Ansatt ser kun sendte versjoner (aldri pre-send drafts)

### Idempotency

Send-endpoint må ha idempotency key (random UUID generert i frontend) for å
forhindre:
- Double-click på Send
- Network retry som re-trigger send
- Konkurrerende admin-sessions

```
POST /api/employment-contracts/[id]/send
Body: { idempotency_key: "uuid-v4" }
```

Server sjekker om send med samme idempotency_key allerede har kjørt (lagret
i contract_send_log table eller på employment_contract-raden selv).

## Rules & Consequences

- **Good, because** versjonsnummer matcher det ansatt faktisk ser og
  forholder seg til
- **Good, because** admin har full frihet til å edit'e draft uten audit-
  spam
- **Good, because** lineage via parent_contract_id blir ren (kun sendte
  versjoner har parent/child-relasjoner)
- **Good, because** matches mental model av "kontrakt = noe sendt til
  ansatt"
- **Bad, because** hvis admin jobber lenge på en draft og så mister state
  (browser-crash uten autosave), kan hen miste endringer
- **Bad, because** "ufullstendige" drafts kan bli glemt i DB (må være
  en cleanup-regel for drafts eldre enn X dager uten aktivitet)
- **Agent Impact:**
  - Botsson sin `checkContractStatus` tool returnerer "Utkast" for
    pre-send, "v1 sendt [dato]" etter send — naturlig å bruke i samtale
  - Botsson sin compose-flyt (`createEmployeeContract`) setter alltid
    `parent_contract_id = NULL` for første iterasjon
  - Hvis admin ber Botsson "endre kontrakten", må Botsson forstå at det er
    post-send og opprette ny rad med parent_contract_id
- **Forbidden:** auto-save som oppretter nye versjon-rader per endring.
  Auto-save (hvis implementert) skal oppdatere samme draft-rad.
- **Forbidden:** mutering av sendte rader. Etter `sent`-transition er raden
  immutable.

## References

- Council session 2026-04-07 runde 2
- ADR-0076 (Contract Composition as Cascade Derivation) — framework_snapshot
  er immutable ved sending
- Frontend Designer review runde 2: "drafts are not versions, versions begin
  at sent"
- Related: Decision 5.4 (parent/child FK for lineage)

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
