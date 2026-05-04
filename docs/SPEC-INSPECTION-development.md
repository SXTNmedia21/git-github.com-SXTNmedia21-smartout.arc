---
title: "Smartout Spec Inspection Playbook"
status: canonical
updated: 2026-05-02
created: 2026-05-02
module: ops
tags: [spec-inspection, audit, adr-compliance, governance]
---

# Smartout Spec Inspection

Sister-doc til `SMOKETEST-development.md`. Smoketest sjekker **at det som finnes virker**. Spec-inspection sjekker **at alt som skulle finnes finnes**.

> Kjøres før release. Pair-up: én person følger SMOKETEST-development.md (UI-flyt), én følger denne (kontrakt-mot-spec).

---

## 0. Kilder for "hva skal være her"

| Kilde | Hva den definerer |
|---|---|
| `docs/decisions/0000-decision-log.md` | 163+ ADRs. Status `accepted` eller `landed` = forventet i kode |
| `docs/learnings/` | 184+ learnings. Hver L-NNNN = bug-mønster som skulle vært lukket |
| `docs/architecture/INVARIANTS.md` | 9 harness-invarianter med CI-status |
| `docs/architecture/BOTSSON-SYSTEM-MAP.md` | Pipe-diagram med 🟢/🟡/🔴 per komponent |
| `docs/modules/MODULE_*.md` | 23 module-docs. Forventet kapabiliteter per modul |
| `docs/journeys/` | User-journey-pakker. Hver journey = endesett funksjonalitet |
| `git log --grep="feat:"` siste 90 dager | Faktisk leverte features |
| `packages/telemetry/src/registry.ts` | Forventet event-typer som skal emittere |
| Compliance: Aml., Riksavtalen, GDPR, Bokføringsloven §13 | Lov-pålagte features |

---

## 1. ADR-compliance audit

Prosess: for hver ADR med status `accepted` eller `landed`, verifiser at koden samsvarer.

### 1.1 Hent forventet-liste

```bash
# Alle accepted/landed ADRs
grep -E "^\| \[ADR-[0-9]{4}\].*\| (accepted|landed)" docs/decisions/0000-decision-log.md \
  | awk -F '|' '{print $2}' \
  > /tmp/expected-adrs.txt

wc -l /tmp/expected-adrs.txt
# Forventet: 100+
```

### 1.2 Top-priority ADRs å verifisere manuelt

Disse er load-bearing — om brutt, alt annet kan være feil:

