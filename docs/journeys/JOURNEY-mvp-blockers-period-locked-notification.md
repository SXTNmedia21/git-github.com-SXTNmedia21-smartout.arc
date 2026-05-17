---
title: "Journey — Ansatt får varsling når periode låses"
feature: mvp-blockers
journey: period-locked-notification
status: verified
verified_at: 2026-05-13
e2e_test: null
created: 2026-05-10
updated: 2026-05-10
module: payroll
tags: [journey, payroll, ship-blocker, sma-347]
---

# Journey: Ansatt får varsling når periode låses

**Role:** ansatt (Anne-persona) + manager (trigger)

**Precondition:** Periode er åpen + beregnet. Ansatt har `expo_push_token` registrert (eller email).

## Happy Path

1. Manager klikker "Lås periode" på `/dashboard/payroll/[periodId]` → confirm
2. `lock-period` BFF route fyrer:
   - UPDATE `payroll.period` SET status='locked'
   - emit `payroll.period_locked` event
3. `engine_dispatch` consumer mottar event
4. `payroll-period-locked-handler` kalles:
   - Henter `affectedProfileIds` (alle med `payroll.calculation` rader for perioden)
   - INSERT 12 rader til `notification_outbox` (en per ansatt)
   - Hver rad: `mode='work', channel='push', idempotency_key='payroll.period_locked.<period_id>.<profile_id>'`
5. Notification outbox-pipeline (eksisterende infra) leverer:
   - Hvis `expo_push_token` finnes: push-varsling til mobil
   - Ellers: SendGrid email fallback
6. Anne får push: "Lønnsgrunnlag for mai 2026 er klart"
7. Anne tapper notifikasjon → deep-link til `(me)/payroll` → ser sitt lønnsgrunnlag

**Postcondition:** Hver berørt ansatt har minst ett notifikasjons-forsøk dispatchet. Activity-trail logger alle attempts.

## Error Paths

- **Stale Expo token:** push fails silently → telemetry alert på >50% failure rate i workspace → email fallback aktiveres
- **Re-lock samme periode:** idempotency_key forhindrer dupe-rader (verifiseres i pgTAP)
- **No affected profiles (tom periode):** handler returner `dispatched: 0`, ingen feil
- **engine_dispatch handler down:** event ligger i engine_event-køen, retry på neste dispatch

## Verification

- [ ] Edge Function `payroll-period-locked-handler` shipped + registrert i config.toml
- [ ] engine_dispatch wires `payroll.period_locked` → handler
- [ ] Lock May 2026 demo → 12 outbox-rader opprettes (verified i Postgres)
- [ ] Push-test: Anne mottar varsling på Expo-dev konsoll
- [ ] Email fallback fungerer for token-løs profile
- [ ] Idempotency: re-lock attempts → 0 dupe-rader
- [ ] Vitest unit-test for handler (2 scenarios)
- [ ] Linear: SMA-347 lukket

**Mark `status: verified` when all boxes are checked.**
