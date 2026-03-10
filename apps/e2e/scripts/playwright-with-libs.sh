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
  ensure_local_libs
  prepend_ld_library_path
  exec "$@"
}

main "$@"
