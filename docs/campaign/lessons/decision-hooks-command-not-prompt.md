---
topic: decision-hooks-command-not-prompt
status: active
updated: 2026-05-31T20:58:50Z
created: 2026-05-31T20:58:50Z
supersedes:
metadata:
  type: feedback
---

# Decision lesson — decision-hooks-command-not-prompt

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.

---

## Decision

**Stop / PreToolUse decision hooks MUST be `type:command`, never `type:prompt`.** A prompt hook asks a model to emit bare `{"decision":"approve"|"block"}` JSON, but the model reliably leaks analysis prose instead — the harness then renders **"Stop hook error"** on every fire. Replace with a command hook that mirrors `hooks/sxtn-loop-gate.sh`: read stdin JSON, always exit 0, always `printf` clean decision-JSON. Default-approve on ANY uncertainty (no transcript, no jq, parse fail, `stop_hook_active`) so it can never trap the session. Gate blocking behind an opt-in flag (e.g. `.sxtn/self-improve-strict`) — soft `systemMessage` nudge by default, hard `block` only when the project opts in. The self-improve gate is now `hooks/sxtn-self-improve-gate.sh` (command); the old prompt entry in `hooks/hooks.json` Stop[] is removed.

## Why

The `type:prompt` self-improve Stop gate produced "Stop hook error" every turn (prose, not decision-JSON) and spuriously blocked. Pontus: "please fix this hook." Command hooks are deterministic and the plugin already proves the pattern (loop-gate, gate-enforce, self-improve-watch all command-type with clean JSON + exit 0). Detection over the transcript is narrow (rename/refactor/explicit finding-flag) with a per-turn de-dup marker (`.sxtn/.self-improve-acked`) to avoid double-fire, and is satisfied when the turn already invoked sxtn-lesson-capture. **Hooks load at session start — the fix takes effect only after a Claude Code restart.** Relates to [[loop-arms-in-project-not-plugin-source]].

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T20:58:50Z — initial: decision hooks must be command-type (prompt hooks leak prose → "Stop hook error"); default-approve, opt-in strict block; takes effect after session restart.
