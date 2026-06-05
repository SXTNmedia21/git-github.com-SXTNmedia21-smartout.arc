---
title: Design-export drop folder — handoff format
status: in_progress
updated: 2026-06-02
created: 2026-06-02
module: design-intake
tags: [design, handoff, refactor-driver, mobile, dashboard]
---

# `.sxtn/design-export/` — drop your Claude Design handoff here

This is the **drop folder**. Put a Claude Design export in here, then run the pipe.
The harness ingests it, scaffolds it into the domain structure, and (for a brownfield
app like SmartOut) drives it page-by-page onto `apps/web` **and** `apps/mobile`.

> ⚠️ **This folder is emptied on successful `/sxtn-design-ingest`.** Keep your master
> design files somewhere else (e.g. a `design/` repo or Figma). Re-drop to re-ingest.
> This README gets consumed too — the canonical copy of the format lives in the plugin
> (`commands/sxtn-design-ingest.md`).

---

## What to drop

Claude Design produces a **per-module** set of files. Drop the whole export in here.

```
.sxtn/design-export/
  ansatte-directory.jsx     ← React page component (the design)
  ansatte-data.js           ← data shape / mock data the page expects
  ansatte-directory.css     ← scoped styles
  schedule-view.jsx
  schedule-data.js
  schedule-view.css
  component-index.yaml       ← OPTIONAL: pre-made Component Index (skips auto-gen)
  README.md                  ← OPTIONAL: Routes & status + intent (see below)
```

### Naming convention (drives domain derivation)

- **First hyphen-segment of the filename = domain.**
  `ansatte-directory.jsx` → domain `ansatte`. `schedule-view.jsx` → domain `schedule`.
- Keep one page = one `.jsx` (+ matching `-data.js` / `.css`).
- Domains should match existing SmartOut domains where possible (`ansatte`, `schedule`,
  `hms`, `onboarding`, …) so the refactor-driver can reconcile against the real backend.

### Optional `component-index.yaml`

If you ship one, it MUST have a top-level `entries:` key. Otherwise the ingest
auto-generates the Component Index from the `.jsx` files.

```yaml
entries:
  - id: ansatte-directory
    domain: ansatte
    route: /ansatte
    surfaces: [web, mobile]      # which flates this page targets
    intent: "Employee directory with search + role filter"
```

### Optional handoff `README.md` — Routes & status

For the **brownfield refactor-driver** (page-by-page onto the existing app), include a
`## Routes & status` table so the driver knows the page list + order, and a `chats/`
folder (or an `## Intent` section) carrying the design intent:

```markdown
## Routes & status
| Route        | Page file              | Surfaces     | Status |
|--------------|------------------------|--------------|--------|
| /login       | auth-login.jsx         | web, mobile  | new    |
| /oversikt    | oversikt-home.jsx      | web          | re-skin|
| /min-dag     | mindag-home.jsx        | mobile       | re-skin|
| /ansatte     | ansatte-directory.jsx  | web, mobile  | rewire |
```

`Status` ∈ `keep | re-skin | rewire | new | remove` (the driver's classification).

---

## How it reaches mobile AND dashboard

1. The design is **web-centric** (`.jsx`). Shared visual truth lives in
   **`packages/design-tokens`** — both `apps/web` (Tailwind/shadcn) and `apps/mobile`
   (Expo/RN) consume it. The driver re-skins each surface against the same tokens, so
   one design lands consistently on both.
2. Per page the driver classifies (keep / re-skin / rewire / new / remove), wires the UI
   to the **existing** Supabase tables (additive-only, never destroys), and verifies.
3. Telemetry fires the whole way (dispatch / state / gate / sortie) into `sxtn-ops`
   — launch under `op run --env-file=.sxtn/ops.env` so events are tagged `project=smartout`.

---

## Run the pipe

```bash
# 1. (first time only) brownfield foundation + backend reuse-map
bash ${CLAUDE_PLUGIN_ROOT}/bin/sxtn-backend-reuse-map.sh .

# 2. ingest the dropped design (dry-run first to preview writes)
bash ${CLAUDE_PLUGIN_ROOT}/bin/sxtn-design-ingest.sh . --dry-run
bash ${CLAUDE_PLUGIN_ROOT}/bin/sxtn-design-ingest.sh .

# 3. drive it page-by-page onto apps/web + apps/mobile (telemetry live)
op run --env-file=.sxtn/ops.env -- claude   # then: dispatch the sxtn-refactor-driver
```

Ingest writes → `.sxtn/feature-index.yaml`, `docs/domains/<domain>/design/`,
`docs/domains/<domain>/DESIGN-SPEC.md`, then empties this folder.

---

## Quick checklist before you drop

- [ ] One `.jsx` per page, named `<domain>-<page>.jsx`
- [ ] Matching `<domain>-<page>.css` + `<domain>-data.js` where the page needs them
- [ ] Domains match existing SmartOut domains where possible
- [ ] (brownfield) a `## Routes & status` table with surfaces + status per page
- [ ] Master copy kept elsewhere (this folder empties on ingest)
