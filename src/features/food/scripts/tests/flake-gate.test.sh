#!/usr/bin/env bash
# Flake gate (Guide §7.3 Slice 1.11). Run: bun run test:scripts
set -uo pipefail
gate=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/flake-gate.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; echo "$out" | head -20; failures=$((failures + 1)); }

# A suite that records each run and fails only on run number $1.
cat >"$work/suite" <<'SUITE'
#!/usr/bin/env bash
echo run >>"$(dirname "$0")/runs"
[[ $(wc -l <"$(dirname "$0")/runs") -ne $1 ]]
SUITE

check() { # gate arguments
  rm -f "$work/runs"
  out=$(bash "$gate" "$@" 2>&1)
  status=$?
  ran=0
  [[ -f "$work/runs" ]] && ran=$(wc -l <"$work/runs" | tr -d ' ')
}

check 10 bash "$work/suite" 3
if [[ $status -ne 0 && $ran -eq 3 ]]; then
  pass "c1 one failing run fails the gate, and nothing is retried"
else
  fail "c1 expected a failure after 3 runs, got exit $status after $ran"
fi

check 10 bash "$work/suite" 0
if [[ $status -eq 0 && $ran -eq 10 ]]; then
  pass "c2 ten green runs pass the gate"
else
  fail "c2 expected exit 0 after 10 runs, got exit $status after $ran"
fi

for arguments in "0 true" "ten true" "10"; do
  # shellcheck disable=SC2086
  check $arguments
  if [[ $status -ne 0 ]]; then
    pass "c3 '$arguments' cannot pass without running anything"
  else
    fail "c3 '$arguments' passed"
  fi
done

exit $((failures > 0))
