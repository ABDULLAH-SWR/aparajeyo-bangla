#!/usr/bin/env bash
# Vendored contract drift (Guide §7.3 Slice 1.3). Run: bun run test:scripts
# Each case works on a throwaway copy of the vendored files and of the contract checkout.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
real_contract=$(cd "${CONTRACT_DIR:-../../../../Aparajeyo_Doc/Documentaion/contracts/food_map}" && pwd) || exit 1
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; echo "$out" | head -20; failures=$((failures + 1)); }

fresh() {
  rm -rf "$work/food" "$work/contract"
  mkdir -p "$work/food/scripts" "$work/food/testdata" "$work/contract"
  cp scripts/sync-contract.sh "$work/food/scripts/"
  cp types.ts contract.lock "$work/food/"
  cp -r testdata/contract_mocks "$work/food/testdata/"
  cp -r "$real_contract/types.ts" "$real_contract/mocks" "$work/contract/"
}

check() {
  out=$(CONTRACT_DIR="$work/contract" bash "$work/food/scripts/sync-contract.sh" --check 2>&1)
  status=$?
}

# c1: one changed character in the vendored types fails with a unified diff.
fresh
sed -i '0,/food_poi/s//food_pox/' "$work/food/types.ts"
check
if [[ $status -eq 1 && "$out" == *$'\n@@ '* && "$out" == *'+'*food_pox* && "$out" == *'-'*food_poi* ]]; then
  pass "c1 a one-character edit to the vendored types.ts exits 1 with a unified diff"
else
  fail "c1 expected exit 1 and a unified diff, got exit $status"
fi

# c2: an untouched copy passes, so c1 fails because of the edit and not for some other reason.
fresh
check
if [[ $status -eq 0 ]]; then
  pass "c2 vendored files that match the contract and contract.lock pass"
else
  fail "c2 expected exit 0, got exit $status"
fi

# c3: a file that matches the contract but not the lock was vendored without the sync script.
fresh
sed -i '0,/food_poi/s//food_pox/' "$work/food/types.ts"
cp "$work/food/types.ts" "$work/contract/types.ts"
check
if [[ $status -eq 1 && "$out" == *"types.ts"*"contract.lock"* ]]; then
  pass "c3 a sha256 that differs from contract.lock exits 1 and names the file"
else
  fail "c3 expected exit 1 naming types.ts and contract.lock, got exit $status"
fi

# c4: a mock added to or removed from the contract is drift too.
fresh
echo '{}' >"$work/contract/mocks/food_new.json"
check
if [[ $status -eq 1 && "$out" == *food_new.json* ]]; then
  pass "c4 a mock that exists only in the contract exits 1"
else
  fail "c4 added mock: expected exit 1 naming it, got exit $status"
fi
fresh
rm "$work/contract/mocks/food_pin_detail_minimal.json"
check
if [[ $status -eq 1 && "$out" == *food_pin_detail_minimal.json*$'
@@ '* ]]; then
  pass "c4 a mock that exists only in the vendored copy exits 1 with a unified diff"
else
  fail "c4 removed mock: expected exit 1 with a diff, got exit $status"
fi

# c5: running without --check repairs every kind of drift.
fresh
sed -i '0,/food_poi/s//food_pox/' "$work/food/types.ts"
echo '{}' >"$work/contract/mocks/food_new.json"
rm "$work/contract/mocks/food_pin_detail_minimal.json"
out=$(CONTRACT_DIR="$work/contract" bash "$work/food/scripts/sync-contract.sh" 2>&1)
check
if [[ $status -eq 0 && -f "$work/food/testdata/contract_mocks/food_new.json" &&
  ! -e "$work/food/testdata/contract_mocks/food_pin_detail_minimal.json" ]]; then
  pass "c5 a sync copies new mocks, drops removed ones and leaves --check green"
else
  fail "c5 expected a clean check after sync, got exit $status"
fi

exit $((failures > 0))
