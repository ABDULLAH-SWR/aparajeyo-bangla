#!/usr/bin/env bash
# Compliance grep (Guide Appendix F.4). Run: bun run test:scripts. Needs ripgrep.
# The planted strings are assembled at run time, so this file does not trip the grep itself.
set -uo pipefail
script=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/compliance-grep.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; echo "$out" | head -20; failures=$((failures + 1)); }

fresh() {
  rm -rf "$work/food"
  mkdir -p "$work/food/scripts" "$work/food/api" "$work/food/workers"
  cp "$script" "$work/food/scripts/"
  echo "export const ok = true;" >"$work/food/api/app.ts"
}

check() {
  out=$(bash "$work/food/scripts/compliance-grep.sh" 2>&1)
  status=$?
}

fresh
check
if [[ $status -eq 0 ]]; then
  pass "c1 a tree without forbidden strings passes"
else
  fail "c1 expected exit 0, got exit $status"
fi

fresh
printf 'const url = "https://maps.%s.com/x";\n' googleapis >"$work/food/api/map.ts"
check
if [[ $status -eq 1 && "$out" == *"Google Maps/Places"* ]]; then
  pass "c2 a Google Maps URL exits 1"
else
  fail "c2 expected exit 1, got exit $status"
fi

fresh
mkdir -p "$work/food/workers/tests/unit" "$work/food/api/tests/contract"
printf 'URL = "https://example.invalid/youtube/v3/%s"\n' search >"$work/food/workers/tests/unit/test_harness_strict.py"
printf 'const URL = "https://upload.%s.org/x.jpg";\n' wikimedia >"$work/food/api/tests/contract/mocks.test.ts"
check
if [[ $status -eq 0 ]]; then
  pass "c4 the two tests that prove a string is refused may contain it"
else
  fail "c4 expected exit 0, got exit $status"
fi
cp "$work/food/workers/tests/unit/test_harness_strict.py" "$work/food/workers/other.py"
check
if [[ $status -eq 1 && "$out" == *other.py* && "$out" != *test_harness_strict.py* ]]; then
  pass "c4 the exemption covers those files only"
else
  fail "c4 expected exit 1 naming other.py alone, got exit $status"
fi

fresh
out=$(RIPGREP=ripgrep-that-is-not-installed bash "$work/food/scripts/compliance-grep.sh" 2>&1)
status=$?
if [[ $status -ne 0 ]]; then
  pass "c3 without ripgrep the check fails instead of passing"
else
  fail "c3 expected a failure without ripgrep, got exit 0"
fi

exit $((failures > 0))
