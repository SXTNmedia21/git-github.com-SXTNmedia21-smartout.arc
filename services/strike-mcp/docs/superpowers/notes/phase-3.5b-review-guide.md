---
title: Phase 3.5b Review Guide — kjøring per entity
status: in_progress
created: 2026-04-08
updated: 2026-04-08
module: strike-mcp
tags: [phase-3.5b, review, guide]
---

# Phase 3.5b Review Guide

**Du kjører `scripts/review_mapping.ts` interaktivt per entity.** Script'et:

1. Leser `mappings/<entity>.json` (redacted sample values)
2. Leser `mappings/.local/<entity>.sidecar.json` (raw PII for å hjelpe beslutninger — lokalt bare, ikke git)
3. Leser `v3_schema.json` for å vite v3-kolonner
4. For mappings uten target_table: prompter deg til å velge blant 229 v3-tabeller
5. For hver field med `needs_review: true`: viser deg sample values + v3 column constraints, spør Accept/Skip/Rename/Drop
6. Skriver tilbake til `mappings/<entity>.json` etter hver field-beslutning (crash-safe)

## Total scope

**20 entities, ~520 review-beslutninger** (veldig grovt anslag — inkluderer alle fields på tvers)

## Anbefalt rekkefølge (start enkelt)

### 🟢 HIGH confidence match (6 entities) — start her

Disse har korrekt target_table allerede foreslått. Du bekrefter + reviewer fields.

```bash
pnpm tsx scripts/review_mapping.ts --entity=invitations      # 24 fields, 39 records — bekreft 1:1 match mot v3 invitation
pnpm tsx scripts/review_mapping.ts --entity=departments      # 27 fields, 79 records
pnpm tsx scripts/review_mapping.ts --entity=locations        # 29 fields, 217 records
pnpm tsx scripts/review_mapping.ts --entity=teams            # 30 fields, 187 records
pnpm tsx scripts/review_mapping.ts --entity=workspace        # 43 fields, 40 records — BIG ONE
pnpm tsx scripts/review_mapping.ts --entity=profiles         # 46 fields, 734 records — BIG ONE
```

**Tips:** Hvis mapping'en får LOW confidence eller wrong fuzzy match for target table: bruk CLI'en til å override ved å velge riktig tabell fra listen.

### 🟡 LOW confidence match (5 entities) — korriger target først

Auto_align foreslo feil v3-tabell for disse. Du må overstyre target_table.

```bash
# shifts: foreslått shift_note (feil). v3 har shift_schedule? shift? Velg via CLI.
pnpm tsx scripts/review_mapping.ts --entity=shifts           # 24 fields, 25,333 records

# handbooks: foreslått runbook (feil, runbook er ops incident response).
# v3 har antagelig ingen direkte handbook-tabell — decide: skip eller map til content?
pnpm tsx scripts/review_mapping.ts --entity=handbooks        # 45 fields, 26 records

# supplements: foreslått supplier (feil — supplier er vendor, supplement er salary add-on).
# v3 har antagelig en salary_rule eller compensation-tabell.
pnpm tsx scripts/review_mapping.ts --entity=supplements      # 33 fields, 117 records

# shift_templates: foreslått schedule_template (kanskje riktig?)
pnpm tsx scripts/review_mapping.ts --entity=shift_templates  # 11 fields, 75 records

# rule_templates: 0 records — attest empty og hopp videre
pnpm tsx scripts/review_mapping.ts --entity=rule_templates   # 0 fields, 0 records [EMPTY]
```

### 🔴 UNMATCHED (9 entities) — velg target manuelt eller drop

Auto_align fant ingen v3-tabell med navn-match. Du må velge, eller droppe entiteten.

```bash
# tasks: v3 har public.task eller public.schedule_task? Velg.
pnpm tsx scripts/review_mapping.ts --entity=tasks            # 47 fields, 373 records — BIG

# subtasks: fold into task.parent_id? (S4 council question). Sjekk først om v3 task har parent_task_id.
pnpm tsx scripts/review_mapping.ts --entity=subtasks         # 12 fields, 265 records

# users: council sa SKIP — ikke migrer auth.users. Marker som dropped.
pnpm tsx scripts/review_mapping.ts --entity=users            # 21 fields, 655 records

# training: v3 har training-modul? Eller går dette i handbook/content?
pnpm tsx scripts/review_mapping.ts --entity=training         # 23 fields, 706 records

# inventory: v3 har inventory? Ellers skip.
pnpm tsx scripts/review_mapping.ts --entity=inventory        # 8 fields, 32 records

# punchclock_rules: 128 records, real data. v3 har rule-tabell?
pnpm tsx scripts/review_mapping.ts --entity=punchclock_rules # 7 fields, 128 records

# timeperiod_rules: 148 records. Samme rule-tabell som punchclock?
pnpm tsx scripts/review_mapping.ts --entity=timeperiod_rules # 20 fields, 148 records

# salary_rules: 0 records — attest empty og hopp
pnpm tsx scripts/review_mapping.ts --entity=salary_rules     # 0 fields, 0 records [EMPTY]

# time_rules: 0 records — attest empty og hopp
pnpm tsx scripts/review_mapping.ts --entity=time_rules       # 0 fields, 0 records [EMPTY]
```

## Quick wins først

**3 empty entities** — ta disse først, 30 sekunder hver:

```bash
pnpm tsx scripts/review_mapping.ts --entity=rule_templates   # attest empty
pnpm tsx scripts/review_mapping.ts --entity=salary_rules     # attest empty
pnpm tsx scripts/review_mapping.ts --entity=time_rules       # attest empty
```

## Tid-anslag

- Empty entities (3): ~2 min totalt
- HIGH confidence (6): ~30-45 min (workspace + profiles er BIG)
- LOW confidence (5): ~30 min (mest target-table-valg)
- UNMATCHED (9): ~45-60 min
- **Total: 2-2.5 timer**

## Etter hver entity

Commit mapping-oppdateringen:

```bash
git add mappings/<entity>.json
git commit -m "review(mapping): phase 3.5b review complete for <entity>"
```

Eller vent og gjør én samlet commit på slutten.

## Når alt er ferdig

1. **Verifiser:** alle mappings har `target_table: <string>` (ikke null, ikke "__dropped__")
2. **Verifiser:** alle mappings har `needs_review: false` på mapping-nivå (attested) eller alle fields er `needs_review: false`
3. **Commit:** én samlet Round 2 commit
4. **Neste steg:** Phase 3.5c validation — kjør migrate_workspace + migrate_locations mot lokal Supabase, verifiser

## Hvis du sitter fast

- **"Hvilken v3-tabell?"** Jeg kan hjelpe deg slå opp i `v3_schema.json` via grep. Kall meg med entity-navn og jeg finner kandidater.
- **"Skal denne field migreres?"** Vis meg field-blokken fra CLI og jeg anbefaler accept/skip/rename.
- **"Fold subtasks into task?"** La meg sjekke om v3 task har parent_id kolonnen først.

## Sidecar PII

Raw samples i `mappings/.local/*.sidecar.json` er tilgjengelige for review_mapping.ts (script'et har lov til å lese dem — ikke auto_align). Du ser faktiske verdier som hjelper beslutninger, men de committes aldri til git.
