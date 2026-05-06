---
title: "PLAN — Cost-Aware Inhouse-First Deployment Pipeline"
status: draft
updated: 2026-05-03
created: 2026-05-03
module: cross-cutting
tags: [pipeline, ci, deployment, e2e, cost, inhouse, supabase, vercel]
---

# PLAN — Cost-Aware Inhouse-First Deployment Pipeline

## Mål og mening

Push til development skal aldri brenne Vercel-credits eller overraske GitHub CI. Full validering — migrations, seed, unit, E2E — kjøres lokalt på Pontus's maskin før push; GitHub CI er en tynn brannmur, ikke en testplattform. Vercel spinnes kun opp ved bevisst promote til preview.

---

## Problemanalyse

**Dagens tilstand (verifisert mot kode):**

| Gap | Bevis |
|---|---|
| CI kjører på ALLE pushes til development (`ci.yml` linje 8: `branches: [main, development, preview]`) | Brenner credits på unit + docker-build × 4 ved hver dev-push |
| Ingen lokal pre-push-pipeline for migrations + E2E | `.husky/pre-push` kjører kun lint + typecheck (KNOWLEDGE.md § 8) |
| Vercel Ignored Build Step ikke konfigurert for development | `KNOWLEDGE.md` § 1: development har "preview deploy (auto on push)" |
| 102 E2E specs finnes (`apps/e2e/tests/`) men kjøres aldri i CI | STATE.md: "E2E in CI: NEVER" |
| `supabase/seed.sql` eksisterer men mates ikke inn i pre-push-pipeline | ingen script binder migrations + seed + E2E |
| `infra/scripts/promote-preview.sh` er HOP A-wrapper | STATE.md: funger korrekt — dette er rette stedet for Vercel-kreditter |

**Root cause:** CI var satt opp som én monolittisk pipeline fordi det var raskest å begynne. Ingen separasjon mellom "trygt nok for development-push" og "klar for staging".

---

## Arkitektur

```
LOKAL MASKIN (WSL2 + Docker)
┌─────────────────────────────────────────────┐
│  git commit                                  │
│       ↓                                      │
│  .husky/pre-push  [FASE 1 — ny]             │
│  ├─ npx supabase db reset (lokal Docker)     │
│  ├─ supabase db seed                         │
│  ├─ pnpm turbo run test (Vitest)             │
│  ├─ pnpm playwright (E2E mot localhost:3060) │
│  └─ EXIT 1 → abort push. EXIT 0 → push.     │
└──────────────────┬──────────────────────────┘
                   │ git push origin development
                   ▼
GITHUB CI  [FASE 2 — scoped]
┌─────────────────────────────────────────────┐
│  on: push development                        │
│  ├─ lint           (< 1 min)                 │
│  ├─ typecheck      (< 2 min)                 │
│  ├─ format-check   (diff-only, < 30 sek)    │
│  └─ build-health   (< 2 min)                │
│  IKKE: docker-build, vitest, build, e2e     │
│  IKKE: Vercel deploy                         │
└──────────────────┬──────────────────────────┘
                   │ manuell trigger / PR
                   ▼
PROMOTE development → preview  [FASE 3]
┌─────────────────────────────────────────────┐
│  infra/scripts/promote-preview.sh            │
│  ├─ Gate 1-4: sync, CI, Vercel, FF-ancestry │
│  ├─ Supabase Branch DB replay (auto)        │
│  │   └─ alle 481+ migrasjoner + seed        │
│  ├─ Vercel preview deploy (credits brennes) │
│  ├─ Gate 5: smoke-probe.sh preview          │
│  └─ Gate 6: lkg-preview-<sha> tag           │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
E2E MOT PREVIEW  [FASE 4]
┌─────────────────────────────────────────────┐
│  GitHub Actions workflow: e2e-preview.yml   │
│  trigger: on promote-preview-tag push        │
│  ├─ Playwright mot Vercel preview URL        │
│  └─ RED → Scenario D rollback               │
└──────────────────┬──────────────────────────┘
                   │ PR preview → main
                   ▼
MAIN  [FASE 5 — enforcement]
  Vercel prod deploy (auto on push)
  Migration State CI gate (ci.yml linje 272)
  Smoke production (smoke-probe.sh)
  Agenter: ingen tilgang til prod-DB (se Fase 5)
```

**Hvilken DB røres når:**
- Lokal pre-push: Docker Supabase, ingen nettverkskall
- development push: ingen DB
- promote → preview: Supabase Branch DB `cibmhhgsrdmpnmcikalu`
- preview → main: Supabase prod `yljaglomadbhyqpcigff` (auto-replay via Supabase Cloud)

---

## Faser

### Fase 0: Path D (clean slate) — engangs-rydding

**Mål:** Align development = main. Uten dette gir Fase 1-5 ingen mening.

