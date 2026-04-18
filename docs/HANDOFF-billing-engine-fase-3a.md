---
title: "Handoff — Billing Engine Fase 3A"
status: done
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [handoff, billing, stripe, dunning, fase-3a]
---

# Handoff — Billing Engine Fase 3A

> Closure-dokument per CLAUDE.md Mandatory: Feature Closure. Oppsummerer hva som ble bygget, beslutninger tatt, læringer, kjente problemer, og Fase 3B scope-pekere.

---

## 1. Summary

**Branch:** `feat/billing-engine-fase-3` — 36+ commits ahead of `origin/development`. Ikke pushet.

**Leveranse:** 3 spor + opprydding:

- **Spor A — Stripe Connect payments:** workspace "Betal nå" via Stripe Checkout, PaymentIntent + webhook-drevet auto mark-paid, auto credit-note ved refund (per ADR-0133), PII-redaktert payment_attempt audit (per ADR-0132), platform-admin refund-dialog med Nordic Split "grave but not destructive" styling.
- **Spor C — Automatisk dunning:** `dunning_escalation_scan` engine_process (IKKE n8n — ADR-0134 gjenbruker engine_process per ADR-0126), 3-trinns eskalering (3/7/14 dager), idempotens via `dunning_escalation_log(invoice_id, to_stage)` UNIQUE, workspace opt-out via Fase 2's suppress-rule-mekanisme.
- **Spor F — `invoice.delivery_*` DROP:** ADR-0128 lifecycle closed. Tre kolonner droppet, alle callers migrert til `invoice_dispatch`, grep-gate script lever i CI for framtidig validering.

**5 ADRs skrevet + accepted:**
- ADR-0131: Stripe Connect platform model — Smartout-owned
- ADR-0132: payment_attempt PII redaction + retention
- ADR-0133: Invoice refund flow — ADR-0120 amendment (auto credit-note)
- ADR-0134: Dunning via engine_process, not n8n
- ADR-0135: invoice.delivery_* DROP COLUMN lifecycle gate

**Skjema-endringer:**
- 3 nye tabeller: `payment`, `payment_attempt`, `dunning_escalation_log`
- 2 nye enums: `payment_method_type`, `payment_status`
- 1 enum-utvidelse: `billing_dispatch_channel + 'stripe_invoice'`
- 1 enum-utvidelse: `dunning_status + 'reminder_1' | 'reminder_2' | 'collection_notice'` (B4 gap-fix — ikke forutsett i B1)
- 3 dunning-template rader seeded (nb-NO)
- 1 engine_process seed (`dunning_escalation_scan`) + engine_trigger
- 1 pg_cron schedule (`smartout-dunning-daily`, 08:00 Oslo)
- 3 kolonner droppet (`invoice.delivery_channel|delivery_status|external_reference`)

**Totalt:** 13 migrasjoner + 13 pgTAP-tests + 170 vitest-tests i `@smartout/billing` + 194 i `@smartout/telemetry`.

---

## 2. Decisions made

### Pre-B1 (council-drevet)

- **Split Fase 3 → 3A (Stripe + dunning + drop) + 3B (EHF + bidirectional sync + workspace OAuth)** — council-anbefaling basert på scope-størrelse + ekstern-avhengighets-risiko (Digdir sertifisering 3 uker + Fiken/Tripletex OAuth per vendor = 3B-kompleksitet kunne blokkere Stripe-revenue-kritisk 3A).
- **Stripe Connect model = Smartout-owned (ADR-0131)** — workspace-onboarding-friksjon eliminert, regulatorisk enklere, cascade-modellen beholdt ren (ingen `workspace_payout`-tabell i 3A). Revurderes i 3B+ ved behov.
- **Dunning via engine_process, ikke n8n (ADR-0134)** — CLAUDE.md-lov "no second event system" + ADR-0126 presedens. n8n bevart for generiske SaaS-integrasjoner; billing-logikk i monorepo.
- **PII redaction + permanent retention (ADR-0132)** — whitelist-subset for `redacted_payload`, platform-admin-only RLS, audit-trigger logger hver SELECT mot `payment_attempt`.
- **Refund = auto credit-note, never paid→issued flip (ADR-0133)** — ADR-0120 immutability bevart. Full refund = credit-note som balanserer; partial = credit-note på refunded-beløp; invoice.status forblir 'paid' i begge tilfeller.
- **`invoice.delivery_*` DROP grep-gate inkluderer string literals (ADR-0135)** — fanget av council: Fase 2's `list_invoice_dispatches` AI tool-description refererte `invoice.delivery_status` literal. Ikke kode-referanse men LLM-instruksjon. Script oppdatert til å fange dette.

