---
title: "Plan — Agent Harness installation on apps/admin (Erik portal)"
status: draft
updated: 2026-05-02
created: 2026-05-02
module: agent-harness
tags: [plan, admin-app, agent-harness, botsson, accountant, m9]
---

# Plan — Agent Harness installation on apps/admin

> Branch target: `campaign/order-system` → sub-sortie `feat/order-system-admin-agent-harness`
> Base reference: Platform Admin (`apps/web/src/app/platform-admin/layout.tsx`) — already wraps `BotssonProvider` + `BotssonShell` around its children. Same primitives ship to admin.

## Bunnsolid claim

`admin.smartout.ai` (apps/admin) er Eriks regnskapsfører-portal. Den har 8 ferdige skjermer (login → workspaces → orders → avstemming → historikk → konto) som er drevet av RLS via `billing.accountant_company_grant`. Vi skal nå hekte på samme Agent Harness som Platform Admin bruker — en `BotssonShell` overlay som lar Erik chatte og snakke med en agent som forstår avstemming-domenet, krysser bedriftsgrenser, og har tilgang til samme data Erik selv ser. Implementasjonen er hovedsakelig "kopier mønsteret fra platform-admin/layout.tsx", men med tre kjerne-tilpasninger som ikke kan unngås: cross-workspace auth, accountant-authority, og en spisset capability-meny.

## Tre ekstremt-viktige fakta (les disse først)

1. **Erik er IKKE en `profile`.** Han er en `auth.users`-rad med `billing.accountant_company_grant`-rader på tvers av N bedrifter. Eksisterende stage-engine kontrakt (`apps/web/src/app/api/botsson/chat/route.ts:RequestSchema`) krever `workspaceId: z.string().uuid()`. Det gjelder ikke Erik. Vi trenger en separert auth-modus eller en "meta-workspace"-marker for cross-tenant accountants. Dette er det ene reelle arkitektur-spørsmålet i hele installasjonen — alt annet er kopier-og-lim.

2. **`packages/ai/src/capabilities/billing-query` finnes allerede.** Erik trenger ikke en ny capability fra null. Existing billing-query må re-vurderes for accountant-context: hvilke verbene aksepterer cross-company aggregat? Hva må gates til `audit:'billing'`-events i telemetry-pipelinen som ADR-0264 nettopp aktiverte?

3. **Bug #4 må fikses før agent kan si "kjør avstemming for Villa Mat".** Sortie #18 (compute_period_aggregates schema-drift) er en hard prerequisite hvis Botsson skal kunne trigge en settlement run via `runSettlement` capability. Hvis Phase 2 (active capabilities) skal kjøres, må Sortie #18 lande først. Phase 1 (read-only chat + page tools) kan starte parallelt eller før.

## Les først, i denne rekkefølgen

1. `apps/web/src/app/platform-admin/layout.tsx` — 19 linjer. Kanonisk eksempel på Agent Harness wrap. Dette er det vi kloner.
2. `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` — context provider. Sjekk om props (`initialRank`, `initialPersona`, `initialBlend`) trenger admin-spesifikk tuning.
3. `apps/web/src/app/Botsson/_components/BotssonShell.tsx` — Orb + chat-overlay shell.
4. `apps/web/src/app/api/botsson/chat/route.ts` — BFF som proxier til stage-engine. **Kjernen i Phase 1**: vi må kopiere mønsteret hit MED tilpasning for accountant-auth (ingen workspace_id, men `accountantUserId` + `companyIds[]`).
5. `packages/ai/src/capabilities/billing-query/` (hele mappen) — eksisterende billing-capability. Hva den eksponerer, hva den gater på, hva som må endres for cross-company. Avgjør om vi extender denne, eller lager en ny `accountant-query` capability som komponerer over.
6. `apps/admin/src/lib/accountant.ts` — `requireAccountant()` returner `{ userId, companyIds }`. Dette er auth-pakken vi sender ned til stage-engine i stedet for `workspaceId`.

## Nøkkel-metafor

Det er ikke "installer en agent på admin" — det er "wire admin inn i samme harness som platform-admin allerede sitter i". Stage-engine (port 5010) er én delt motor; Platform Admin og admin.smartout.ai blir to seter i samme cockpit, hver med sin authority-profil og hver sin meny av capabilities. Vi flytter ingen ting i motoren — vi setter en ny stol foran den.

## Hard constraints

