# API Visibility and Release Profiles

> Control what API docs/functions are visible per release stage.
> Last updated: 2026-02-28

---

## Why this exists

You asked for easy hide/show controls so documentation can be safely reduced for go-live.

This system gives you:

- a single visibility manifest (`api-visibility.profiles.json`),
- profile-based generated specs (`internal`, `partner`, `public`, `go-live`),
- and predictable filtering without editing endpoint docs manually.

---

## Source files

- Canonical spec: `docs/reference/openapi.smartout.v1.yaml`
- Visibility manifest: `docs/reference/api-visibility.profiles.json`
- Generator script: `scripts/api-docs/build-openapi-profile.mjs`

---

## Profiles

| Profile    | Intended audience             | Planned endpoints included | Visibility allowed                    |
| ---------- | ----------------------------- | -------------------------- | ------------------------------------- |
| `internal` | Smartout engineering/product  | Yes                        | `internal`, `partner`, `public`       |
| `partner`  | Selected integration partners | No                         | `partner`, `public`                   |
| `public`   | External customers/developers | No                         | `public`                              |
| `go-live`  | Production public launch set  | No                         | `public` + explicit operation toggles |

---

## Commands

Generate profile specs:

```bash
pnpm api:docs:internal
pnpm api:docs:partner
pnpm api:docs:public
pnpm api:docs:go-live
```

Or custom:

```bash
pnpm api:docs:profile --profile go-live --output docs/reference/openapi.custom.yaml
```

---

## How to hide/show endpoints

Edit `docs/reference/api-visibility.profiles.json`:

1. Locate operation by `operationId`.
2. Set `visibility` to `internal`, `partner`, or `public`.
3. Toggle profile-specific state in `enabled`.

Example:

```json
{
  "operations": {
    "getReadinessSummary": {
      "visibility": "public",
      "enabled": { "go-live": true }
    }
  }
}
```

Then regenerate:

```bash
pnpm api:docs:go-live
```

---

## CI guardrail (enabled)

CI now enforces go-live spec consistency:

- Workflow job: `API Docs Go-Live Guard`
- Command: `pnpm api:docs:verify-go-live`
- Behavior: regenerates `openapi.smartout.go-live.yaml` and fails if committed file differs.

This prevents accidental publication drift between source spec + visibility manifest and go-live artifact.

---

## Release workflow recommendation

1. Keep working docs in `internal` profile.
2. Before staging demo, generate `partner` profile.
3. Before production launch, generate `go-live` profile.
4. Publish only the generated go-live spec/docs externally.

---

## Safety rules

- Never mark internal admin endpoints as `public`.
- Keep auth and webhook internals hidden from go-live profile unless intentionally exposed.
- Treat planned endpoints as hidden for public/go-live until implementation and verification are complete.
