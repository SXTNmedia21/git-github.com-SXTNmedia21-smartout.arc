---
topic: confirm-target-before-vault-discovery
status: active
updated: 2026-05-31T12:00:00Z
created: 2026-05-31T12:00:00Z
supersedes:
---

# Decision lesson — confirm-target-before-vault-discovery

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

Never infer which project/database to operate on from whatever credential happens to be
available. Before reading or enumerating any 1Password vault items (`op item list/get`),
explicitly confirm the target with the user. A token being present (e.g. a cwd-scoped
`OP_SERVICE_ACCOUNT_TOKEN` for project X) is NOT permission to treat project X as the target —
the user may mean a different project entirely.

## Why

Given a flex-os service-account token loaded from `~/.config/op/flex-os-token`, the brownfield
DB target was assumed to be flex-os and its `Supabase-flex` vault item was enumerated — but the
real target was SmartOut. Auto-discovering vault contents off an incidental token is both wrong
(operates on the wrong project) and a trust breach (poking around a vault the task never named).
The available credential answers "what _can_ I reach", never "what _should_ I reach" — only the
user's explicit target answers that. Confirm first, discover second.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T12:00:00Z — initial: assumed flex-os was the brownfield target because its op token was loadable + enumerated Supabase-flex; real target was SmartOut. Confirm target before any vault discovery; an available credential is not a target declaration.