- **Ingen ny stage-engine deployment.** Bruker eksisterende på port 5010. Hvis admin trenger andre routes, legg til i stage-engine, ikke en ny service.
- **Ingen ny database-schema for chat/sessions.** `engine_sessions` + `engine_memory` finnes. Accountant-sesjoner lagres der, med `actor_kind: 'accountant'` (eller lignende — settes i Phase 1 design-decision) i stedet for `profile_id`.
- **Authority-konfig MÅ gates i Phase 2 (capabilities som muterer).** Phase 1 er read-only — Erik kan spørre, ikke handle. ADR-0238/0240 frozen-4 boundaries respekteres.
- **Telemetry routes til `billing_activity_log` for accountant-events**, ikke `activity_trail` (som forutsetter workspace_id). Dette er ADR-0262 Amendment 1 + ADR-0264 territory — ikke nye ADRer trengs.
- **Voice = forbidden i Phase 1.** ADR-0078 (kanal-restriksjoner for PII). Avstemming-data inneholder fakturabeløp + kunde-info — chat kun. Voice kan vurderes i Phase 3 etter PII-classifier-jobb.

## Phase plan

### Phase 1 — Read-only chat overlay (mock-driven, no stage-engine bridge)

**Goal:** Erik ser Botsson Orb i nederste hjørne på alle admin-sider. Klikker → chat-overlay åpnes. Skriver "hva er utestående beløp for Villa Mat?" → får et hardkodet svar. Visuell paritet med platform-admin.

**Sortie:** `feat/order-system-admin-harness-shell-only`

**Steg:**

1. Kopier `apps/web/src/app/platform-admin/layout.tsx` 19-linjers mønster til `apps/admin/src/app/(admin)/layout.tsx` (eksisterende layout har bare sidebar + main). Wrap med `BotssonProvider` + `BotssonShell` rundt children.
2. `BotssonProvider` props for accountant: `initialRank="accountant"` (ny rank — ADR-pliktig hvis ikke finnes), `initialPersona="erik"` eller `"avstemmer"` (egen persona), `initialBlend=10`.
3. Stub BFF route på `apps/admin/src/app/api/botsson/chat/route.ts` som returnerer hardkodet "Hei Erik, jeg fungerer ikke ennå — Phase 2 kommer." — ingen stage-engine-call.
4. Verifiser via Playwright headless: navigate til /workspaces → assert orb visible → click → assert chat-overlay opens → type message → assert mock response.

**Falsifiable acceptance:**

- [ ] Orb synlig nede høyre på alle 5 admin-sider (workspaces, orders, avstemming/run, avstemming/historikk, account).
- [ ] Klikk på orb åpner chat-overlay (ingen 500, ingen 404 i admin-log).
- [ ] Stubbed BFF returnerer 200 med deterministisk mock-response.
- [ ] Eksisterende admin-flow uberørt — Erik kan fortsatt logge inn, se kartotek, åpne avstemming-form.
- [ ] `pnpm --filter admin typecheck` 0 errors.

**Estimat:** 4-6 timer. Mest CSS/positioning-justering hvis BotssonShell er hardkodet for /dashboard-layoutet.

### Phase 2 — Live stage-engine bridge (auth + read-only capabilities)

**Goal:** Erik chatter via stage-engine. Engine svarer ved å kalle `billing-query` capability. Cross-company queries fungerer ("hvor mange fakturaer er forfalt på tvers av alle bedrifter?").

**Sortie:** `feat/order-system-admin-harness-bridge` (etter Phase 1 ferdig)

**Steg:**

