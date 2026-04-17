---
title: "Billing Dispatch Rule 2-Level Evaluation with Suppress Semantics"
id: ADR-0127
status: proposed
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-17
---

# ADR-0127: Billing Dispatch Rule 2-Level Evaluation with Suppress Semantics

## Context and Problem Statement

Billing Fase 2 Spor A introduserer `billing_dispatch_rule` som styrer hvem som mottar hvilke fakturaer via hvilken kanal. Rader finnes på to nivåer: `workspace_id IS NULL` (platform-baseline, Smartout-eid) og `workspace_id = X` (workspace-eget tillegg). Ved faktura-utsendelse må systemet evaluere hvilke regler som faktisk gjelder — og workspaces må kunne *overstyre* eller *undertrykke* platform-defaults (eksempel: "ikke send kopi til Smartout for vår workspace"). Council-syntese flagget at rev 1's "UNION uten prioritet" mangler dedup-nøkkel og override-semantikk, noe som skaper footguns.

## Decision Drivers

- **Deterministisk evaluering:** Samme faktura + samme regel-konfig må produsere samme dispatch-sett hver gang (ADR-0119-inspirert reproducibility).
- **Workspace autonomi:** Workspace-admin må kunne disable platform-defaults de ikke ønsker — uten å påvirke andre workspaces.
- **jsonb equality gotcha:** `target` er jsonb; Postgres-equality uten key-ordering-normalisering vil feile på identisk innhold med forskjellig rekkefølge.
- **Audit-transparens:** En eksplisitt `suppress`-handling er sporbar i `billing_activity_log`; en *fraværende* regel er ikke.

## Considered Options

1. **UNION uten prioritet** — rev 1's forslag. Dedup på raw jsonb equality. *(Avvist — jsonb key-ordering bug + ingen override-mekanisme.)*
2. **Platform-override-by-absence** — workspace kan "slette" platform-regel ved å gjenta samme regel lokalt og sette is_enabled=false. *(Avvist — platform-regelen er ikke eid av workspace; misvisende semantikk.)*
3. **Explicit `action` enum med `suppress`** — workspace oppretter en regel med `action='suppress'` som matcher platform-regelens dedup-key. Platform-regelen droppes i evaluering. *(Valgt.)*

## Decision Outcome

Chosen option: **"Explicit `action` enum med `suppress`"**, fordi det gjør override eksplisitt, sporbar, og uavhengig av platform-regelens livssyklus.

**Evalueringsalgoritme (implementeres i B1 som Postgres-funksjon + @smartout/billing query helper):**

```
effective_rules(invoice) =
  1. platform_rules := SELECT * FROM billing_dispatch_rule
       WHERE workspace_id IS NULL
         AND is_enabled = TRUE
         AND trigger_event = invoice.trigger_event
         AND (company_id IS NULL)  -- platform rules are never company-scoped (CHECK constraint)

  2. workspace_rules := SELECT * FROM billing_dispatch_rule
       WHERE workspace_id = invoice.workspace_id
         AND is_enabled = TRUE
         AND trigger_event = invoice.trigger_event
         AND (company_id IS NULL OR company_id = invoice.company_id)

  3. dedup_key(rule) := canonical_json(rule.channel, rule.trigger_event, rule.target)
     -- canonical_json normaliserer nøkkel-rekkefølge i jsonb; implementeres via jsonb_strip_nulls + rekursiv key-sort

  4. suppressed_keys := { dedup_key(r) : r ∈ workspace_rules AND r.action = 'suppress' }

  5. platform_active := { r ∈ platform_rules : dedup_key(r) ∉ suppressed_keys }

  6. workspace_active := { r ∈ workspace_rules : r.action = 'send' }

  7. For regler med kolliderende dedup_key i platform_active + workspace_active:
       - workspace-regelens template_id + target (hvis overstyrt) vinner
       - platform-regelens forbli "logisk begravet" men telleres i audit
       - resultat: workspace-versjonen brukes

  8. RETURN platform_active ∪ workspace_active (deduplicated on dedup_key, workspace wins on collision)
```

**CHECK constraint på tabellen:**
```sql
CHECK (workspace_id IS NOT NULL OR (action = 'send' AND company_id IS NULL))
```
Platform-regler (workspace_id NULL) kan ikke være `suppress` og kan ikke være company-scoped.

**Dedup-nøkkel:** `canonical_json(channel || trigger_event || target)` — Postgres-funksjon som sorterer nøkler rekursivt i jsonb før hashing. Implementeres som PL/pgSQL `immutable` + brukes i indeksering.

**Audit:** Hver gang regel-evaluering kjøres for en faktura, emit `dispatch_rule evaluated` (logger-only, debug) med payload `{ invoice_id, platform_rule_count, workspace_rule_count, suppressed_count, final_dispatch_count }`. Essensielt for å debugge "hvorfor gikk ikke fakturaen til X?" i produksjon.

## Rules & Consequences

- **Good, because** override er eksplisitt + sporbar (`action='suppress'` rad eksisterer i DB og emitter audit-event)
- **Good, because** canonical_json løser jsonb key-ordering-bug på DB-nivå, ikke i applikasjonskode
- **Good, because** workspace-regler kan trygt ha samme `(channel, target)` som platform uten utilsiktet duplikering
- **Bad, because** 2 ekstra DB-funksjoner (canonical_json + effective_rules) å vedlikeholde
- **Bad, because** workspace-admin må forstå forskjellen mellom "legg til ny mottaker" og "undertrykk platform-default" — UI må guide dette tydelig (§3.6 i spec: 2 seksjoner i "Utsendelse"-fanen)
- **Agent Impact:** All dispatch-evaluering MÅ gå via `effective_rules(invoice)` funksjonen — ingen ad-hoc UNION-spørringer i Server Actions. B1 må inkludere pgTAP-test som asserter canonical_json korrekthet + suppress-semantikk.

---

> Register in `docs/decisions/0000-decision-log.md` and update CLAUDE.md's ADR table.
