---
title: "Smoketest + Spec Inspection Results — 2026-05-02"
status: results
updated: 2026-05-02
created: 2026-05-02
branch: development
commit: 80dbdee3d (post smoketest+spec docs)
tester: claude-orchestrated
module: ops
tags: [smoketest, results, audit]
---

# Results — 2026-05-02

Run after voice-agent compose-fix + Edge Function dead-mount-fix + invite-row scaffold + room-delete-on-end.

## Pre-flight (SMOKETEST §0)

| Check | Status | Notes |
|---|---|---|
| Docker stack | 🟢 | All 7 infra containers + 11 supabase containers `Up`. voice-agent `Up 59 min` (healthy = no healthcheck defined for it) |
| Edge runtime mount | 🔴→🟢 | **WAS** mounted to `~/dev/smartout.ai-order-system/supabase/functions` (drift from order-system worktree). **Restartet supabase fra dev-path** → now `~/dev/smartout.ai/supabase/functions` ✓ |
| Web 3060 | 🟢 | 307 (redirect to login) |
| Landing 3055 | 🟢 | 200 |
| Edge fn `livekit-token` | 🟢 | `{"msg":"Error: Missing authorization header"}` (auth-fail expected, not BOOT_ERROR) |
| Voice-agent registered | 🟢 | LiveKit Cloud UK region, edition Cloud, 3 job runners initialised |

**Gotcha discovered:** Whichever path runs `supabase start` last "wins" the docker-compose volume mount. If multiple worktrees fire `supabase start`, the mount drifts. Fix protocol: always restart from `~/dev/smartout.ai` (main repo) before review.

---

## CI invariants (SPEC §6)

```bash
cd packages/ai
pnpm invariants:emit-coverage
pnpm invariants:server-actor
pnpm invariants:gate-singleton
pnpm invariants:intent-coverage
```

| Invariant | Status | Output |
|---|---|---|
| `emit-coverage` | 🟢 | `all emit() calls registered in registry.ts` |
| `server-actor` | 🟢 | `no profile_id in POST body schemas` (ADR-0151 holding) |
| `gate-singleton` | 🟢 | `engine_authority_config reads only via gate_action RPC` (ADR-0099 holding) |
| `intent-coverage` | 🟢 | `26 capability names ↔ 28 enum values — all in sync. fall-through allow-list: general, knowledge, payroll` (ADR-0112 holding) |

**Note:** Only 4 invariant scripts exist (`packages/ai/scripts/check-*.ts`). The 9 invariants in `INVARIANTS.md` include some that are doc-only or implemented as separate CI workflows. **Gap:** invariants for channel-restriction, NonEmptyString, frozen-4 are not in `pnpm` scripts — verify CI pipelines run these or add as scripts.

---

## Database integrity (SPEC §8)

```sql
SELECT 'tables_no_rls', ... ; SELECT 'enums', ... ; ...
```

| Metric | Value | Comment |
|---|---|---|
| Tables with `workspace_id` but no RLS | **4** | `channel_department_access`, `channel_team_access`, `platform_communication_log`, `workspace_note` |
| Enums (public) | 178 | CLAUDE.md says 72 — outdated (delta +106 over time) |
| Migrations | 474 | |
| Public tables | 240 | CLAUDE.md says 169 — outdated (delta +71) |
| `activity_trail` last 1h | 9 | Active emit traffic |
| `engine_event` last 1h | 47 | Active emit traffic |

### RLS-bypass risk assessment

| Table | Risk | Action |
|---|---|---|
| `platform_communication_log` | LOW (platform-admin only, service-role-gated) | Verify policy missing IS by-design; add comment in migration |
| `workspace_note` | **HIGH** — workspace-scoped data with no RLS = cross-workspace leak risk | INVESTIGATE + add policy |
| `channel_department_access` | **HIGH** — access-control table itself unprotected | INVESTIGATE + add policy |
| `channel_team_access` | **HIGH** — same | INVESTIGATE + add policy |

**Recommendation:** Open Linear-issue `INFRA — RLS-bypass on 3 channel-access + workspace-note tables`. P0 for prod.

### Stale CLAUDE.md counts

`docs/CLAUDE.md` line ~83 ("169 tables") and `smartout-database-guide` skill ("public 169, payroll 23, websites 13, timesheet 1") need refresh:
- Public: 169 → **240** (+71)
- Enums: 72 → **178** (+106)

Skill + CLAUDE.md drift. Worth a sweep.

---

## Telemetry registry-vs-emit drift (SPEC §4)

Quick check ran 200 events → too many false-negatives from regex (events use space-separated names like `"shift created"` which fragmented). The robust signal is from `pnpm invariants:emit-coverage` which **passed**. Skip granular drift count — invariant is sufficient.

---

## Authority-seed coverage (SPEC §5)

| Counted | Found |
|---|---|
| Capabilities in `packages/ai/src/capabilities/` | 26 |
| Authority-seed migrations matching `*authority_seed*` or `*seed*authority*` | 24 |

Pattern variance — seeds use multiple naming conventions:
- `seed_<cap>_authority`
- `<cap>_authority_seed`
- `<cap>_capability_authority_seed`
- `seed_<feature>_authority`

**No grep-able 1:1 match without fragile regex.** Manual spot-check of recent capabilities (kb_query, journey-authoring, journey, contract, season, tips, helpdesk_query, recorder, day-control) — all have seeds. Older capabilities (communication, profile, ui) — verify separately.

