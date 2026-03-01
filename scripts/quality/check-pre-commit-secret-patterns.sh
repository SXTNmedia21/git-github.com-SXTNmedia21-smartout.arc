#!/usr/bin/env bash
set -euo pipefail

PASS_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

assert_match() {
  local value="$1"
  local pattern="$2"
  local label="$3"
  if printf '%s\n' "$value" | grep -qE "$pattern"; then
    pass "$label"
  else
    fail "$label"
  fi
}

assert_no_match() {
  local value="$1"
  local pattern="$2"
  local label="$3"
  if printf '%s\n' "$value" | grep -qE "$pattern"; then
    fail "$label"
  else
    pass "$label"
  fi
}

echo "Running pre-commit secret-pattern checks..."

pattern="(password|secret|token|api_key|apiKey|API_KEY)[[:space:]]*[=:][[:space:]]*['\"][A-Za-z0-9+/=_-]{20,}['\"]"
smartout_workspace_pattern='smo_sk_(live|test)_[A-Za-z0-9]{20,}'
smartout_service_pattern='smo_svc_(live|test)_[A-Za-z0-9]{20,}'
stripe_secret_pattern='sk_(live|test)_[A-Za-z0-9]{20,}'
jwt_pattern='eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}'

assert_match "secret='abcdefghijklmnopqrstuvwxyz'" "$pattern" "single-quoted secret is detected"
assert_match "secret=\"abcdefghijklmnopqrstuvwxyz\"" "$pattern" "double-quoted secret is detected"
assert_no_match "secret='short'" "$pattern" "short string is not flagged"
assert_match "smo_sk_live_k7HjQ9mXpLqBvZ2wFr5TdN" "$smartout_workspace_pattern" "long Smartout workspace key is detected"
assert_match "smo_svc_test_A1b2C3d4E5f6G7h8J9k0LmN" "$smartout_service_pattern" "long Smartout service key is detected"
assert_no_match "smo_sk_live_a" "$smartout_workspace_pattern" "too-short Smartout workspace key is not flagged"
assert_match "sk_live_12345678901234567890abc" "$stripe_secret_pattern" "Stripe live secret key is detected"
assert_match "sk_test_12345678901234567890abc" "$stripe_secret_pattern" "Stripe test secret key is detected"
assert_match "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.a2V5c2lnbmF0dXJl" "$jwt_pattern" "JWT token format is detected"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

git -C "$tmp_dir" init -q
git -C "$tmp_dir" config user.name "hook-test"
git -C "$tmp_dir" config user.email "hook-test@example.com"

mkdir -p "$tmp_dir/docs" "$tmp_dir/.husky"
cat > "$tmp_dir/foo.ts" <<'EOF'
const ok = true;
EOF
cat > "$tmp_dir/docs/readme.md" <<'EOF'
# docs
EOF
cat > "$tmp_dir/CLAUDE.md" <<'EOF'
# claude
EOF
cat > "$tmp_dir/.husky/pre-commit" <<'EOF'
#!/usr/bin/env sh
EOF

git -C "$tmp_dir" add .
git -C "$tmp_dir" commit -qm "init"

cat > "$tmp_dir/foo.ts" <<'EOF'
const secret = 'abcdefghijklmnopqrstuvwxyz';
EOF
cat > "$tmp_dir/docs/readme.md" <<'EOF'
secret='abcdefghijklmnopqrstuvwxyz'
EOF
cat > "$tmp_dir/CLAUDE.md" <<'EOF'
secret='abcdefghijklmnopqrstuvwxyz'
EOF
cat > "$tmp_dir/.husky/pre-commit" <<'EOF'
secret='abcdefghijklmnopqrstuvwxyz'
EOF

git -C "$tmp_dir" add foo.ts docs/readme.md CLAUDE.md .husky/pre-commit

included_files="$(git -C "$tmp_dir" diff --cached --name-only --diff-filter=d -- . ':!docs/**/*.md' ':!CLAUDE.md' ':!*.md' ':!.husky/*')"

if [ "$included_files" = "foo.ts" ]; then
  pass "pathspec keeps code files and excludes docs/husky markdown"
else
  echo "Unexpected file list from pathspec:" >&2
  echo "$included_files" >&2
  fail "pathspec filter behavior"
fi

echo "All checks passed ($PASS_COUNT assertions)."
