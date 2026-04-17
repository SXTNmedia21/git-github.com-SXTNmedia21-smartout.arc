---
title: "invoice.delivery_* DROP COLUMN Lifecycle Gate (ADR-0128 Amendment)"
id: ADR-0135
status: accepted
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-17
amends: ADR-0128
---

# ADR-0135: invoice.delivery_* DROP COLUMN Lifecycle Gate

## Context and Problem Statement

ADR-0128 spesifiserte deprecation-lifecycle for `invoice.delivery_channel`, `delivery_status`, `external_reference`: hard drop innen 2026-07-01 eller Fase 3-close. Council-review av Fase 3-spec avdekket en konkret gap i grep-gaten: Fase 2's `list_invoice_dispatches` AI-tool har en description-string som eksplisitt refererer `invoice.delivery_status` som fallback-kilde for gamle fakturaer (filepath: `packages/ai/src/capabilities/billing-query/tools.ts:203`). En naiv kode-grep ville misse dette fordi det er i en string literal, ikke i kode-logikk. Dette ADR-et spesifiserer grep-gaten presist.

## Decision Drivers

- **ADR-0128 etterlevelse:** hard drop må faktisk skje innen 2026-07-01.
- **AI-capability integritet:** LLM bruker tool-description som instruksjon. Refererer descriptionen en ikke-eksisterende kolonne → LLM hallusinerer + forvirrer sluttbruker.
- **Completeness av grep-gate:** Kode-grep som kun sjekker type-spørringer misser string-literals, kommentarer, dokumentasjon.
- **Fase 3A-close som backstop:** hvis Fase 3A utsettes utover 2026-07-01, frittstående hotfix-migration kreves.

## Considered Options

1. **Drop uten grep-gate** — stoler på typecheck. *(Avvist — stille regresjon hvis string literals refererer koloner.)*
2. **Kode-grep på .ts-filer kun** — dekker 90%, misser tool-descriptions. *(Avvist — spesifikt scenario fanget i council.)*
3. **Full grep-gate på `.ts | .tsx | .sql | .md` + eksplisitt auditliste av kjente referanser** — dekker alt, tvinger manuell dokumentering. *(Valgt.)*

## Decision Outcome

Chosen option: **"Full grep-gate + auditliste"**, fordi det gir deterministisk gating og fanger string-referanser som tool-descriptions.

**Grep-gate spesifikasjon (kjøres som del av Fase 3A B6 pre-flight):**

```bash
# Tre kolonner å droppe
PATTERNS='delivery_channel|delivery_status|external_reference'

# Scan applikasjonskode + dokumentasjon + migrations + AI-tool-strings
MATCHES=$(
  grep -rnE "$PATTERNS" \
    apps/ \
    packages/ \
    supabase/functions/ \
    supabase/migrations/ \
    2>/dev/null \
  | grep -v 'test' \
  | grep -v '.next' \
  | grep -v 'node_modules' \
)

# Akseptable treff (må fjernes eller migreres FØR DROP):
# - packages/ai/src/capabilities/billing-query/tools.ts (description string) → rewrite
# - supabase/functions/engine-dispatch/index.ts (B2 dual-write block) → delete
# - packages/billing/src/types.ts comment → update

# Utestengte treff (OK — dokumenterer history):
# - docs/**/HANDOFF-*.md
# - docs/decisions/0128-*.md
# - docs/superpowers/specs/*billing-engine-fase-2*.md
```

**Pre-flight kjøres som del av B1 — CI script under `supabase/tests/` kalt `billing-delivery-drop-readiness.sh`.** Exit 0 hvis alle ikke-dokumentasjon-treff er enten i migrasjoner (rydder opp B6) eller i dokumentert audit-liste. Exit 1 blokkerer B6.

**Kjente referanser ved council-tid (må adresseres i B6):**

| Fil | Type | Handling |
|-----|------|----------|
| `packages/ai/src/capabilities/billing-query/tools.ts:203` | Tool-description string | Erstatt "sjekk `invoice.delivery_status` for historikk" med "gamle fakturaer vises med full leveranse-historikk via `invoice_dispatch` fra 2026-05-XX" |
| `supabase/functions/engine-dispatch/index.ts:2532-2541` | Dual-write block (B2) | Slett helt |
| `packages/billing/src/types.ts:93` | Kommentar | Oppdater |
| `packages/billing/src/schemas.ts:115` | `UpdatePricingTermsInputSchema.delivery_channel` | **IKKE DROP** — lives på `pricing_term` table, ikke `invoice`. Skjema fortsetter. |

**DROP migration:**

```sql
-- YYYYMMDDHHMMSS_drop_invoice_delivery_columns.sql
BEGIN;
-- Pre-check: alle application-readere er migrert (script asserterer dette utenfor migrasjonen)
ALTER TABLE public.invoice DROP COLUMN delivery_channel;
ALTER TABLE public.invoice DROP COLUMN delivery_status;
ALTER TABLE public.invoice DROP COLUMN external_reference;
ALTER TABLE public.invoice DROP CONSTRAINT IF EXISTS invoice_delivery_channel_check;
COMMIT;
```

**Post-drop:**
- `pnpm --filter @smartout/supabase run db:types` regenererer `database.types.ts`
- `pnpm turbo typecheck` MÅ være grønn
- `pnpm --filter @smartout/billing test` + `pnpm --filter @smartout/ai test` MÅ være grønn

**Deadlines:**

- **Soft deadline:** Fase 3A-close (estimert 2026-06 slutten)
- **Hard deadline:** 2026-07-01 (ADR-0128 bindende)

Hvis Fase 3A slipper etter 2026-07-01: opprett separat `feat/billing-engine-fase-3a-hotfix-drop` branch med kun B6-migrasjon. Merg til development uavhengig av 3A's øvrige batcher.

## Rules & Consequences

- **Good, because** grep-gate fanger string-literal-referanser som kode-grep misser
- **Good, because** auditliste dokumenterer kjente treff så B6-agent ikke må re-oppdage
- **Good, because** hard deadline har backstop-plan
- **Bad, because** grep-gate på `.md` gir støy (dokumentasjon av history er OK) — audit-listen må være streng
- **Agent Impact:** B6-agent MÅ kjøre `billing-delivery-drop-readiness.sh` før DROP migration. Hvis scriptet feiler, stopp B6 og migrer referansene først. B1 må include dette scriptet. Etter DROP: PR-beskrivelse refererer dette ADR-et som grunnlag.

---

> Register in `docs/decisions/0000-decision-log.md` and update CLAUDE.md's ADR table. Cross-link from ADR-0128.
