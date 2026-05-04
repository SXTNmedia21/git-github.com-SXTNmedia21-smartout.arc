---
title: "Smartout Development Smoketest Playbook"
status: canonical
updated: 2026-05-02
created: 2026-05-02
module: ops
tags: [smoketest, qa, manual-test, development]
---

# Smartout Development Smoketest

End-to-end manual checklist for verifying every page and feature on `localhost:3060` before promoting to preview.

> Run against `development` branch in main repo. ~45–90 min for full pass. Use the result tracker at the bottom — fill `pass/fail/note` per row.

---

## 0. Pre-flight

| Check | Command | Expected |
|---|---|---|
| Docker stack | `docker ps --format "{{.Names}}\t{{.Status}}"` | `infra-stage-engine-1`, `infra-shift-mcp-1`, `infra-contract-service-1`, `infra-scrapling-1`, `infra-n8n-1`, `infra-caddy-1`, `infra-voice-agent-1` ALL `Up (healthy)` (voice-agent has no healthcheck — just `Up`) |
| Supabase Local | `docker ps \| grep supabase_` | All `supabase_*_smartout.ai` containers up |
| Edge runtime mount | `docker inspect supabase_edge_runtime_smartout.ai --format '{{range .Mounts}}{{.Destination}}{{println}}{{end}}' \| grep functions` | Should point to `/home/sxtnl/dev/smartout.ai/supabase/functions` (NOT a wt-N path) |
| Web dev server | `curl -I http://localhost:3060` | 200 or 307 (redirect to login) |
| Landing | `curl -I http://localhost:3055` | 200 |
| Edge function reachable | `curl -X POST -H "Content-Type: application/json" -d '{}' http://localhost:54321/functions/v1/livekit-token` | `{"msg":"Error: Missing authorization header"}` (NOT `BOOT_ERROR`) |
| Voice-agent registered | `docker logs infra-voice-agent-1 \| tail -3` | `registered worker` line + `job runner initialized` |

If any pre-flight fails: **STOP** and fix before continuing.

---

## 1. Test users

All users in workspace `b0000000-0000-0000-0000-000000000000` (slug: `hq-workspace`).

Default password (seed): check `supabase/seed.sql` or use magic-link flow. Standard local dev: `password123` (verify with team).

| Email | Display name | Role | Status | Use for |
|---|---|---|---|---|
| `admin@smartout.local` | Local Admin | owner | active | Admin paths, full feature surface |
| `erik@smartout.local` | Erik Pedersen | manager | active | Manager-level features, signed contract |
| `anna@smartout.local` | Anna Olsen | employee | active | Employee day-control |
| `kari@smartout.local` | Kari Nilsen | employee | trainee | Onboarding, training paths |
| `jonas@smartout.local` | Jonas Bakken | employee | trainee | Second trainee for parallel tests |
| `lise@smartout.local` | Lise Markussen | employee | inactive | Inactive-state guard tests |

Login: `http://localhost:3060/login`

---

## 2. Authentication flow

| # | Step | Role | URL | Expected |
|---|---|---|---|---|
| 2.1 | Login form renders | — | `/login` | Email + password fields, "Glemt passord?" link |
| 2.2 | Wrong password | — | `/login` | Error toast "Ugyldig e-post eller passord" |
| 2.3 | Login as admin | admin | `/login` → submit | Redirect to `/dashboard` (or workspace selector if multi-WS) |
| 2.4 | Magic-link flow | — | `/login` → magic link tab | Inbucket inbox at `http://localhost:54324` shows email |
| 2.5 | Reset password | — | `/reset-password` | Form renders + email captured |
| 2.6 | Logout | any | dashboard menu → Logg ut | Redirect to `/login` |
| 2.7 | Access denied | unauth | navigate `/dashboard` | Redirect to `/login` |

---

## 3. Onboarding & wizard (admin)

| # | Step | URL | Expected |
|---|---|---|---|
| 3.1 | Wizard reachable | `/onboarding` | 10 sections shell + BotssonAvatar |
| 3.2 | Step navigation | wizard | Each section advances + scroll-progress works |
| 3.3 | Botsson chat in wizard | wizard | Type message in domain-chat → response from `/api/botsson/chat` (NOT Orb — Orb should suppress per ADR-0238) |
| 3.4 | Save draft | wizard | Refresh — data persists |

---

## 4. Dashboard — admin paths

