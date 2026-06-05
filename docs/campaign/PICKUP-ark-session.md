---
title: Ark session pickup note
status: in_progress
updated: 2026-06-06
created: 2026-06-06
module: ark-checkout
tags: [handoff, ark, remotes, design-import]
---

# Pickup — Ark working checkout

Checkout: `/home/sxtnl/archon-projects/smartout.ai` (the "Ark" / Archon working copy).

## Done this session

1. **Remotes wired** (was broken — empty checkout, HEAD pointed at phantom `.invalid`):
   - `origin` → Ark: `git@github.com:SXTNmedia21/git-github.com-SXTNmedia21-smartout.arc.git`
   - `upstream` → SmartOut.ai: `git@github.com:SXTNmedia21/smartout.ai.git`
   - `development` checked out, **tracks `origin/development` (Ark)**.
   - `git push` / `git pull` → Ark. To sync from smartout.ai: `git pull upstream development`.

2. **Design comms imported** from `campaign/master-refactor` → committed `d517f54b3`, pushed to Ark:
   - `design-export/` (42 lessons, README, components, app mockups)
   - `docs/campaign/` (203 files: missions, handoffs, orientation, manifests, ledgers)
   - `.claude/skills/smartout-design-port/` (design skill)
   - Already present (not re-copied): `docs/design`, `docs/missions`, `docs/agents/{frontend,mobile}-design`.

## Open threads (next session)

- **16OS sidebar-manage** — design APPROVED in chat, not yet written to spec or built. Scope:
  drag-resize rail (auto-snap icon-only < ~110px), drag-reorder within section + persist
  (`localStorage` key `sxtn-cc-sidebar`), item editor (rename/icon/target/hide). Panels canvas = later.
  Target file: `~/.claude/plugins/cache/sxtn-marketplace/sxtn/0.2.4/dashboards/control-center.html`
  ⚠️ Plugin-CACHE — edits wiped on plugin update. Decide: build in cache vs patch plugin source.
- **init-council blocked** — no `.sxtn/` here (`F_CONFIG_MISSING`). Run `/sxtn:init` to bootstrap
  `.sxtn/config.yaml` first, THEN `/sxtn:init-council`.
- **"619"** — Pontus mentioned "en liten 619" — unparsed (voice garble). Ask what it means.
