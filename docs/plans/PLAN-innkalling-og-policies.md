---
title: "Plan — innkalling-og-policies"
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: people
tags: [innkalling, policies, hms, governance, staff-event]
---

# Plan — innkalling-og-policies

> Branch: `feat/innkalling-og-policies` | Worktree: /home/sxtnl/dev/smartout.ai-wt-2 | Base: `development` | Module: people | Started: 2026-04-29

## Goal

To uavhengige features under People-modulen: (1) **Innkalling** lar admin/manager kalle inn én eller flere ansatte til staff event med type, tittel, melding, dato, tidsperiode; (2) **Policies** flyttes fra `/dashboard/hms/governance` til `/dashboard/policies` som ren list+create-flate.

## Scope-grenser

- Ingen endring i `InviteMemberDialog` (workspace-invite). Lever videre på People-siden.
- Ingen endring i `/dashboard/hms/governance`. `Policys`-tab i `people-tabs.ts` flyttes derfra, men siden består.
- Innkalling sender IKKE e-post/SMS i Phase 1. Lagrer event + attendees + emit telemetri.
- Policies-dialog er minimum: tittel + beskrivelse + type. Server-side defaults for `policy_scope='workspace'`, `enforcement_status='aspirational'`, `statement=description`.

## Datalag

### Ny tabell: `staff_event`

```sql
CREATE TYPE staff_event_type AS ENUM (
  'utviklingssamtale', 'personalmote', 'personalfest', 'annet'
);

CREATE TABLE public.staff_event (
  event_id      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  uuid NOT NULL REFERENCES public.workspace(workspace_id),
  event_type    staff_event_type NOT NULL,
  title         text NOT NULL,
  message       text,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  location      text,
  created_by    uuid NOT NULL REFERENCES public.profile(profile_id),
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT staff_event_time_valid CHECK (ends_at > starts_at)
);
```

### Ny tabell: `staff_event_attendee`

```sql
CREATE TYPE staff_event_attendee_status AS ENUM (
  'invited', 'accepted', 'declined', 'tentative'
);

CREATE TABLE public.staff_event_attendee (
  event_id      uuid NOT NULL REFERENCES public.staff_event(event_id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL REFERENCES public.profile(profile_id),
  status        staff_event_attendee_status NOT NULL DEFAULT 'invited',
  responded_at  timestamptz,
  created_at    timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (event_id, profile_id)
);
```

### RLS

- `staff_event` SELECT: alle workspace-medlemmer. INSERT/UPDATE/DELETE: admin + manager.
- `staff_event_attendee` SELECT: workspace-medlemmer. INSERT/DELETE: admin/manager. UPDATE av `status`: attendee selv (Phase 2 RPC).

### Telemetri

`packages/telemetry/src/registry.ts`: `staff_event.created` → posthog + activity_trail + engine_event. `policy.created` → samme rute hvis ikke finnes.

### Policies

Ingen migrasjon. Bruker `public.policy`. Server action mapper minimum form til full insert.

## UI-lag

### Innkalling — `/dashboard/people/invitations` (rewrite)

- Behold "Innkalling"-tittel. Subtitle: "Kall inn ansatte til samtaler, møter og tilstelninger."
- Fjern `InvitationsSection` fra denne ruten (workspace-invite-listen flyttes ikke — den eksisterer fortsatt på People-siden via tabellen).
- Liste over `staff_event` (sortert `starts_at DESC`).
- "+ Ny innkalling"-knapp (brand-orange) → `StaffEventDialog`.

### `StaffEventDialog`

Felt: type-toggle (utviklingssamtale / personalmøte / personalfest / annet), tittel, melding (textarea, valgfri), dato, start-tid, slutt-tid, lokasjon (valgfri), deltakere (multi-select med søk).

Submit → `createStaffEvent` server action → insert event + attendees i transaksjon → emit telemetri.

### Policies — `/dashboard/policies` (ny)

Server-page (ADR-0115 RSC-mønster):
- Header "Policies" + count
- KpiAccentTile-strip: total / aktive / type-fordeling
- Tabell: navn, type, scope, enforcement, opprettet
- "+ Ny policy"-knapp → `PolicyCreateDialog` (type + tittel + beskrivelse)

### Tab-flytting

`apps/web/src/app/dashboard/_lib/people-tabs.ts`: bytt `/dashboard/hms/governance` → `/dashboard/policies` for `Policys`-tab.

## Faser / Tasks

- [ ] **F1 — Migration:** `staff_event` + `staff_event_attendee` + RLS + indices
- [ ] **F2 — Types regen:** `pnpm supabase gen types`
- [ ] **F3 — ADR:** `ADR-XXXX-staff-event-as-dedicated-table.md`
- [ ] **F4 — Telemetri:** registrer `staff_event.created` + `policy.created`
- [ ] **F5 — Server actions:** `staff-event-actions.ts` (create/list), `policy-actions.ts` (create/list)
- [ ] **F6 — Innkalling UI:** rewrite `invitations/page.tsx` + `StaffEventDialog` + `StaffEventList`
- [ ] **F7 — Policies UI:** ny `policies/page.tsx` + `PoliciesPageClient` + `PolicyCreateDialog`
- [ ] **F8 — Tab swap:** `people-tabs.ts`
- [ ] **F9 — Typecheck:** `pnpm turbo typecheck` 0 errors
- [ ] **F10 — Handoff + journey-finalize**

## Filer som lages

```
supabase/migrations/<ts>_staff_event.sql                                          (~80)
apps/web/src/app/dashboard/people/invitations/_actions/staff-event-actions.ts    (~120)
apps/web/src/app/dashboard/people/invitations/_components/StaffEventDialog.tsx   (~280)
apps/web/src/app/dashboard/people/invitations/_components/StaffEventList.tsx     (~140)
apps/web/src/app/dashboard/policies/page.tsx                                     (~60)
apps/web/src/app/dashboard/policies/loading.tsx                                  (~20)
apps/web/src/app/dashboard/policies/_actions/policy-actions.ts                   (~80)
apps/web/src/app/dashboard/policies/_components/PoliciesPageClient.tsx           (~180)
apps/web/src/app/dashboard/policies/_components/PolicyCreateDialog.tsx           (~160)
docs/decisions/ADR-XXXX-staff-event-as-dedicated-table.md                        (~80)
```

## Filer som endres

```
apps/web/src/app/dashboard/people/invitations/page.tsx                           (rewrite)
apps/web/src/app/dashboard/_lib/people-tabs.ts                                   (key swap)
packages/telemetry/src/registry.ts                                               (+ events)
docs/decisions/0000-decision-log.md                                              (+ ADR-XXXX)
```

## Risiko / traps

- `policy.statement` er NOT NULL — server action MÅ fylle med `description`.
- `created_by` derives server-side fra session profile_id (ADR-0151).
- RLS bruker `get_workspace_ids_for_user()`-helper, ikke direkte `auth.uid()`.
- Telemetri: non-null `workspace_id` + `actor_id` (ADR-0134).
- `database.types.ts` regen kreves etter migration — ikke manuell edit.
- "Innkalling" som ord betyr to ting historisk — sjekk i18n-keys + sørg for at dette ikke kolliderer med eksisterende `invitation`-strenger.

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log oppdatert (ADR registrert)
- [ ] Begge journeys i `docs/journeys/` ferdige
- [ ] Migration kjører rent på lokal Supabase
- [ ] Manuell test: admin kan opprette innkalling for 1 og flere ansatte
- [ ] Manuell test: admin kan opprette policy med kun tittel + beskrivelse
- [ ] RLS test: ikke-admin får 403 ved insert