| ADR | Hva å sjekke | Verifikasjon |
|---|---|---|
| ADR-0029 Workspace API Gateway | `workspace-api` Edge Function eksisterer + ruter alt eksternt API-kall | `ls supabase/functions/workspace-api/` |
| ADR-0039 Edge Function unified Docker | Ingen browser → `supabase.functions.invoke()` for workspace-mutations | `grep -rn "supabase.functions.invoke" apps/web/src/app/api/` — skal være tom (eller bare for non-mutation calls) |
| ADR-0054 Edge Functions own call orchestration | `livekit-token`, `livekit-webhook`, `call-command` finnes | `ls supabase/functions/livekit-* supabase/functions/call-command/` |
| ADR-0078 Channel restriction (PII) | Capabilities har `allowedChannels` registrert | `grep -rn "allowedChannels" packages/ai/src/capabilities/ \| wc -l` skal være ≥ antall capabilities |
| ADR-0091 Cascade gate-write | `cascade_gate_write` RPC + GateContext med channel-felt | `grep -n "cascade_gate_write" supabase/migrations/ \| tail -3` |
| ADR-0099 Capability authority gate | `gate_action` RPC + authority-seed migrations | `grep -l "gate_action" supabase/migrations/ \| wc -l` ≥ 5 |
| ADR-0132 Mobile AI routing via BFF | Mobile sender alt AI-trafikk til `/api/emma/*` ELLER `/api/botsson/*` | `grep -rn "stage-engine" apps/mobile/` skal være tom |
| ADR-0133 Mobile = D6+C4 only | Ingen authoring-UIs på mobile (schedule editor, contract authoring, year-wheel, governance authoring) | `find apps/mobile/src -type d \| grep -E "(schedule.*edit\|year-wheel\|governance)"` skal være tom |
| ADR-0135 LiveKit voice (mobile + voice-agent) | `services/voice-agent/` finnes + i compose | `docker ps \| grep voice-agent` skal returnere row |
| ADR-0151 Server-derive profile_id | `/agent/chat` deriverer profile_id fra JWT | `grep -A5 "deriveProfileId" services/stage-engine/src/` |
| ADR-0173 Frozen-4 capabilities | journey, contract, season, schedule registrerte | `grep -E "name: \"(journey\|contract\|season\|schedule)\"" packages/ai/src/capabilities/` |
| ADR-0184 + ADR-0185 Session Recorder | `agent_session_recording`, `agent_session_envelope`, `agent_session_whisper` tabeller | `docker exec supabase_db_smartout.ai psql -U postgres -c "\dt agent_session_*"` |
| ADR-0186 Guardian fanout via pg_notify | `guardian_log` trigger fyrer `pg_notify('guardian_events')` | `grep -A5 "pg_notify.*guardian" supabase/migrations/` |
| ADR-0193 NonEmptyString upstream | `AgentToolContext.profileId` er `NonEmptyString` | `grep "profileId.*NonEmptyString" packages/ai/src/types.ts` |
| ADR-0204 gatedMutation wrapper | Mutasjoner går gjennom `gatedMutation` ikke direkte | `grep -L "gatedMutation\|gateAction" packages/ai/src/capabilities/*/tools.ts` |
| ADR-0213 Campaign squash-merge ban | Campaign-merges = merge-commit ikke squash | `git log --merges --first-parent main \| grep "campaign/" \| head -5` (sjekk parent-count = 2) |
| ADR-0220 Botsson = entry point ikke orchestrator | Specs bruker terminologi-listen | manuell review-spør |
| ADR-0238 Surface disambiguation | `<DomainChatOwnership>` deklarasjon på sider med embedded chat | `grep -rn "DomainChatOwnership" apps/web/src/app/` |
| ADR-0242 Contract/Payroll capability split | `payroll` capability registrert + Høy-PII chat-only | `grep "name: \"payroll\"" packages/ai/src/capabilities/` |
| ADR-0244 Amendment as legal evidence | `contract_amendment` tabell + acknowledgement-ring | `docker exec supabase_db_smartout.ai psql -U postgres -c "\d contract_amendment"` |
| ADR-0245 Mobile contract flow | DocuSeal WebView + biometric C4 | `find apps/mobile -name "*Contract*" -o -name "*Sign*"` |

**Pass/fail per rad:** Skal være ≥85% pass. Under 70% = ADR-drift, må gjøres ADR-recovery-sortie først.

---

## 2. Lov-pålagt funksjonalitet

Norsk lov + tariff. Ikke-forhandlebar. Hver må fungere før prod.

### 2.1 Arbeidsmiljøloven (Aml.)

| § | Krav | Hvor i kode | Sjekk |
|---|---|---|---|
| §14-6 | 16 obligatoriske felter i ansettelseskontrakt (a–p) | `packages/ai/src/capabilities/contract/validate_aml_14_6.ts` | Test: send kontrakt mangler ett felt → validator FAIL m/§-ref |
| §14-9 | Midlertidig ansettelse — varighet + grunn | `employment_form_enum` har `temporary` + `end_date_reason` påkrevd | DB-test: insert midlertidig u/end_date_reason → FK/check fail |
| §15-3 | Oppsigelsestid (default 1 mnd, lovbestemt) | `employment_contract.notice_period_months` default 1 | DB-test: SELECT default |
| §15-6 | Prøvetid: oppsigelsestid 14 dager | Trial-period-logikk | Lovsen `validate_aml_14_6` strict mode |
| §15-7 | Saklig grunn for oppsigelse | Termination-flow + reason_code | `employment_contract.decline_reason_code` påkrevd ved oppsigelse |
| §10-4 | Alminnelig arbeidstid: 9t/dag, 40t/uke | Schedule-validator | Test: planlegg 11t skift → varsel om §10-4-overtidsregler |
| §10-6 | Overtid + grenser | `tariff_rate_table` + framework_rule | DB-test: SELECT på framework_rule WHERE rule_type='overtime_threshold' |

### 2.2 Ferieloven