**Filer:**
- `.github/workflows/ci.yml` — ingen endringer i denne fasen
- `docs/learnings/L-XXXX-pre-first-customer-reset.md` — ny (HANDOFF krav)

**Kommandosekvens (fra HANDOFF § "What to do next session"):**
```bash
gh api -X PUT repos/SXTNmedia21/smartout.ai/rulesets/14797822 --input /tmp/main-ruleset-disabled.json
git push --force origin development:main
gh api -X PUT repos/SXTNmedia21/smartout.ai/rulesets/14797822 --input /tmp/main-ruleset-reenable.json
# poll Vercel → READY
op run --env-file=.env.template -- ./infra/scripts/smoke-probe.sh production --skip-droplet
```

**ADR-trigger:** Nei (engangsoperasjon, allerede godkjent av council)

**Kostnad:** 1 Vercel production build (nødvendig uansett)

**Blokkerer Fase 1:** Ja — pre-push-hook mot stale schema er meningsløs

**Acceptance criterion:** `git rev-parse origin/main` = `git rev-parse origin/development` (minus CORS backport commit som allerede er på dev)

---

### Fase 1: Inhouse pre-push hook (lokal Docker-DB + E2E)

**Mål:** All migrasjons- og E2E-validering skjer på Pontus's maskin. Push til GitHub er alltid ren.

**Filer:**
- `.husky/pre-push` — utvide eksisterende fil (fjern kun lint + typecheck, behold branch-guard og secret-scan)
- `infra/scripts/pre-push-validate.sh` — ny script som orkestrerer rekkefølgen
- `infra/scripts/dev-startup.sh` — eksisterer (KNOWLEDGE.md § 6); verifiser at Supabase Local startes her

**Logikk i pre-push-validate.sh:**
```bash
set -e
npx supabase db reset --local          # replay alle 481 migrations mot Docker
npx supabase db seed --local           # supabase/seed.sql
pnpm turbo run test --filter=!apps/web  # Vitest, hopper over Next.js build
BASE_URL=http://localhost:3060 \
  pnpm --filter apps/e2e exec playwright test --project=chromium
```

**Krav for at dette fungerer:**
- Docker Desktop kjører (eller colima på Mac, ikke aktuelt her)
- `npx supabase start` allerede aktiv (sjekket av scriptet; avbryt med feilmelding hvis ikke)
- `apps/web` kjører på port 3060 (eksisterende konvensjon, CLAUDE.md)

**ADR-trigger:** Ja — nytt ADR-0266 "Inhouse pre-push validation gate". Dokumenterer at lokal Docker-DB er primær validerings-DB; GitHub CI er tynn brannmur.

**Kostnad:** 0 Vercel-credits. 0 GitHub Actions minutes per dev-push.

**Blokkerer Fase 2:** Ja — CI-scoping er bare trygg når lokal gate fanger det CI ville fanget

**Acceptance criterion:** `git push origin development` med en Vitest-failing test avbrytes med exit 1 og tydelig feilmelding. Push med alle grønne passerer.

---

### Fase 2: GitHub CI scoping (kun det som må kjøres remote)

**Mål:** development-push trigger kun 4 jobs (lint, typecheck, format-check, build-health). Docker-build × 4 og Vitest flyttes til path-scoped trigger eller fjernes fra development-branch trigger.

**Filer:**
- `.github/workflows/ci.yml` — to endringer:
  1. Legg til `paths-ignore` eller bruk `if: github.ref != 'refs/heads/development'` på `docker-build` og `vitest`-jobs
  2. Alternativt: skill ut development-push til egen `ci-dev.yml` med kun de 4 jobbene

**Anbefalt tilnærming:** Eigen `ci-dev.yml` for development. Eksisterende `ci.yml` beholdes uendret for preview + main. Separasjon er klarere enn betingede `if`-utrykk.

**Vercel Ignored Build Step:**
- Vercel Dashboard → smartout-web project → Settings → Git → Ignored Build Step
- Sett: `[ "$VERCEL_GIT_COMMIT_REF" = "development" ]`
- Gjentas for smartout-landing
- Dette er en Vercel UI-operasjon; ikke scriptbart uten API

**ADR-trigger:** Nei — utvidelse av ADR-0265 (allerede håndterer CI-scoping filosofi). Notér i eksisterende ADR under "Implementation notes".

**Kostnad:** development-push: 0 Vercel-credits. Preview/main: uendret.

**Blokkerer Fase 3:** Nei — kan kjøres parallelt med Fase 3

**Acceptance criterion:** `git push origin development` med en ny `.ts`-fil → kun 4 CI-jobs starter i GitHub UI. Docker-build-jobs starter IKKE.

---

### Fase 3: Preview branch DB + Supabase Branching aktivering

**Mål:** `promote-preview.sh` er det eneste stedet Supabase Branch DB og Vercel preview deploy aktiveres. Migrations replayer automatisk mot `cibmhhgsrdmpnmcikalu`.