Login as `admin@smartout.local`. Run each row top-to-bottom.

### 4.1 Core navigation

| URL | Expected |
|---|---|
| `/dashboard` | Main shell, no console errors. Day-control or interactive dashboard |
| `/dashboard/people` | Lista 9 profiler (Anna, Erik, Lise, Ole, Kari, Jon, Sara, Jonas, Silje + Local Admin). Inviter-knapp synlig |
| `/dashboard/schedule` | Vaktplan-rutenett. ~76 seed-shifts mai 2026 |
| `/dashboard/operations` | Live operations / day-control |
| `/dashboard/season/[seasonId]?tab=budget` | Season editor med 5 tabs (Budsjett/Dag/Time/Åpningstider/Oversikt) |
| `/dashboard/year-wheel` | Year wheel + planning cycles |
| `/dashboard/governance` | Policies + protocols |
| `/dashboard/handbook` | Handbook content |
| `/dashboard/hms` | HMS / HACCP (om aktivert) |
| `/dashboard/reports` | KPI + reports |
| `/dashboard/contracts` | Lista 2 kontrakter (Local Admin sent, Erik signed) |
| `/dashboard/contracts/new` | Skjema for ny kontrakt |
| `/dashboard/billing` | Stripe-billing seksjoner |
| `/dashboard/cost` | Cost-tracking |
| `/dashboard/website` | Workspace-website-builder |
| `/dashboard/komm` | Channels-listing |
| `/dashboard/calendar` | Calendar view |
| `/dashboard/close` | Close-day flow |
| `/dashboard/reconciliation` | Daily reconciliation wizard |
| `/dashboard/organization` | Org settings |
| `/dashboard/settings` | User settings |
| `/dashboard/help` | Help center |
| `/dashboard/notifications` | Notifications inbox |
| `/dashboard/ai` | Mr. Botsson chat (full-page) |
| `/dashboard/onboarding-assistant` | Onboarding copilot |

For HVER side, sjekk:
- Loading state vises kort
- Ingen "Application error" eller white-screen
- Ingen `404` i Network tab
- Skeleton crossfade til content (Nordic Split crossfade)
- Botsson Orb synlig i bunn-høyre (unntatt sider med embedded chat per ADR-0238)

### 4.2 Komm-kanaler (live test)

| # | Step | Expected |
|---|---|---|
| 4.2.1 | `/dashboard/komm` | Liste over kanaler |
| 4.2.2 | Velg en kanal | ChatClient åpner med MessageTimeline + MessageInput |
| 4.2.3 | Send melding | Vises i Timeline. Telemetri: `engine_event` får `channel.message.sent` (verify: `docker exec supabase_db_smartout.ai psql -U postgres -c "SELECT event_type FROM engine_event ORDER BY fired_at DESC LIMIT 3;"`) |
| 4.2.4 | Klikk video-knapp i kanal-header | CallRoom overlay åpner. Mint token via EF `livekit-token` |
| 4.2.5 | I CallRoom: bunn-rad | 2 nye knapper: "Inviter medlem" + "Inviter bot" |
| 4.2.6 | Klikk "Inviter medlem" | Toast "Member-picker kommer snart" |
| 4.2.7 | Klikk "Inviter bot" | Toast warning (route TBD) |
| 4.2.8 | PhoneOff (rød knapp) | Overlay lukkes umiddelbart. `channel_call_session.status` flippes til `ended` (verify db) |
| 4.2.9 | Andre bruker i samme kanal | Når starter klikker PhoneOff: ANDRE deltakeres overlay lukkes også umiddelbart (LiveKit room deleted via `roomService.deleteRoom`) |

### 4.3 Botsson Orb mic (voice-agent)

| # | Step | Expected |
|---|---|---|
| 4.3.1 | Klikk Orb mic-knapp (bunn-høyre) | Token mintes via `/api/botsson/voice/token` |
| 4.3.2 | Browser kobler til LiveKit-rom | Orb status: `listening` |
| 4.3.3 | Voice-agent autodispatcher | Innenfor 1-2s: høre "Hei, jeg er Botsson…" på norsk |
| 4.3.4 | Si "Hva har jeg på vakt i dag?" | Botsson kaller `get_my_shifts` capability. Svarer på norsk |
| 4.3.5 | Avbryt midt-i-setning | Botsson stopper (barge-in fungerer per `interrupt_response: true`) |
| 4.3.6 | Forventede latency | Turn-end → første ord: 600-900ms (250ms VAD silence + ~400ms Realtime model) |
| 4.3.7 | Si "Hva er personnummeret mitt?" | Botsson redirect til chat (ADR-0078 høy-PII over voice forbud) |
| 4.3.8 | Avslutt | Klikk mic igjen / lukk overlay → Disconnected event → status `idle` |

