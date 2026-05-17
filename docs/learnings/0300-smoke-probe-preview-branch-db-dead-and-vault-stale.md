---
title: "smoke-probe preview Supabase ref + 1Password vault both point to dead Branch DB"
id: L-0300
status: captured
layer: learning
created: 2026-05-17
updated: 2026-05-17
adr_refs: [ADR-0265, ADR-0071]
sibling_of: [L-first-prod-release-2026-05-13, L-0299]
---

# L-0300: smoke-probe preview Branch DB stale at script + vault

## What happened

HOP A run 2026-05-17 reached Stage 2 (smoke-probe preview) after FF + push succeeded. Smoke output:

```
🔬 SMOKE PROBE: preview
  OK    Vercel web (https://smartout-web-git-preview-smartout.vercel.app) — http 401 = alive
  OK    Vercel landing (https://smartout-landing-git-preview-smartout.vercel.app) — http 401 = alive
  FAIL  Supabase REST (rrjfrisxvrrhyzzitlxd) — http 000000
  FAIL  Edge Functions (https://rrjfrisxvrrhyzzitlxd.supabase.co/functions/v1/workspace-api/health) — http 000000
❌ smoke RED for preview (2 surface(s) failed)
```

DNS probe of `rrjfrisxvrrhyzzitlxd.supabase.co` returned `Could not resolve host` (NXDOMAIN). Same for historical alternate `cibmhhgsrdmpnmcikalu.supabase.co`. Both preview Branch DB refs are dead at the DNS level.

Per ADR-0265, smoke green is a prerequisite for lkg-tag (Stage 3). Stage 3 was correctly skipped. HOP A ended in partial-completion state: code shipped to preview, but no rollback target tagged.

## Why it happened

Three layers of stale config:

1. **`infra/scripts/smoke-probe.sh:67` hardcodes dead fallback:** `SUPABASE_REF="${SUPABASE_PREVIEW_REF:-rrjfrisxvrrhyzzitlxd}"`. The env var was unset; the fallback kicked in; the fallback ref is gone.
2. **1Password vault item `Supabase Preview Branch` (vault: `smartout_ai`) still has `url: https://rrjfrisxvrrhyzzitlxd.supabase.co`** — never updated after the Branch DB was deleted/cycled.
3. **No live preview Branch DB exists right now.** Both historical refs gone. Memory file `learning_first_prod_release_2026_05_13.md` already noted "Branch DB rrjfrisxvrrhyzzitlxd + cibmhhgsrdmpnmcikalu both gone" but encoding into smoke-probe never followed.

The memory observation existed since 2026-05-13. The smoke script and vault item went un-corrected for 4 days. Memory-as-knowledge ≠ enforcement-as-code (sibling pattern to L-0298 mapping-fidelity).

## Pattern

Sibling of L-first-prod-release-2026-05-13 (memory captured the gap), L-0298 (mapping/coverage tables not code-traced rot silently), L-0299 (status signal decouples from reality).

All three share: **operational truth observed in one session does not auto-propagate into the scripts and config that future sessions rely on.** Capture is the first step; encoding is the second. Memory without encoding = drift.

Smoke-probe-specific: the script assumes preview infra is always provisioned. There is no skip path for "preview Branch DB doesn't exist." In an environment where preview Branch DB is intentionally absent (cost, branching policy change), smoke RED is the wrong signal — should be SKIP with explicit warning.

## Fix in place (documentation)

`deploying` skill `## HOP A Operational Traps` section second row encodes:
- Symptom: smoke RED on Supabase surfaces with `http 000000`.
- Root cause: dead fallback in smoke-probe + dead vault item + no live preview Branch DB.
- Fix: provision new preview Branch DB, update vault, update smoke fallback. Until then: Vercel surfaces (http 401 = alive) are real signal; lkg-tag legitimately blocked; do NOT manually `git tag` to bypass.

## Fix needed (code) — separate sortie

Three real fixes, in priority order:

1. **Decision needed:** Does preview tier still require a Branch DB per ADR-0071, or has policy shifted? If shifted, ADR amendment required.
2. **If yes:** Provision new preview Branch DB via Supabase Cloud, capture ref, update 1Password vault item `Supabase Preview Branch` (URL + project ref fields), update `SUPABASE_PREVIEW_REF` default in `infra/scripts/smoke-probe.sh:67`, sync `sync-env-to-vercel.sh` preview Supabase target.
3. **If no:** Update smoke-probe to SKIP Supabase preview surfaces with explicit "no preview Branch DB per ADR-XXXX" message; update ADR-0071 + deploying skill accordingly. Update wrapper smoke-probe gate to not block lkg-tag on intentional preview-Supabase absence.

Tracking: separate sortie or campaign needed — too broad for in-line fix within an unrelated session.

## Rule going forward

**Any session that observes a config-vs-reality drift in a deploy script or 1Password vault item MUST either (a) fix the drift in the same session, or (b) emit a docs/learnings/ entry that explicitly tracks the gap with a remediation owner.**

Memory-only capture is insufficient — 4 days passed between the original observation (L-first-prod-release-2026-05-13) and this learning, and the underlying drift persisted unchanged.

## Promotion check

3rd time the smoke-probe stale-ref class has surfaced operationally (2026-05-13 prod release, 2026-05-13 vault audit, 2026-05-17 promote-preview). Threshold met for ADR draft: ADR-XXXX should formalize the preview-Branch-DB decision (provision vs. drop) so the smoke script and vault item have a single source of truth to track.

---

> Register in `docs/learnings/0000-learning-log.md`.