1. **ADR-draft:** "Accountant-context for Agent Harness". Definerer `actor_kind: 'accountant'` i engine_sessions, `accountant_user_id + company_ids[]` i stedet for `workspace_id`, RLS-strategi for engine_memory cross-company. Dette er den ene reelle arkitektur-beslutningen — kan komme før eller parallelt med implementasjon.
2. Endre admin BFF (`apps/admin/src/app/api/botsson/chat/route.ts`) til å proxie til stage-engine `/agent/chat` med ny payload-shape: `{ accountantUserId, companyIds, userMessage, sessionId, pageContext }`.
3. Stage-engine: `/agent/chat` route-utvidelse til å akseptere accountant-payload (ny zod-schema). RLS-context i sessions-write bruker accountant_user_id i stedet for profile_id.
4. Capability tilpasning: `billing-query` får en ny verb `accountant_aggregate(company_ids[])` som returnerer cross-company aggregert data via `billing.compute_period_aggregates` (etter Bug #4 er fikset) eller direkte SQL.
5. Authority-config: seed `engine_authority_config` med en `accountant`-rolle som har read-only access til billing-capabilities. ALLEREDE GJORT-PATTERN finnes for andre roller.
6. Telemetry: hver agent-call emitter `accountant.* `-events med `audit: 'billing'` + `company_ids[]` i payload (ADR-0264 fan-out path). Verifiser i live walkthrough.

**Falsifiable acceptance:**

- [ ] Erik chatter "vis utestående for Villa Mat" → stage-engine session opprettes → billing-query kalles → svar viser ekte tall.
- [ ] Ny `engine_sessions`-rad har `actor_kind = 'accountant'` (eller equivalent design).
- [ ] `billing_activity_log` får N rows for capability-call (én per company_id i context).
- [ ] Authority gate avviser mutation-attempts ("kjør avstemming") med klar feilmelding.
- [ ] `pnpm --filter admin typecheck && pnpm --filter @smartout/stage-engine typecheck` begge 0 errors.

**Estimat:** 1-2 dager. Avhenger av om accountant-context-ADR krever council eller bare draft + accept.

### Phase 3 — Active capabilities (mutation gates + voice if PII allows)

**Goal:** Erik kan si "kjør avstemming for april for alle bedrifter" og Botsson trigger faktisk `runSettlement` via authority-gate.

**Forutsetninger:**

- Sortie #18 (Bug #4) ferdig — settlement run må fungere live først.
- Phase 2 ferdig + stable.
- Authority-konfig oppdatert med `runSettlement` capability for accountant-rolle (write-gate).
- ADR for "agent-triggered settlement" — bekreft at audit-spor er identisk med UI-trigger (Bokføringsloven-implikasjon).

**Sortie:** `feat/order-system-admin-harness-active`

**Steg:**

1. Gate `runSettlement` Server Action via dual-path: UI-click eller agent-tool-call. Begge må passere `requireAccountant()` + RLS.
2. Capability `runSettlement` i `packages/ai/src/capabilities/billing-query` — kaller samme Server Action.
3. Authority gate: krev eksplisitt confirm-dialog for mutation. Erik må trykke "Bekreft" — ikke ren tekst-instruksjon.
4. Voice: hvis PII-classifier-jobb er ferdig (separat track), åpne voice-kanal med whitelist på spesifikke verbene. Default forbidden — ADR-0078 holder.

**Falsifiable acceptance:**

- [ ] Erik sier "kjør avstemming for april" → confirm-dialog → trykk → run starter → run-detail-page viser 4 artefakter.
- [ ] Audit-spor identisk med UI-trigger.
- [ ] Voice-attempt for PII-relevante verb returnerer "kun chat" feilmelding.
- [ ] Update Erik onboarding (`apps/e2e/onboarding/erik/ONBOARDING.md`) med ny seksjon "Botsson — din assistent".

**Estimat:** 3-5 dager. Mest authority + confirm-dialog + voice-arbeid.

## Out of scope (denne planen)

- Voice (Phase 3 only, conditional på PII-classifier).
- Custom Erik-persona-stemme/avatar.
- Multi-language (Erik = norsk only i Phase 1-3).
- Mobile admin (apps/admin er web-only per nå).
- Cross-tenant memory-deling (Erik's memory om bedrift A skal ikke lekke til bedrift B — design valg i Phase 2 ADR).

## Risiko-register

| Risiko | Sannsynlighet | Mitigasjon |
|---|---|---|
| Stage-engine accountant-payload-utvidelse bryter eksisterende workspace-baserte calls | Medium | Diskriminert union i zod-schema. Legacy path uberørt. |
| `engine_memory` RLS-design lekker cross-company data | Høy hvis ikke design-fokusert | ADR i Phase 2. Cross-company memory må enten dedupe per company_id eller eksistere som separat tabell. |
| Botsson Orb CSS-konflikt med admin-layout | Lav-medium | Phase 1 visuell test catcher dette tidlig. |
| `billing-query` capability schema-drift på linje med Bug #4 | Medium | Lazy: vent med å skru på til Sortie #18 har bekreftet at `compute_period_aggregates` faktisk fungerer. |
| ADR-0264 fan-out path ikke testet i agent-context | Medium | Phase 2 acceptance #3 verifiserer eksplisitt i live walkthrough. |

## Mantra

Vi installerer ikke en ny agent. Vi flytter på et nytt sete foran motoren som allerede kjører. Erik får sin egen utsikt — capabilities, authority, persona — men motoren er den samme. Hvis vi tilpasser motoren mer enn vi må, er vi på feil vei.
