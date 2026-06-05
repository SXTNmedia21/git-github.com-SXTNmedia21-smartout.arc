---
topic: op-headless-service-account
status: active
updated: 2026-05-31T16:30:00Z
created: 2026-05-31T00:00:00Z
supersedes:
---

# Decision lesson — op-headless-service-account

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

When a wrapper must resolve `op://` secrets non-interactively from inside Claude's Bash tool,
the **only** reliable path is a 1Password **service-account token** exported in the user's shell
profile (`~/.bashrc`: `export OP_SERVICE_ACCOUNT_TOKEN=...`). An interactive `op signin` /
`eval $(op signin)` in the user's terminal **does not work**: each Bash tool call spawns a fresh
shell that only sources the profile, so the `OP_SESSION_<account>` token (scoped to the user's
terminal env, 30-min TTL) never reaches Claude. For one-off checks the alternative is the user
running `bin/sxtn-db.sh` in their own signed-in terminal and pasting output back.

## Why

`op` needs an interactive TTY to prompt for a password — Claude's `!`-bash and the Bash tool have
no TTY (`inappropriate ioctl for device`). And even a successful interactive signin stores its
session token only in that terminal's environment, which Claude's fresh per-call shells never
inherit. A service-account token placed in the profile is the canonical headless-1Password pattern:
the Bash tool inherits it via profile-sourcing, `op run` resolves secrets at runtime, and the token
itself never enters AI context (the wrapper only ever calls `op run`, never reads the token).

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T00:00:00Z — initial: interactive op signin can't reach Claude's Bash tool (fresh shell, no TTY, session-token scoped to user terminal); headless op://-resolution requires OP_SERVICE_ACCOUNT_TOKEN in shell profile, else user runs the wrapper themselves.
- 2026-05-31T16:30:00Z — per-project token gap: tokens are cwd-scoped in ~/.profile (`load_op_token` only matches `*/flex-os*`, reading ~/.config/op/<slug>-token). Starting SmartOut's `dev:web` (`op run --env-file=.env.template`, 97 op:// refs) is impossible headless — there is NO smartout token on the machine, only flex-os. Blocked tasks that need a project's op secrets when no token exists for that project: either the user drops ~/.config/op/<project>-token + adds a `*/<project>*` case to the loader, or the user runs the op-gated command in their own interactive shell. Don't fake-start an op-gated process that will fail on missing env.
