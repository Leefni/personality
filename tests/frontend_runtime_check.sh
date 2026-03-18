#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required for frontend runtime checks." >&2
  exit 1
fi

node "$ROOT_DIR/tests/frontend_runtime_flow_test.mjs" case_a
node "$ROOT_DIR/tests/frontend_runtime_flow_test.mjs" case_b
node "$ROOT_DIR/tests/frontend_runtime_flow_test.mjs" case_c
node "$ROOT_DIR/tests/frontend_runtime_flow_test.mjs" case_timeout

echo "Frontend runtime behavior checks passed for load flow edge cases"