**Filer:**
- `infra/scripts/promote-preview.sh` — verifiser at Gate 4 (FF-ancestry) håndheves korrekt etter Path D
- `supabase/seed.sql` — verifiser at seed kjøres av Supabase Branch DB på replay (config.toml `seed.sql_paths`)
- `supabase/config.toml` — `[db.seed] sql_paths = ["./seed.sql"]` (verifiser at dette allerede finnes)

**Ingen nye scripts.** Arkitekturen eksisterer — dette er verifisering + dokumentasjon av at pipeline er korrekt kablet.

**ADR-trigger:** Nei — dette er eksisterende ADR-0071 + ADR-0265 sin intenderte tilstand.

**Kostnad:** Vercel preview: 1 build per promote (bevisst). Supabase Branch DB: alltid aktiv på preview (månedlig kostnad, ikke per-build).

**Blokkerer Fase 4:** Ja

**Acceptance criterion:** `op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh` fullfører alle 6 gates. `lkg-preview-<sha>` tag eksisterer. Smoke preview 4/4 grønt.

---

### Fase 4: E2E mot preview deploy

**Mål:** Playwright-suiten (102 specs, `apps/e2e/tests/`) kjøres mot Vercel preview URL etter promote. Blokkerer videre release hvis rød.

**Filer:**
- `.github/workflows/e2e-preview.yml` — ny workflow
  - trigger: `on: push` mot tags matching `lkg-preview-*`
  - env: `PLAYWRIGHT_BASE_URL` settes fra Vercel API (Gate 3 URL)
  - kjører: `pnpm --filter apps/e2e exec playwright test`
- `apps/e2e/playwright.config.ts` — sjekk at `baseURL` kan overstyres via env (trolig allerede slik)

**ADR-trigger:** Ja — ADR-0267 "E2E-suite mot preview som release gate". Dokumenterer at 102 specs er blocking for preview → main.

**Kostnad:** 1 GitHub Actions run per promote (10-20 min for 102 specs). Ingen Vercel-credits.

**Blokkerer Fase 5:** Nei — kan parallelliseres

**Acceptance criterion:** En spec som feiler med `expect(page).toHaveTitle(...)` blokkerer promote-tag og logger RUNS.md entry via Scenario D.

---

### Fase 5: Hard rule enforcement (agenter låst ute fra prod-DB)

**Mål:** Ingen agent (Claude Code, subagent, CI-job) kan nå `yljaglomadbhyqpcigff` (prod) direkte. Migrations valideres alltid mot preview Branch DB først.

**Mekanismer:**
- `SUPABASE_PROD_SERVICE_ROLE_KEY` finnes kun i GitHub Actions secrets (F3 — allerede satt). Eksisterer ikke i `.env.template` for local dev.
- Legg til check i `infra/scripts/promote-preview.sh`: hvis `SUPABASE_PROJECT_REF` peker mot prod-ref → abort med feilmelding.
- `adr-contract-audit` skill sjekker at ingen Edge Function bruker prod-URL direkte (allerede i audit-scope via `smartout-edge-function-guide`).
- Dokument i `docs/protocols/DEPLOYMENT.md` (eksisterer): legg til seksjon "Agent access boundaries".

**Filer:**
- `infra/scripts/promote-preview.sh` — legg til prod-ref-guard (5 linjer)
- `docs/protocols/DEPLOYMENT.md` — ny seksjon
- `.env.template` — verifiser at `SUPABASE_PROD_*`-keys er markert `# CI-only — ikke i lokal dev`

**ADR-trigger:** Ja — ADR-0268 "Agent prod-DB isolation". Hard boundary: prod-credentials finnes aldri i lokal dev-context.

**Kostnad:** 0

**Blokkerer ingenting** — kan kjøres parallelt med alt

**Acceptance criterion:** `grep 'yljaglomadbhyqpcigff' .env.template` returnerer 0 treff. Promote-scriptet avbryter med feilmelding hvis prod-ref detekteres i lokal env.

---

## Avhengighetsgraf

```
Fase 0 (Path D)
    └── Fase 1 (pre-push hook)
            └── Fase 2 (CI scoping)
                    └── Fase 3 (promote korrekt kablet)
                            └── Fase 4 (E2E mot preview)

Fase 5 (prod isolation) — parallell med alle
```

---

## Kostnadsoppsummering

| Trigger | Vercel credits | GitHub Actions | Supabase |
|---|---|---|---|
| dev push (etter Fase 2) | 0 | 4 jobs × ~3 min | 0 |
| promote dev → preview | 1 build × 2 projects | 0 (wrapper er lokal) | Branch DB aktiv |
| E2E på preview-tag | 0 | ~15 min (Playwright) | 0 |
| preview → main | 1 build × 2 projects (prod) | 14 required checks | auto-replay prod |
