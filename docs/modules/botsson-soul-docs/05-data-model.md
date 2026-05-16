---
title: Data Model — Botsson Soul
status: draft
version: 0.3
created: 2026-05-15
updated: 2026-05-15
module: agent-system
tags: [botsson, data-model, postgres, agent]
---

> **Changelog 0.3 (2026-05-15)**: la til `botsson_channel_policy` tabell (L6). La til retention + PII-felt + RLS + PII-redaksjons-view på `botsson_soul_snapshot` (L5, paret med ADR-0330). La til "Preset registry"-seksjon med `LISA_PERSONALITIES` som kode-canonical kilde (L8).
>
> **Changelog 0.2 (2026-05-15)**: renamed all tables to `botsson_*` prefix to avoid collision with existing `engine_agent_profile` / `agent_session_recording`. Dropped `max_user_authority_override` (motsa non-negotiable #6 i `03-soul-contract.md`).

# Data Model — Botsson Soul

## Principle

localStorage kan brukes som UI-cache, men ikke som source of truth.

Canonical state skal bo server-side.

---

## Tables

```txt
botsson_profile
botsson_user_preference
botsson_workspace_policy
botsson_channel_policy
botsson_soul_snapshot
```

> **Naming**: `botsson_*` prefix valgt for å unngå kollisjon med eksisterende `engine_agent_profile` (engine_authority_config-linje) og `agent_session_recording` (audit-linje). Alternative: eget schema `botsson.*`.

---

## botsson_profile

Workspace-level default Botsson profile.

```sql
create table botsson_profile (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_key text not null,
  display_name text not null,
  default_persona text not null,
  default_rank text not null,
  default_blend integer not null,
  default_posture jsonb not null,
  default_voice_config jsonb,
  default_model_policy jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, agent_key)
);
```

Purpose:

- Definerer workspace-default.
- Lar admin styre standard Botsson-opplevelse.
- Gir stabil source of truth på tvers av browser/device.

---

## botsson_user_preference

User-specific overrides.

```sql
create table botsson_user_preference (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  botsson_profile_id uuid references botsson_profile(id),
  persona_override text,
  rank_override text,
  blend_override integer,
  posture_override jsonb,
  voice_override jsonb,
  custom_instruction text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, user_id, botsson_profile_id)
);
```

Purpose:

- Lagrer brukerens preferanser.
- Sikrer at settings overlever ny device/browser.
- Tillater per-user personalisering innenfor workspace policy.

---

## botsson_workspace_policy

Defines what users are allowed to customize.

```sql
create table botsson_workspace_policy (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  botsson_profile_id uuid references botsson_profile(id),
  allowed_personas text[],
  allow_user_custom_instruction boolean default true,
  allow_voice_override boolean default true,
  allow_posture_override boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Purpose:

- Skiller brukerpreferanser fra policy.
- Hindrer at brukerpersonalisering blir en authority-bakdør.
- Lar workspace styre hva som kan justeres.

> **Authority er aldri user-overridable** per `03-soul-contract.md` non-negotiable #6. Ingen felt for å justere authority-grenser via brukerpreferanse. Authority styres utelukkende via `engine_authority_config` (eksisterende C4-system).

---

## botsson_soul_snapshot

Audit/debug record for each resolved run. Append-only — ingen UPDATE eller DELETE i normal drift (retention-job er eneste skriver i tillegg til snapshot-skriveren).

```sql
create table botsson_soul_snapshot (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid,
  session_id uuid,
  channel text not null,
  contract_version text not null,
  resolved_identity jsonb not null,
  resolved_instruction_overlay jsonb,
  resolved_posture jsonb not null,
  resolved_voice jsonb,
  resolved_model_policy jsonb not null,
  context_refs jsonb,
  memory_refs jsonb,
  authority_summary jsonb not null,
  tools_offered jsonb,
  tools_filtered jsonb,
  input_hash text not null,
  prompt_hash text not null,
  tool_bundle_hash text,
  pii_present boolean not null default false,
  retention_days integer not null default 30,
  archived_at timestamptz,
  created_at timestamptz default now()
);

create index idx_botsson_soul_snapshot_workspace_created
  on botsson_soul_snapshot (workspace_id, created_at desc);
create index idx_botsson_soul_snapshot_session
  on botsson_soul_snapshot (session_id) where session_id is not null;
```

Purpose:

- Gjør Botsson debugbar.
- Viser hvorfor agenten svarte/handlet som han gjorde.
- Gir grunnlag for evals, audit og regression testing.

### Retention + PII (ADR-0330)

| Fase | Lagring | Trigger |
|------|---------|---------|
| Hot | `botsson_soul_snapshot` tabell | `created_at < now() - retention_days` |
| Cold | Supabase Storage `botsson-soul-archive/{workspace_id}/{yyyy-mm}/{snapshot_id}.json` | Nightly cron pakker rader → JSON → setter `archived_at` + sletter row |
| Slettet | Permanent | Etter 365 dager kjører `purge-snapshot-archive` cron — beholder kun snapshots med `pii_present=false` for eval-corpus |

**`pii_present=true`** settes når snapshot inneholder personnummer, bankkonto, helse-data eller annen PII identifisert av snapshot-skriveren via regex/zod-validator FØR persist.

### RLS

```sql
alter table botsson_soul_snapshot enable row level security;

-- User: les egne snapshots, men `resolved_instruction_overlay` + `context_refs`
-- nullstilles i SELECT-vier hvis pii_present=true.
create policy soul_snapshot_user_read on botsson_soul_snapshot
  for select using (
    user_id = auth.uid()
    or is_admin_in_workspace(workspace_id)
  );

-- Platform-admin ser alt rå (inkl. PII-felt).
create policy soul_snapshot_platform_admin on botsson_soul_snapshot
  for all using (is_platform_admin(auth.uid()));

-- Ingen UPDATE/DELETE for vanlige roller — append-only.
revoke update, delete on botsson_soul_snapshot from authenticated;
```

**PII-redaksjons-vier** (anbefalt for UI-debug):

```sql
create view v_botsson_soul_snapshot_safe as
  select
    id, workspace_id, user_id, session_id, channel, contract_version,
    resolved_identity, resolved_posture, resolved_voice, resolved_model_policy,
    authority_summary, tools_offered, tools_filtered,
    input_hash, prompt_hash, tool_bundle_hash,
    pii_present, retention_days, archived_at, created_at,
    case when pii_present then null else resolved_instruction_overlay end as resolved_instruction_overlay,
    case when pii_present then null else context_refs end as context_refs,
    memory_refs
  from botsson_soul_snapshot;
```

### Volum-anslag

- Chat: ~1000 runs/dag × ~5 KB = ~5 MB/dag = ~1.8 GB/år før arkivering
- Voice: ~50 sessions/dag × ~3 runs/session × ~5 KB = ~0.75 MB/dag
- 30d hot-window = ~155 MB / workspace / år
- Cold archive komprimerer ~70% (JSON+gzip) → ~550 MB / workspace / år i Storage

---

## botsson_channel_policy

Defines per-workspace channel-level tool-availability overrides. Komplementerer hardkodet kanal-policy (`channel="voice"` rejects payroll/AML/contract-mutations per ADR-0078).

```sql
create table botsson_channel_policy (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  channel text not null check (channel in ('chat', 'voice', 'background', 'mission')),
  tool_name text not null,
  allowed boolean not null,
  reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, channel, tool_name)
);
```

Purpose:

- Lar workspace blokkere et tool på en kanal (f.eks. "vi vil aldri ha contract-mutation på voice selv om ADR-0078 default tillater det her").
- Lar workspace whitelist'e et tool som ADR-0078 normalt blokkerer (forutsatt at safety-policy fortsatt tillater det).
- Gir audit-spor: hvem skrudde av hvilket tool på hvilken kanal når.

> **Hardkodet ADR-0078 channel-policy er en safety-floor** — `botsson_channel_policy` kan kun gjøre policy *strengere*, aldri fjerne ADR-0078-blokker. Resolution: `channel_policy_runtime = ADR-0078 ∩ workspace_overrides`.

### RLS

```sql
-- Kun workspace-admin kan lese + skrive.
create policy channel_policy_admin on botsson_channel_policy
  for all using (is_admin_in_workspace(workspace_id));
