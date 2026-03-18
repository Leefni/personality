#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

JS_FILES=(
  "$ROOT_DIR/assets/app.js"
)

while IFS= read -r -d '' file; do
  JS_FILES+=("$file")
done < <(find "$ROOT_DIR/assets/js" -maxdepth 1 -type f -name '*.js' -print0 | sort -z)

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required for frontend syntax checks." >&2
  exit 1
fi

for file in "${JS_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing JavaScript file: $file" >&2
    exit 1
  fi

  node --check "$file"
done

echo "Frontend JavaScript syntax check passed for assets/app.js and assets/js/*.js"
