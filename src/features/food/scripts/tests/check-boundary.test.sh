#!/usr/bin/env bash
# Food-only path guard (Guide §7.3 Slice 1.10). Run: bun run test:scripts
# Each case commits to a branch of a throwaway repository.
set -uo pipefail
script=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/check-boundary.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; echo "$out" | head -20; failures=$((failures + 1)); }

repo_git() {
  git -C "$work/repo" -c user.name=test -c user.email=test@example.invalid -c core.autocrlf=false "$@"
}

write() { # path
  mkdir -p "$work/repo/$(dirname "$1")"
  echo "$1" >>"$work/repo/$1"
}

commit() { repo_git add -A && repo_git commit -qm change; }

# A repository whose main holds one teammate file and one Food file, checked out on a new branch.
fresh() {
  rm -rf "$work/repo"
  git init -q -b main "$work/repo"
  write src/components/map/Map.tsx
  write src/features/food/index.ts
  commit
  repo_git checkout -qb food-change
}

check() { # [base]
  out=$(cd "$work/repo" && bash "$script" "${1:-main}" 2>&1)
  status=$?
}

fresh
write src/components/map/AnyFile.tsx
commit
check
if [[ $status -eq 1 && "$out" == *src/components/map/AnyFile.tsx* ]]; then
  pass "c1 a change to a teammate UI file exits 1 and names it"
else
  fail "c1 expected exit 1 naming the file, got exit $status"
fi

fresh
write src/features/food/api/app.ts
write .github/workflows/food.yml
commit
check
if [[ $status -eq 0 ]]; then
  pass "c2 changes under src/features/food and to its workflow pass"
else
  fail "c2 expected exit 0, got exit $status"
fi

fresh
repo_git mv src/components/map/Map.tsx src/features/food/Map.tsx
commit
check
if [[ $status -eq 1 && "$out" == *src/components/map/Map.tsx* ]]; then
  pass "c3 moving a teammate file into the Food folder exits 1 and names its old path"
else
  fail "c3 expected exit 1 naming the old path, got exit $status"
fi

fresh
write src/components/map/AnyFile.tsx
commit
check origin/missing
if [[ $status -ne 0 ]]; then
  pass "c4 a base that cannot be compared with fails the check"
else
  fail "c4 expected a failure for an unknown base, got exit $status"
fi

exit $((failures > 0))
