#!/usr/bin/env bash
# PostToolUse hook: run scoped typecheck after edits to TS/JS files.
# asyncRewake in settings.json means this runs in background and wakes the
# model on exit 2 (typecheck failure). Exit 0 = silent success.
#
# Scope-fix 2026-04-24: previously ran `pnpm typecheck` repo-wide, which
# fails on ANY unrelated merge-conflict marker in the monorepo (e.g. when
# another session has an in-progress merge in a sibling worktree). Now
# scopes to the package containing the edited file, if detectable.
set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Skip if no file_path or not TypeScript/JavaScript
[[ -z "$file_path" ]] && exit 0
[[ ! "$file_path" =~ \.(tsx?|jsx?|mjs|cjs)$ ]] && exit 0

# Skip docs, tests, migrations, generated types — typecheck is cheap noise
[[ "$file_path" =~ \.d\.ts$ ]] && exit 0
[[ "$file_path" =~ database\.types\.ts$ ]] && exit 0
[[ "$file_path" =~ /docs/ ]] && exit 0

# Skip agent-isolation worktrees (.claude/worktrees/agent-*) — these are
# transient sub-agent scratchpads; the agent owns its own typecheck discipline
# and will self-report. Blocking the parent on intermediate state is noise.
[[ "$file_path" =~ \.claude/worktrees/ ]] && exit 0

# Skip test files — they often touch WIP state during sortie work; CI catches
# the final state. Only production TS under src/ (non-__tests__) triggers.
[[ "$file_path" =~ /__tests__/ ]] && exit 0
[[ "$file_path" =~ \.test\.tsx?$ ]] && exit 0
[[ "$file_path" =~ \.spec\.tsx?$ ]] && exit 0

# Detect which worktree + package contains the edited file.
# Walk up from file dir until we find a package.json with a name field.
file_dir=$(dirname "$file_path")
pkg_dir=""
current="$file_dir"
while [[ "$current" != "/" && "$current" != "$HOME" ]]; do
  if [[ -f "$current/package.json" ]] && grep -q '"name"' "$current/package.json" 2>/dev/null; then
    pkg_dir="$current"
    break
  fi
  current=$(dirname "$current")
done

# No package found → silent skip (not worth blocking)
[[ -z "$pkg_dir" ]] && exit 0

# Find the workspace root (has pnpm-workspace.yaml or turbo.json)
root="$pkg_dir"
while [[ "$root" != "/" && "$root" != "$HOME" ]]; do
  if [[ -f "$root/pnpm-workspace.yaml" || -f "$root/turbo.json" ]]; then
    break
  fi
  root=$(dirname "$root")
done

# No workspace root → silent skip
[[ ! -f "$root/pnpm-workspace.yaml" && ! -f "$root/turbo.json" ]] && exit 0

# Extract package name from its package.json
pkg_name=$(grep '"name"' "$pkg_dir/package.json" | head -1 | sed -E 's/.*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')

# Skip if we couldn't parse a name
[[ -z "$pkg_name" ]] && exit 0

cd "$root"

# Scoped typecheck — only the package that owns the edited file.
# Much faster, and doesn't fail on unrelated conflict markers elsewhere.
if out=$(pnpm --filter "$pkg_name" typecheck 2>&1); then
  exit 0
else
  echo "Scoped typecheck failed for $pkg_name (edited: $file_path):" >&2
  echo "$out" | tail -30 >&2
  exit 2
fi
