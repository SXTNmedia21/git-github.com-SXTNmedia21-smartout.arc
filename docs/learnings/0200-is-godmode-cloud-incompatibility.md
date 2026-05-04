---
title: "is_godmode is Cloud-incompatible for grant chains"
id: LEARNING_0200
status: canonical
layer: learning
created: 2026-05-04
updated: 2026-05-04
tags: [supabase, cloud, seed, migration, godmode, identity]
---

# Learning-0200: is_godmode is Cloud-incompatible for grant chains

## Context

`supabase/migrations/20260521000400_billing_seed_accountant_placeholder.sql` (line 20) bruker `(SELECT user_id FROM public.user_identity WHERE is_godmode = true LIMIT 1)` for å resolvere `granted_by` på Erik super-admin grant rows. På Local fungerer dette — `supabase/seed.sql` setter `is_godmode = true` på en lokal-bare bruker (typisk `e0000000-0000-...`). På Cloud finnes ingen slik bruker — `is_godmode = true` matcher 0 rader, `granted_by` blir NULL, FK-constraint `NOT NULL REFERENCES public.user_identity(user_id)` fyrer, hele migrasjonen rolls back.

Council Round Castle 2026-05-04 (Supervisor) fanget dette under code-review av seed-pattern. Hadde ikke vært fanget før Pontus prøvde Cloud-deploy.

## Discovery

**`is_godmode = true` er en Local-only invariant.** Det produksjons-godkjente platform-bootstrap-mønsteret i Smartout krever en annen kilde for `granted_by`-resolusjon i Cloud-kompatible migrasjoner.

Tre alternativer evaluert:

1. **Self-grant** (`granted_by = profile_id` for samme bruker som mottar grant) — Erik granter seg selv ved bootstrap. Honest semantics, no extra dependency.
2. **Dedicated platform-bootstrap profile** opprettet earlier i samme migrasjons-set (`6c6c6c6c-...` UUID, email='platform@smartout.ai').
3. **Nullable `granted_by`** med relaxed FK constraint — løse opp NOT NULL.

ADR-0269 valgte **option 1 (self-grant)** — minst ny infra, matcher reality at Erik er sin egen platform-bootstrap-aktør.

## Impact

**Pattern: enhver migrasjon som setter `granted_by`/`created_by`/`actor_id` via godmode-lookup må erstattes før Cloud-deploy.** Konkret:

```sql
-- BAD (Cloud-fail):
INSERT INTO some_table (granted_by) 
VALUES ((SELECT user_id FROM user_identity WHERE is_godmode = true LIMIT 1));

-- GOOD (Cloud-safe):
INSERT INTO some_table (granted_by) 
VALUES (target_user_id);  -- self-grant, or known-existing platform user
```

**Audit-task:** grep `supabase/migrations/` for `is_godmode` i WHERE-clauses som driver INSERT-resolution → må erstattes.

**Skill-update:** `smartout-database-guide` skill bør tilskrive godmode-lookup som anti-pattern for produksjon-migrasjoner.

**Klasse-relasjon:** Sibling til L-0177 (forgeable-ID class) — der var bug'en fallback til JWT-default workspace; her er det fallback til NULL granter. Begge handler om silent-fail-vs-fail-fast.

## References

- ADR-0269 — Accountant Portal Data Foundation (chooses self-grant)
- `supabase/migrations/20260521000400_billing_seed_accountant_placeholder.sql:20` (godmode-lookup pattern)
- `supabase/seed.sql` (Local-only is_godmode setup)
- L-0177 — Forgeable-ID class (sibling pattern, JWT-default fallback)
- ADR-0192 — Authority seed bootstrap-trigger pattern (avoids godmode entirely)
