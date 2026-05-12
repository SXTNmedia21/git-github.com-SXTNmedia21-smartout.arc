---
title: "Three bash output-injection anti-patterns in CI scripts"
id: LEARNING_0218
status: canonical
layer: learning
created: 2026-05-06
updated: 2026-05-06
tags: [learning, bash, ci, scripts, set-e]
---

# Learning-0218: Three bash output-injection anti-patterns in CI scripts

## Reference (for grep)

- 2026-05-05 ci-incident-conductor self-loop incident
- `docs/audits/2026-05-05-ci-pipeline-audit.md` — original incident
- `docs/audits/2026-05-06-ci-pipeline-audit-extended.md` § F-01, F-02
- Memory: `learning_bash_brace_default_trap.md`

## Pattern family

Three bash idioms produce CONCATENATED multi-output instead of single value.
Each masks failures from `set -e` while corrupting downstream parsing.

### Anti-pattern 1 — `${VAR:-{}}`

```bash
CTX="${CTX_JSON:-{}}"   # WRONG: parses as ${CTX_JSON:-{} + literal }
```

Bash parameter expansion takes only the first `}` as the closer. Default
becomes `{` (single brace), trailing `}` is appended to the result. Result
when CTX_JSON has valid JSON: `<json>}` — extra `}` breaks jq.

**Fix:**
```bash
CTX="${CTX_JSON:-}"
[[ -z "$CTX" ]] && CTX="{}"
```

### Anti-pattern 2 — `grep -c "x" file || echo 0`

```bash
count=$(grep -c "pattern" file 2>/dev/null || echo 0)   # WRONG
```

`grep -c` PRINTS `0` on no-match THEN exits 1. The OR-fallback prints
ANOTHER `0`. Result: `count="0\n0"` — multi-line. Subsequent
`$((count + 1))` arithmetic fails with `syntax error in expression`.

**Fix:**
```bash
count=$(grep -c "pattern" file 2>/dev/null || true)
[[ -z "$count" ]] && count=0
```

### Anti-pattern 3 — `cmd | python3 -c '...' || echo "fallback"`

```bash
ESC=$(printf '%s' "$RAW" | python3 -c '...' 2>/dev/null || echo '""')   # WRONG
```

If python3 partially writes before failing, output IS already on stdout.
Fallback `echo` adds more. Result is concatenated garbage. Same class
when piping through any tool that buffers + emits before failure.

**Fix:**
```bash
if command -v python3 >/dev/null 2>&1; then
  ESC=$(printf '%s' "$RAW" | python3 -c '...' 2>/dev/null) || ESC='""'
else
  ESC='""'
fi
```

## Why this matters

All three patterns share: `set -e` + tool-that-prints-on-failure + OR-fallback-that-also-prints. Caught at CI runtime where the failure cascade is visible (jq parse error, arithmetic syntax error, malformed JSON).

The ci-incident-conductor self-loop 2026-05-05 was triggered by Anti-pattern 1 in `log.sh`. Fix 1 unblocked one bug. Anti-pattern 2 was discovered during Anti-pattern 1 audit in `collect.sh`. Anti-pattern 3 was discovered same audit as latent.

## Detection

Pre-commit / CI lint:

```bash
# Forbid VAR:-{} pattern
grep -rE '\$\{[A-Z_]+:-\{\}\}' .github/scripts/

# Forbid grep -c | echo 0
grep -rE 'grep -c .* \|\| echo 0' .github/scripts/

# Forbid cmd | python3 || echo
grep -rE '\| python[0-9]* .* \|\| echo' .github/scripts/
```

## Anti-pattern (meta)

Never silence non-zero exit AND fall back to a fixed value WITH a tool
that already wrote partial output to stdout. Either:

1. Capture exit explicitly via `if/else`, OR
2. Use `|| true` (no fallback output), OR
3. Use a tool that doesn't write on failure (e.g. `wc -l` instead of `grep -c`)

## Related

- ADR-0265 (deployment pipeline)
- L-0066 (gate_action default-allow CVE class — same "silent failure" family)
- Memory: `learning_bash_brace_default_trap.md`, `learning_self_trigger_loop_deployment_status.md`