### 4.4 Kontrakts-flyt (admin signering)

| # | Step | Expected |
|---|---|---|
| 4.4.1 | `/dashboard/my-contract` | Hero-card "Daglig leder", amber banner "Signer kontrakt" |
| 4.4.2 | Klikk "Signer kontrakt" | 404 — DocuSeal-route krever embed-URL |
| 4.4.3 | Bruk dev-mock | `http://localhost:3060/walt/sign-dev/c0000000-0000-0000-0000-000000000001` → "Signer kontrakten" |
| 4.4.4 | Klikk dev-sign | DB: `employment_contract.status` flippes til `signed` |
| 4.4.5 | Reload `/dashboard/my-contract` | Status-badge = signed, signing-banner forsvinner, last-ned-PDF (om dokument finnes) |

### 4.5 Mr. Botsson chat (`/dashboard/ai`)

| # | Step | Expected |
|---|---|---|
| 4.5.1 | Side åpner | Chat-UI med tom thread |
| 4.5.2 | "Hva har jeg å gjøre i dag?" | Klassifiserer intent → kapabilitet (sannsynligvis `schedule.get_my_shifts`) → svar |
| 4.5.3 | "Hva sier loven om prøvetid?" | Lovsen-capability (`industry_intelligence.lovsen_query` om aktiv) |
| 4.5.4 | "Skift bakgrunn til mørk" | Page-tool execution (Orb-state tools) |
| 4.5.5 | "Hva er bankkontoen min?" | Tilgang via revealable felt — IKKE direkte i chat-svar (ADR-0078 høy-PII chat-only men ikke i prompt-kontekst) |

---

## 5. Dashboard — employee paths

Logg ut, logg inn som `anna@smartout.local`.

| URL | Expected |
|---|---|
| `/dashboard/my-schedule` | Annas vakter (filter på `employee_id = f0000000-...-000001`) |
| `/dashboard/my-contract` | Hvis Anna har kontrakt: vis. Ellers: "Ingen kontrakt ennå" |
| `/dashboard/my-profile` | Annas profil-felt + foto |
| `/dashboard/my-cv` | CV-redaktør |
| `/dashboard/my-training` | Training progress |
| `/dashboard/my-salary` | Lønnsoversikt (om payroll-profile finnes) |
| `/dashboard/shift-clock` | Stempling inn/ut for aktiv vakt |
| `/dashboard/people` | **403 eller redirect** (employee skal IKKE se people-page) |
| `/dashboard/governance` | **403 eller redirect** |

---

## 6. Trainee path

Logg inn som `kari@smartout.local`.

| URL | Expected |
|---|---|
| `/dashboard` | Trainee-onboarding-flyt eller "Klar for vakt?"-prompt |
| `/dashboard/my-training` | Pending knowledge_tests, protocols |
| Training-quiz | Klikk på pending → vises spørsmål → svar → progress oppdateres |

---

## 7. Platform-admin (godmode)

`is_godmode=true` på user_identity. Verifiser: `docker exec supabase_db_smartout.ai psql -U postgres -c "SELECT id, email, is_godmode FROM user_identity WHERE is_godmode=true;"`

Logg inn som godmode-bruker (admin@smartout.local sannsynligvis), naviger til `/platform-admin`.

| URL | Expected |
|---|---|
| `/platform-admin` | Platform dashboard |
| `/platform-admin/workspaces` | Lista alle workspaces |
| `/platform-admin/users` | Lista alle user_identity |
| `/platform-admin/contracts` | Platform-level contracts |
| `/platform-admin/billing` | Stripe-events globalt |
| `/platform-admin/communications` | Communications log |
| `/platform-admin/content` | Content management |
| `/platform-admin/audit` | Activity_trail viewer |
| `/platform-admin/guardian` | Guardian-events live (krever stage-engine pg-notify) |
| `/platform-admin/health` | System health |
| `/platform-admin/dev-outbox` | Dev SMTP outbox |
| `/platform-admin/services` | Service registry |
| `/platform-admin/keys` | API keys |
| `/platform-admin/landing` | Landing-pages overview |
| `/platform-admin/journeys` | Journey-engine wizard |
| `/platform-admin/helpdesk-preview` | Helpdesk channel preview |

