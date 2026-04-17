#!/usr/bin/env bash
# PostToolUse hook: run turbo-cached typecheck after edits to TS/JS files.
# asyncRewake in settings.json means this runs in background and wakes the
# model on exit 2 (typecheck failure). Exit 0 = silent success.
set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Skip if no file_path or not TypeScript/JavaScript
[[ -z "$file_path" ]] && exit 0
[[ ! "$file_path" =~ \.(tsx?|jsx?|mjs|cjs)$ ]] && exit 0

cd /home/sxtnl/dev/smartout.ai

if out=$(pnpm typecheck 2>&1); then
  exit 0
else
  echo "$out" | tail -40 >&2
  exit 2
fi