```

---

## Resolution hierarchy

```txt
botsson_profile (workspace default)
→ botsson_user_preference (user override)
→ session override
→ channel policy
→ safety policy
→ authority policy  (absolute, applied last)
```

> Authority er ALLTID sist — kan kun begrense, aldri utvide. Se `03-soul-contract.md` `Resolution Order`.

---

## RLS principles

- User can read own preference.
- User can update own allowed preference fields.
- Admin can manage workspace profile.
- Workspace policy can only be managed by admin/owner.
- Snapshots are append-only.
- Snapshots should not expose sensitive prompt content to unauthorized users.

---

## Preset registry (canonical source)

Preset-til-(persona, rank, blend, voice_tuning)-mapping er **kode-canonical**, ikke DB-canonical. Source of truth ligger i `apps/web/src/app/Botsson/_components/types.ts` (`LISA_PERSONALITIES`-array). Stage-engine importerer fra samme modul via `@smartout/ai/presets` (TODO når implementasjonen starter).

| `preset_key` | Persona | Rank | Blend | Default temp | First speaker | Source |
|--------------|---------|------|-------|--------------|---------------|--------|
| `dagsjef` | puls | admin | 8 | 0.2 | agent | `types.ts:139` |
| `mentor` | saga | manager | 4 | 0.4 | user | `types.ts:145` |
| `nysgjerrig-kollega` | gnist | employee | 2 | 0.7 | user | `types.ts:151` |
| `trygg-start` | vakt | trainee | 1 | 0.5 | agent | `types.ts:157` |
| `strategisk-radgiver` | saga | admin | 6 | 0.3 | user | `types.ts:167` |
| `brannslukker` | puls | manager | 7 | 0.2 | agent | `types.ts:173` |

**Hvorfor kode-canonical, ikke DB-canonical**:
- Presets er produkt-beslutninger, ikke runtime-konfigurasjon.
- Endring krever code-review + ADR-vurdering (kan endre opplevd persona for alle workspaces).
- DB-versjonering av presets ville skapt rebase-konflikter med UX-design-iterasjoner.

**UX-mappinger** (visning til bruker): se `06-ux-design.md`. UX-navn (`"Rolig og trygg"`, `"Brannslukker"`) mappes til `preset_key` i UI-laget, ikke DB.

---

## Migration principle

Start with additive tables. Do not remove localStorage immediately.

Recommended path:

1. Add tables.
2. Read from DB if present.
3. Fallback to localStorage payload.
4. Write new preferences to DB.
5. Keep localStorage as optimistic cache.
6. Remove dependency on localStorage after verification.