---

## 8. Telemetri-verifisering

Mens du klikker, kjør i parallel terminal:

```bash
docker exec supabase_db_smartout.ai psql -U postgres -c "
  SELECT event_type, COUNT(*) FROM engine_event
  WHERE fired_at > NOW() - INTERVAL '5 minutes'
  GROUP BY event_type ORDER BY 2 DESC;"
```

Hvis du klikker mye uten at rader øker → emit-pipen er knust.

Kjør også:
```bash
docker exec supabase_db_smartout.ai psql -U postgres -c "
  SELECT event, COUNT(*) FROM activity_trail
  WHERE created_at > NOW() - INTERVAL '5 minutes'
  GROUP BY event ORDER BY 2 DESC;"
```

Hvis 0 rader på activity_trail og 0 på engine_event → ingen mutasjoner emitter. CRITICAL.

---

## 9. Kjente stubs / dev-mocks

| Surface | Status | Workaround |
|---|---|---|
| `/sign/<token>` | 404 lokalt — krever DocuSeal embed-URL | Bruk `/walt/sign-dev/<contract_id>` |
| Botsson Orb mic — dispatch til komm-kanal | Voice-agent autodispatcher til ALLE rom | Forventet at den dukker opp i komm-kanal-call også (sannsynligvis bug) |
| `Inviter medlem`-knapp i CallRoom | Toast-stub | TBD |
| `Inviter bot`-knapp i CallRoom | POST til ikke-eksisterende route | TBD |
| Stripe webhooks | Bruker test-keys lokalt | Stripe CLI for å forwarde events |
| SendGrid emails | Bruker Inbucket lokalt | http://localhost:54324 |
| n8n workflows | Kjører lokalt på 5678 | n8n.smartout.ai går til prod |

---

## 10. Mobile (manuell test om Expo-server kjører)

Hvis `pnpm --filter mobile start` kjører:
- iOS Simulator / Android Emulator: scan QR fra Expo
- Logg inn som same workspace
- Test: my-schedule, my-contract, channels, push-notifications
- Voice (Botsson mobile): mic-knapp → LiveKit (per ADR-0135)

Mobile er thin client per ADR-0133 — SKAL IKKE ha vaktplan-editor, kontrakt-authoring, year-wheel. Hvis disse vises på mobile → BUG.

---

## 11. Result tracker

Kopier seksjonen under, fyll inn per rad. Lim resultatet i Linear-issue eller i `docs/SMOKETEST-RESULTS-<dato>.md`.

```
Dato: YYYY-MM-DD
Branch: development @ <commit-sha>
Tester: <navn>

| # | Område | Status | Notat |
|---|---|---|---|
| 0 | Pre-flight | pass/fail | |
| 1 | Test-users login | pass/fail | |
| 2 | Auth flow (2.1-2.7) | pass/fail | |
| 3 | Onboarding wizard (3.1-3.4) | pass/fail | |
| 4.1 | Admin core nav (24 sider) | pass/fail | Hvilke feilet? |
| 4.2 | Komm video-call | pass/fail | |
| 4.3 | Botsson Orb voice | pass/fail | |
| 4.4 | Kontrakt sign-flow | pass/fail | |
| 4.5 | Botsson chat | pass/fail | |
| 5 | Employee paths | pass/fail | |
| 6 | Trainee paths | pass/fail | |
| 7 | Platform-admin (16 sider) | pass/fail | |
| 8 | Telemetri-emit | pass/fail | |
| 10 | Mobile (om testet) | pass/fail | |

Hovedfunn:
- ...

Blockere for promote-preview:
- ...
```

---

## 12. Etter smoketest

- Hvis 0 critical fail → trygt å `/promote-preview`
- Hvis ≥1 critical fail → opprett Linear-issue per fail, fix på development, retest påvirkede områder
- Hvis emit-pipen død → STOPP. Telemetri-fix før alt annet
- Hvis voice-agent ikke registrert → sjekk `infra-voice-agent-1` logs + 1Password env

> Lagre alltid result-tracker — historiske passes hjelper å spore regresjoner.
