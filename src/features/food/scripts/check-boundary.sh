#!/usr/bin/env bash
# Food PRs touch only src/features/food/** and the Food workflow (Guide §7.3 Slice 1.10).
#   check-boundary.sh [base]   check what HEAD changed since its merge base with `base`
# Run it inside the repository to check. `base` defaults to origin/main.
set -euo pipefail
base=${1:-origin/main}
# A failed diff must fail the check, so it is not piped straight into grep. --no-renames lists both
# sides of a move: a file moved into the Food folder was still removed from where it was.
changed=$(git -c core.quotePath=false diff --name-only --no-renames "$base...HEAD")
outside=$(grep -v -E '^(src/features/food/|\.github/workflows/food\.yml$|$)' <<<"$changed" || true)
if [[ -n "$outside" ]]; then
  echo "Food PR touches files outside src/features/food/**:" >&2
  echo "$outside" >&2
  exit 1
fi