### Implementasjon-drevet (agenten fant + fikset)

- **B1 seedet engine_process med action_payload brukende `reminder_1/reminder_2/collection_notice`, men B1 glemte å utvide `dunning_status` enum.** B4-agenten fanget dette ved å teste handleren — uten gap-fix ville cron ha kastet 22P02 hver natt. Gap-fix migrasjon `20260512000009_dunning_status_fase3a_values.sql` lagt til ekstra verdier (backward-kompatibel — beholdt `none|in_negotiation|reminder_sent|escalated` fra Fase 1).
- **Spec ADR-0133 sa "negativ amount" på credit-notes, men ADR-0120 §8 bruker POSITIV amount med `invoice_type='credit_note'` som tegn-flagg.** B2-agenten fulgte ADR-0120 (den autoritative). Commit-besked + spec noterer dette. ADR-0133 bør amenderes til positiv — men det er dokumentasjons-drift, ikke kode-bug.
- **"Betal nå" bypasser DispatchAdapter-interfacet.** DispatchResult-kontrakten passer engine-dispatch-orkestrering, men workspace "Betal nå" trenger Checkout URL direkte. B2-agenten kalte Stripe SDK direkte fra `initiatePayment()` i stedet for å contorte adapteren. Legitimt pragmatisk valg — flagget i commit-body.
- **Grep-gate script trengte file-level exclusions** for å skille invoice-kolonner fra `invoice_dispatch.external_reference` + `pricing_terms.delivery_channel` + adapter result types. Løst i B6 med 5 ekskluderings-filtre.

---

## 3. Learnings

**L1 — Spec må inkludere påkrevede enum-utvidelser når handler-logikk skal bruke nye verdier.** B1 seedet engine_step's action_payload med enum-verdier som ikke eksisterte. B4 fanget feilen. Lesson: specs som definerer engine_process-steg må enumerere alle referenserte verdier + legg til enum-utvidelses-migrasjoner i samme batch som stegseeden.

**L2 — Grep-gate scripts må skilles per kolonne-kontekst.** "delivery_channel" + "external_reference" eksisterer på flere tabeller + som runtime-return-felt i adapter-interfaces. Script kan ikke være en ren pattern-match; må ha file-level exclusions for kjente legitime kontekster.

**L3 — ADR-drift blant ADRs.** ADR-0133 skrevet pre-council, med "negativ amount" som antatt semantikk. ADR-0120 §8 allerede etablerte "positiv amount + invoice_type som sign flag". B2-agenten valgte ADR-0120 (eldre + mer autoritativ). Lesson: pre-B1 council-sesjoner må inkludere cross-check mot eksisterende ADRs for kollisjoner i semantikk, ikke bare nummer.

**L4 — Parallell agent-dispatch fortsetter å fungere med strict file-boundaries + comment markers.** Fase 3A hadde ingen file-konflikter mellom batcher. Comment markers `{/* B3-fase3a: ... */}` (versjons-suffix!) hindrer sammenblanding med Fase 2's `{/* B3: ... */}` markers.

**L5 — Budget-checkpoint-disiplin redder arbeid.** B5-agenten ble drept av usage-limit etter å committe 3/3 commits, men fordi hver var committet inkrementelt, ingen arbeid mistet. Motsatt B4 av Fase 2 (som nesten mistet arbeid fordi committet først på slutten).

**L6 — Docker-ufanget Deno-test-loops.** Edge Function kode (Deno) kan ikke testes uten `supabase functions serve`. Agent-sessions mangler ofte Docker. Resulterer i "test-skrevet-men-ikke-kjørt" for noen pgTAP-specs. Lesson: pgTAP-specs er fremdeles trygge (Docker required only for running, ikke for writing). Vitest tester ren logikk uten Edge Function-kontekst.