| Krav | Hvor | Sjekk |
|---|---|---|
| 25 virkedager pr år (4 uker + 1 dag) | Holiday-allowance i payroll | `employee_payroll_profile` har `vacation_days_per_year` |
| Feriepengeprosent 10.2% / 12% (over 60) | Payroll calc | `payroll.shift_pay_calculation` audit |

### 2.3 Riksavtalen (NHO Reiseliv)

| Krav | Hvor | Sjekk |
|---|---|---|
| Tariff-satser (kveld, natt, helg, helligdag) | `tariff_rate_table` med workspace_id NULL = platform-level | `SELECT * FROM tariff_rate_table WHERE workspace_id IS NULL LIMIT 5` |
| Riksavtalen MCP for live oppslag | `services/lovsen-nho-reiseliv-mcp/` | `ls services/lovsen-nho-reiseliv-mcp/` |
| Tariff-binding per workspace | `workspace_framework_binding` | `SELECT * FROM workspace_framework_binding LIMIT 3` |

### 2.4 GDPR

| Krav | Hvor | Sjekk |
|---|---|---|
| Right to access | export-bruker-data flow | TBD — `gdpr_export` capability |
| Right to deletion | delete-bruker flow + cascade | TBD |
| Personnummer redacted i logs | `payment_attempt_pii_redaction` ADR-0141 | `grep -rn "personal_number" apps/web/src/lib/logger*` skal være tom |
| Trade union (fagforening) som GDPR Art 9 | Eksplisitt samtykke ved trade_union-felter | ADR-0242 amendment |
| Cross-border transfer | Supabase EU-region + Vercel EU + LiveKit EU | Sjekk DPA-klausuler |

### 2.5 Bokføringsloven §13

| Krav | Hvor | Sjekk |
|---|---|---|
| 5 års arkivering av kontrakter | `contract_archive` eller append-only | ADR-0244 amendment-flow |
| 5 års arkivering av lønnsslipper | `shift_pay_calculation` audit-modul | ADR-0251 |
| Append-only audit | `activity_trail` aldri DELETE/UPDATE | `grep -E "DELETE FROM activity_trail\|UPDATE activity_trail" supabase/migrations/` skal være tom |

### 2.6 Skatteetaten

| Krav | Hvor | Sjekk |
|---|---|---|
| A-melding (månedlig) | n8n-workflow eller cron-funksjon | TBD |
| Skattekort-fetch | ADR-0250 Edge Function `skatteetaten-fetch/` | `ls supabase/functions/skatteetaten-fetch/` |
| OTP / Pensjon | Pensjon-binding | TBD |

### 2.7 Lønn / Tips

| Krav | Hvor | Sjekk |
|---|---|---|
| Tips-fordeling (ADR-0261) | `tips.*` capability + BFF mutation host | `ls apps/web/src/app/api/tips/` |
| Lønnsslipp generation | `payroll.shift_pay_calculation` | Test: kjør for et skift → får snapshot-row |

---

## 3. Module-coverage check

For hver `docs/modules/MODULE_*.md`, sjekk at modulen er bygget:

```bash
ls docs/modules/ | wc -l
# 23 expected
```

| Modul | Forventet kjerne | Verifikasjon |
|---|---|---|
| 1. Auth | login/signup/reset, magic-link, RLS | Smoketest 2.1-2.7 |
| 2. Org Structure | Workspace/company/profile/department CRUD | `/dashboard/people`, `/dashboard/organization` |
| 3. Scheduling | Shift CRUD, swap, fill, publish | `/dashboard/schedule` |
| 4. Operations | Live day-control, deviations | `/dashboard/operations` |
| 4.5 Reconciliation | Daily close + KPI | `/dashboard/reconciliation` |
| 5. Onboarding | Wizard, invitation accept | `/onboarding`, `/invite/[token]` |
| 6. Training | Knowledge tests, protocols | `/dashboard/my-training` |
| 7. Communication | Channels, voice, video | `/dashboard/komm` |
| 8. Governance | Policy + protocol management | `/dashboard/governance` |
| 9. HMS / HACCP | Control lists, deviations | `/dashboard/hms` |
| 10. Reports | KPI dashboards | `/dashboard/reports` |
| 11. Contracts | DocuSeal + amendment + obligations | `/dashboard/contracts` |
| 12. Billing | Stripe-integration | `/dashboard/billing` |
| 13. Cost | Cost-tracking | `/dashboard/cost` |
| 14. Website | Workspace landing-builder | `/dashboard/website` |
| 15. Settings | User + workspace prefs | `/dashboard/settings` |
| 17. Year Wheel | Season planning | `/dashboard/year-wheel` |
| 18. AI / Botsson | Chat + voice + capabilities | `/dashboard/ai`, Orb |
| 19. Notifications | In-app + push + email | `/dashboard/notifications` |
| 20. Integration / API | Workspace-API + webhooks | `/platform-admin/keys` |
| MODULE_BOTSSON | Botsson Arena + Orb + Sticky | Orb mounted overalt unntatt ADR-0238 |
| MODULE_AGENT_SDK | Voice provider abstraction | `packages/agent-sdk/` |
| MODULE_0_ROADMAP | Hva-bygges-først | strategisk |