**Recommendation:** Add `pnpm invariants:authority-seed-parity` script that walks `packages/ai/src/capabilities/*/index.ts`, extracts `name: "X"`, checks `engine_authority_config` rows by `capability_name='X'` after migration apply.

---

## Test data status

After session work:

| Entity | State |
|---|---|
| Local Admin contract (`c0000000-...001`) | `status='sent'`, signing-row linked, dev-sign URL: `/walt/sign-dev/c0000000-0000-0000-0000-000000000001` |
| Erik Pedersen contract (`c0000000-...002`) | `status='signed'`, signed_by_employee_at=2026-04-15 |
| Voice-agent worker | running on local LiveKit Cloud, ready for Botsson Orb mic |
| InviteRow on CallRoom | rendered, member-stub + bot-stub buttons |
| Hydration timezone | fixed (Europe/Oslo pinned in InvitationStatusList) |
| Edge call-end → roomService.deleteRoom | live in `call-command` Edge Function |
| Voice VAD tuning | silence 250 ms, prefix 200 ms, barge-in on |

---

## Critical findings — severity-ranked

### 🔴 P0 (compliance / security)
1. **3 RLS-bypass tables** (`workspace_note`, `channel_department_access`, `channel_team_access`) — investigate intent + add policy.
2. **DocuSeal sign-flow 404 in dev** — `/sign/<token>` notFound() when no `docuseal_embed_url`. User cannot test sign-flow without manually navigating to `/walt/sign-dev/<id>`. Fix: my-contract page should detect dev-mode + link to dev-mock when CONTRACT_SERVICE_URL unset.

### 🟡 P1 (integrity / drift)
3. **Edge runtime mount drift** — must `supabase stop && start` from main repo path; otherwise mount points at last-active worktree. Add to dev-protocol.
4. **CLAUDE.md + smartout-database-guide skill outdated** — public table count, enum count off by ~70/106.
5. **Voice-agent autodispatch joins all rooms** — including komm-channel user-to-user calls. Either filter rooms by `botsson-orb:*` pattern OR re-register with `agentName="mr-botsson"` for explicit dispatch.
6. **`Inviter bot`-button** points at non-existent BFF route `/api/channels/[id]/call/invite-agent`. Stub today, build real route in next sortie.

### 🟠 P2 (process / governance)
7. **Authority-seed parity script missing** — only 4 of 9 stated invariants have actual scripts. Add `authority-seed-parity`, `channel-restriction`, `non-empty-string`, `frozen-4-boundary` scripts.
8. **`packages/Botsson/` (capital B) not yet moved to `docs/botsson/`** per ADR-0209 prerequisite.
9. **MCP services (lovsen-* + strike + interview) not in compose** — verify intent (stdio-only by design) or wire.

---

## Linear-issues to open

```
P0: [security] 3 RLS-bypass tables — workspace_note + 2 channel-access
P0: [contracts] my-contract sign-link 404 in dev — route to /walt/sign-dev when no CONTRACT_SERVICE_URL
P1: [voice-agent] Filter autodispatch to botsson-orb:* rooms only (or use agentName)
P1: [db] Refresh CLAUDE.md + smartout-database-guide table/enum counts (240/178)
P1: [komm] Build /api/channels/[id]/call/invite-agent BFF route
P1: [infra] Document supabase-restart-from-main-repo protocol
P2: [ci] Add 4 missing invariant scripts (authority-seed, channel-restriction, NonEmptyString, frozen-4)
P2: [docs] Move packages/Botsson/ → docs/botsson/ per ADR-0209
P2: [services] Audit lovsen-* + strike + interview MCP — wire or archive
```

---

## What runs vs what works

✅ Web app loads, auth works, dashboard renders
✅ Komm-channel video-call (LiveKit-token EF live)
✅ Botsson Orb voice-call (voice-agent worker registered)
✅ Telemetry emit alive (47 engine_event in 1h)
✅ Invariants 4/4 pass
✅ Hydration mismatch fixed
✅ Room-delete-on-end live
✅ InviteRow scaffold rendered
✅ Test contracts inserted (Pontus sent + Erik signed)

🔴 DocuSeal sign-link 404
🔴 3 RLS-bypass tables
🟡 Voice-agent crash-joins komm-rooms (likely)
🟡 my-contract sign-link not dev-friendly

---

## Anbefalt løp neste

1. **Adresser P0 først** — RLS-bypass + sign-link redirect. ~1-2 dager.
2. **Manuell smoketest gjennom SMOKETEST §4-§7** — du klikker, jeg watcher logs/db live. Fyll inn rad-for-rad i denne fila.
3. **Hvis full-pass** → `/promote-preview`.
4. **Etter promote** — bestill SPEC-INSPECTION via cron 1× per uke for å fange drift tidlig.

---

## Files generated this round

| File | Purpose |
|---|---|
| `docs/SMOKETEST-development.md` | Manual UI flow checklist |
| `docs/SPEC-INSPECTION-development.md` | ADR/lov/invariant audit |
| `docs/SITEMAP.md` | All 406 entry points |
| `docs/SMOKETEST-RESULTS-2026-05-02.md` | This file |

> Three commits prior: `2f043c035` voice-agent compose, `cfdb3049d` room-delete-on-end, `a5f8d847c` VAD tune, `66d5ae4e7` invite-row, `d9dc0d8d8` timezone fix, `80dbdee3d` smoketest+spec docs.