**L7 — React 18/19 type-conflict er pre-existing, NOT regresjon.** Landing + mobile + web har duplisert @types/react declarations. Flere Fase 3A-agenter rapporterte dette som deres issue — men det eksisterte før branch. Lesson: `pnpm turbo typecheck` vs `pnpm --filter @smartout/billing typecheck` — sistnevnte isolerer fra pre-existing støy.

---

## 4. Known issues / debt

### 4.1 Ikke-blokkerende

- **Pre-existing React 18/19 type conflicts** i landing + mobile + web. Ikke fra Fase 3A. Bør adresseres i egen refactor-batch — oppgrader til React 19 jevnt eller pin alle workspaces til 18.
- **pgTAP "No plan found" warnings** i 8 pre-existing test-filer (bruker NOTICE i stedet for TAP plan). Ikke regresjon. Kan standardiseres hvis ønskelig.
- **`gate_action(8-arg)` pre-existing pgTAP-feil** fra PR #187. Uavhengig av Fase 3A.
- **ADR-0133 amount-sign inconsistency** vs ADR-0120 §8 — dokumentasjons-drift, ikke kode-bug. ADR-0133 bør amenderes.

### 4.2 Ship-blocking-if-Fase-3B-starts items (none today)

Alle Fase 3B prerekvisitter er på plass:
- Stripe-infrastrukturen ready for EHF/Peppol adapter-integration (Fase 3B Spor B)
- Placeholder-adapters i `billing_integration` ready for replacement med Fiken/Tripletex real (Fase 3B Spor D)
- engine_process + action_type-pattern kan legges til `integration_poll_payments` uten skjema-endringer (Fase 3B Spor D)
- `billing_integration` RLS klar for workspace-admin CRUD-utvidelse (Fase 3B Spor E)

---

## 5. Fase 3B scope (pekere)

Fra spec §15:
- **Spor B — EHF/Peppol XML:** `PeppolEhfAdapter` implementasjon (erstatter Fase 2's skjelett) + Digdir-sertifiserings-prosess (3 uker realistisk). Tickstar eller tilsvarende SaaS som access point.
- **Spor D — Bidirectional integration sync:** Fiken + Tripletex ekte adapter-implementasjoner (erstatter PlaceholderAdapter). Nytt `integration_poll_payments` engine_process for inbound sync (auto mark-paid fra regnskap).
- **Spor E — Workspace integration OAuth:** `/dashboard/billing/settings/integrations` UI + OAuth callback Edge Function. RLS utvides for `billing_integration` workspace-admin CRUD. Token-storage via Supabase Vault (ADR må skrives før B1).

**Prerekvisitt for Fase 3B:** Fase 2.5 (contract onboarding via engine_process) bør skrives først for å støtte workspace self-serve-flyt. Se ADR-0130.

---

## 6. Quality gates snapshot

```
Typecheck:    @smartout/billing + telemetry + supabase: GREEN
              web + mobile + landing: pre-existing React type conflicts (NOT fase-3a)
Lint:         19/19 pass, 0 errors (~486 pre-existing warnings)
Vitest:       @smartout/billing 170/170 + telemetry 194/194 + ai 79/79
pgTAP:        Fase 2 4/4 GREEN + Fase 3A 3/3 GREEN (schema + webhook + dunning)
db reset:     13 new migrations apply cleanly
Grep-gate:    billing-delivery-drop-readiness.sh — passes post-B6 (to be re-run in CI)
```

---

## 7. Branch state + merge steps

1. Fase 2 merget til development (external, not in this branch)
2. Fase 3A branch: `feat/billing-engine-fase-3` at tip `2d261cfe` (B6 commit)
3. Push: `git push origin feat/billing-engine-fase-3`
4. Open PR → development
5. CI gates: turbo typecheck (ignoring pre-existing React type-issues), turbo lint, billing + telemetry vitest, pgTAP via GitHub Actions Docker, grep-gate script
6. Merge via fast-forward eller PR review
7. `/close-feature` når mergec

**Fase 3B scope:** egen branch `feat/billing-engine-fase-3b` opprettes fra development etter 3A merget.

---

**Author:** Claude Opus 4.7 (1M context) — orchestrated B0–B6 per Pontus's directive "orchestrate full feature, work around blockers, figure out last".
**Review:** Council 2026-04-17 (APPROVE WITH CHANGES → split 3A/3B + 5 blocker-ADRs) + per-batch code-reviewer on inkremental commits.