**Pass/fail per modul:** sjekk URL gir non-404 + grunn-funksjonalitet finnes.

---

## 4. Telemetry-registry coverage

Hver event i `packages/telemetry/src/registry.ts` skal:
1. Ha minst én emit-call i kode
2. Routes til riktig destinations (posthog/logger/activity_trail/engine_event)
3. Workspace_id + actor_id NonEmptyString

```bash
# Find unused events (registered but never emitted)
grep -E "^\s+\"[a-z]+\.[a-z_]+\":" packages/telemetry/src/registry.ts \
  | awk -F'"' '{print $2}' \
  > /tmp/registered-events.txt

for evt in $(cat /tmp/registered-events.txt); do
  count=$(grep -rn "event: \"$evt\"" apps/ packages/ services/ 2>/dev/null | wc -l)
  if [ "$count" -eq 0 ]; then
    echo "UNUSED: $evt"
  fi
done | head -30
```

Pass: <10 unused events. Fail: >20 unused = registry-drift, ryd opp.

---

## 5. Capability authority-seed coverage

Hver capability i `packages/ai/src/capabilities/` skal ha authority-seed-migration. Per ADR-0097 + L-0097:

```bash
ls packages/ai/src/capabilities/ | grep -v _ | grep -v registry > /tmp/capabilities.txt

for cap in $(cat /tmp/capabilities.txt); do
  found=$(grep -l "capability_name.*${cap}" supabase/migrations/*.sql 2>/dev/null | wc -l)
  echo "$cap: $found seed-migration(s)"
done
```

Pass: hver capability har ≥1 seed. Fail: 0 seed = ADR-0097-brudd, capability uautorisert.

---

## 6. CI-invariant coverage

Per `docs/architecture/INVARIANTS.md`:

| Inv | Hva | Status |
|---|---|---|
| I1 | Capability registry parity | sjekk `pnpm turbo invariants:capability-registry` |
| I2 | Authority seed parity | sjekk `pnpm turbo invariants:authority-seed` |
| I3 | Channel restriction | sjekk `pnpm turbo invariants:channel-restriction` |
| I4 | Server-actor (no profile_id from body) | sjekk `pnpm turbo invariants:server-actor` |
| I5 | Telemetry registration | sjekk `pnpm turbo invariants:telemetry-registration` |
| I6 | Gate-action parity | sjekk `pnpm turbo invariants:gate-action-parity` |
| I7 | NonEmptyString upstream | sjekk `pnpm turbo invariants:non-empty-string` |
| I8 | Map staleness gate | sjekk header-date `BOTSSON-SYSTEM-MAP.md` (per ADR-0227) |
| I9 | Frozen-4 capability boundary | sjekk `pnpm turbo invariants:frozen-4` |

Kjør:
```bash
pnpm turbo invariants 2>&1 | tee /tmp/invariants-result.txt
grep -c "FAIL" /tmp/invariants-result.txt
```

Pass: 0 FAIL. Hver FAIL = brudd på en aksept-ADR.

---

## 7. Recent-shipped-vs-existing audit

Sjekk siste 90 dagers commits — er alt landed faktisk fungerende?

