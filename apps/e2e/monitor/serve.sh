#!/usr/bin/env bash
# Serves the protocol monitor dashboard.
# Open http://localhost:3333 in your browser, then run protocols in another terminal.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/../test-results/protocols"
mkdir -p "$RESULTS_DIR"
# Copy dashboard into results dir so it can reference screenshots via relative paths
cp "$SCRIPT_DIR/index.html" "$RESULTS_DIR/monitor.html"
echo "Protocol Monitor: http://localhost:3333/monitor.html"
echo "Watching: $RESULTS_DIR"
npx serve "$RESULTS_DIR" -l 3333 -s --no-clipboard
