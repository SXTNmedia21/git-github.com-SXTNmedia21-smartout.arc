---
title: "Untracked supabase migration is a silent attack vector"
id: LEARNING_0222
status: canonical
layer: learning
created: 2026-05-06
updated: 2026-05-06
tags: [learning, supabase, migrations, security, sortie-hygiene, gate-action]
---

# Learning-0222: Untracked migration breaks db reset, defeats authority gate

## Reference (for grep)

- 2026-05-06 supabase migration audit — F-DB-01
- `docs/audits/2026-05-06-supabase-migration-audit.md`
- Fix commit: 3d36b3f5e (`supabase/migrations/20260525110000_outreach_capability_authority_seed.sql`)

## The trap

A migration file written to `supabase/migrations/` but uncommitted has
ALL the danger of a committed migration:

- Developer's local Supabase has it applied (via `npx supabase db reset`)
- App code imports / references the seeded data
- Edge Functions call gated capabilities

But CI environments + new clones DON'T see the file. `db reset` skips
it. App code crashes at runtime in ways hard to diagnose. Authority
seed migrations are particularly dangerous: per L-0066, missing
`engine_authority_config` rows mean `gate_action()` default-allows.

## 2026-05-06 occurrence

`20260525110000_outreach_capability_authority_seed.sql` was on disk
untracked since 2026-05-05. Discovered during the migration audit.
The outreach capability (ADR-0282 — outbound SMS + voice) was being
referenced from intent-classifier and telemetry registry but the
authority seed never reached CI.

Effect:
- Local dev: outreach gated correctly (file applied)
- CI tests: outreach capability returns default-allow (no row in `engine_authority_config`)
- Wrong-employee SMS at 02:00 = authorized by silent default

## Detection

```bash
# Pre-commit / pre-push: refuse if migrations are untracked
UNTRACKED_MIGS=$(git status --short | grep '^?? supabase/migrations/' | wc -l)
if [[ "$UNTRACKED_MIGS" -gt 0 ]]; then
  echo "ERROR: $UNTRACKED_MIGS untracked migration(s). Commit or delete:"
  git status --short | grep '^?? supabase/migrations/'
  exit 1
fi
```

Stronger: if untracked migration references any `ADR-XXXX` not on
current branch, fail with explicit "migration depends on ADR/capability
not yet merged" hint.

## Authority-seed safety pattern

When committing the rescued seed, harmonise to the canonical pattern
(`20260524000100_seed_booking_authority.sql`):

```sql
DO $$
DECLARE
  v_updated_by uuid;
BEGIN
  SELECT user_id INTO v_updated_by
  FROM public.user_identity
  WHERE is_godmode = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_updated_by IS NULL THEN
    RAISE NOTICE 'No godmode user — skipping authority seed. Re-run after first admin.';
    RETURN;
  END IF;

  INSERT INTO engine_authority_config (...) VALUES (..., v_updated_by) ON CONFLICT DO NOTHING;
END $$;
```

Anti-pattern: bare `INSERT ... SELECT` with `COALESCE` fallback to
"oldest user_identity globally" pollutes `updated_by` attribution and
diverges from the safety convention.

## Anti-pattern

Never write an authority seed migration as standalone artifact "for a
follow-up commit." ADR-0189 authority-seed parity demands they ship
together. Stashing or leaving untracked recreates the same divergence
locally.

## Related

- L-0066 (gate_action default-allow CVE class)
- L-0107 (authority appearance ≠ authority presence)
- L-0216 (stash-orphan migration — same family)
- ADR-0189 (authority-seed parity)
- ADR-0192 (capability_default_registry pattern)