```bash
# Hent feat-commits
git log --since="90 days ago" --oneline --all | grep -E "feat\(" | head -50 > /tmp/recent-features.txt

# For hver feat, sjekk om commit-message refererer ADR/L og om det fortsatt finnes
```

Spot-check:
- `feat(harness): mission-pool slot worker` (commit `0bc72c2bd`) — `services/stage-engine/src/core/mission-pool.ts` skal finnes
- `feat(invite): end-to-end invite flow` (commit `881ed118a`) — `/invite/[token]` fungerer
- `feat(mobile-voice): C1 server primitives` (commit `07a980d2a`) — `apps/web/src/app/api/botsson/voice/transcript/` finnes
- `feat(channels): reject sendMessage on voice channel` (commit `8791e26d9`) — test sender melding på voice-channel → reject

---

## 8. Database integrity

```bash
docker exec supabase_db_smartout.ai psql -U postgres <<'SQL'
-- Tables with workspace_id but no RLS
SELECT c.relname FROM pg_class c
WHERE c.relkind='r' AND c.relnamespace = 'public'::regnamespace
  AND EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name=c.relname AND column_name='workspace_id')
  AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename=c.relname);
-- Expected: 0 rows. >0 = RLS-bypass risk.

-- Enums count
SELECT COUNT(*) FROM pg_type WHERE typtype='e';
-- Expected: 72 per CLAUDE.md

-- Migrations count
SELECT COUNT(*) FROM supabase_migrations.schema_migrations;
-- Expected: ≥350 (verify rising)
SQL
```

---

## 9. Result tracker

```
Dato: YYYY-MM-DD
Branch: development @ <commit-sha>
Tester: <navn>

| Område | Status | Notat |
|---|---|---|
| 1.2 ADR-compliance top-21 | __/21 pass | |
| 2.1 Aml. (7 §) | __/7 pass | |
| 2.2 Ferieloven | __/2 pass | |
| 2.3 Riksavtalen | __/3 pass | |
| 2.4 GDPR | __/5 pass | |
| 2.5 Bokføringsloven §13 | __/3 pass | |
| 2.6 Skatteetaten | __/3 pass | |
| 2.7 Lønn/Tips | __/2 pass | |
| 3 Module coverage (23) | __/23 pass | |
| 4 Telemetry registry coverage | __ unused events | |
| 5 Capability authority-seed | __/__ pass | |
| 6 CI invariants (9) | __/9 pass | |
| 7 Recent-shipped audit | spot-check pass/fail | |
| 8 Database integrity | RLS-bypass count: __, enum count: __ | |

Critical findings:
- ...

Compliance-blockere for prod:
- ...

Anbefalte sorties:
- ...
```

---

## 10. Hva gjør du med funn

| Funntype | Aksjon |
|---|---|
| ADR-spec sier X men kode mangler X | Linear-issue: "ADR-NNNN compliance gap — implement X" |
| Lov-krav mangler | P0-blocker for prod. Stopp release. |
| CI-invariant FAIL | Linear-issue critical. Fix før neste merge. |
| Telemetry-event registrert men ikke emit | L-0094 phantom-emit-mønster. Enten emit eller fjern fra registry. |
| Capability uten authority-seed | ADR-0097-brudd. Skriv seed. |
| Kanaler-policy brudd (ADR-0078) | Kritisk: PII-lekkasje-risiko. Fix umiddelbart. |
| Mobile-authoring-UI funnet | ADR-0133-brudd. Fjern mobile-versjon, behold web. |

---

## 11. Pair med smoketest

Anbefalt løp:

1. Pre-flight (begge dokumenter §0)
2. Smoketest §2-§3 (auth + onboarding) — 10 min
3. Spec-inspection §6 (CI invariants) — 5 min, gir tidlig signal
4. Smoketest §4 (admin paths) + Spec-inspection §1.2 (ADR-top21) parallelt — 30 min
5. Smoketest §5-§7 + Spec-inspection §2 (lov-krav) — 25 min
6. Spec-inspection §3 (modules), §4 (telemetry), §5 (auth-seed), §8 (db) — 15 min
7. Spec-inspection §7 (recent-shipped) — 10 min spot-check

Total: ~95 min for full pass.

> Sjeldent kjøres full inspeksjon — kjør hele én gang per måned, og deltakende per release.
