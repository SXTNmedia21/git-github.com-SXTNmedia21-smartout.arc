#!/usr/bin/env bash
# ============================================
# playwright-with-libs.sh
# Ensures Playwright Linux runtime libraries are available
# without requiring sudo, then executes Playwright command.
#
# Why: some environments (WSL/containers) miss browser .so deps
# like libnspr4/libnss3, which crashes Chromium launch.
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
LIB_BASE="${REPO_ROOT}/.local/pw-libs"
LIB_ROOTFS="${LIB_BASE}/rootfs"
LIB_DIR_A="${LIB_ROOTFS}/usr/lib/x86_64-linux-gnu"
LIB_DIR_B="${LIB_ROOTFS}/lib/x86_64-linux-gnu"

normalize_ci_mode() {
  # Some local shells inherit CI=1 even outside a real CI provider.
  # Playwright changes reporters, retries, and worker count when CI is set,
  # so normalize to local mode unless a concrete CI vendor signal is present.
  if [[ -z "${CI:-}" ]]; then
    return
  fi

  if [[ -n "${GITHUB_ACTIONS:-}" || -n "${BUILDKITE:-}" || -n "${CIRCLECI:-}" || -n "${GITLAB_CI:-}" || -n "${JENKINS_URL:-}" || -n "${TF_BUILD:-}" || -n "${TEAMCITY_VERSION:-}" ]]; then
    return
  fi

  unset CI
}

bootstrap_local_supabase_env() {
  if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    return
  fi

  local status_output=""

  if ! status_output="$(
    npx supabase status -o env \
      --workdir "${REPO_ROOT}" \
      --override-name api.url=SUPABASE_URL \
      --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY \
      2>/dev/null
  )"; then
    cat >&2 <<'EOF'
Local Playwright bootstrap could not read Supabase status.
Start the local Supabase stack with `npx supabase start`, or set
SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running Playwright.
EOF
    exit 1
  fi

  # The CLI prints warnings and status notes before env assignments.
  # Extract only the two variables Playwright seed helpers require.
  SUPABASE_URL="$(
    printf '%s\n' "${status_output}" |
      sed -n 's/^SUPABASE_URL="\([^"]*\)"$/\1/p'
  )"
  SUPABASE_SERVICE_ROLE_KEY="$(
    printf '%s\n' "${status_output}" |
      sed -n 's/^SUPABASE_SERVICE_ROLE_KEY="\([^"]*\)"$/\1/p'
  )"

  if [[ -z "${SUPABASE_URL}" || -z "${SUPABASE_SERVICE_ROLE_KEY}" ]]; then
    cat >&2 <<'EOF'
Local Supabase did not return the required Playwright env values.
Run `npx supabase status` to confirm the local stack is healthy, or
set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY manually.
EOF
    exit 1
  fi

  export SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
}

ensure_local_e2e_fixture() {
  node "${SCRIPT_DIR}/ensure-local-e2e-fixture.mjs"
}

ensure_local_libs() {
  if [[ -f "${LIB_DIR_A}/libnspr4.so" && -f "${LIB_DIR_A}/libnss3.so" ]]; then
    return
  fi

  mkdir -p "${LIB_BASE}" "${LIB_ROOTFS}"
  pushd "${LIB_BASE}" >/dev/null

  local packages=(
    libnss3
    libnspr4
    libatk1.0-0
    libatk-bridge2.0-0
    libcups2
    libdrm2
    libdbus-1-3
    libatspi2.0-0
    libxcomposite1
    libxdamage1
    libxfixes3
    libxrandr2
    libgbm1
    libxkbcommon0
    libpango-1.0-0
    libcairo2
    libasound2t64
    libasound2
    libgtk-3-0
    libx11-6
    libxcb1
    libxext6
    libxshmfence1
    libxrender1
    libx11-xcb1
    libxcursor1
    libxi6
    libxtst6
    libxss1
    libglib2.0-0
    libfontconfig1
    libfreetype6
    libexpat1
    libuuid1
    libpci3
    libwayland-client0
    libwayland-egl1
    libwayland-server0
  )

  for package_name in "${packages[@]}"; do
    apt download "${package_name}" >/dev/null 2>&1 || true
  done

  shopt -s nullglob
  local deb_file
  for deb_file in ./*.deb; do
    dpkg-deb -x "${deb_file}" "${LIB_ROOTFS}"
  done
  shopt -u nullglob

  popd >/dev/null
}

prepend_ld_library_path() {
  local existing="${LD_LIBRARY_PATH:-}"
  if [[ -n "${existing}" ]]; then
    export LD_LIBRARY_PATH="${LIB_DIR_A}:${LIB_DIR_B}:${existing}"
  else
    export LD_LIBRARY_PATH="${LIB_DIR_A}:${LIB_DIR_B}"
  fi
}

main() {
  normalize_ci_mode
  bootstrap_local_supabase_env
  ensure_local_e2e_fixture
  ensure_local_libs
  prepend_ld_library_path
  exec env \
    CI="${CI:-}" \
    SUPABASE_URL="${SUPABASE_URL:-}" \
    SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}" \
    "$@"
}

main "$@"
