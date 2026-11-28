#!/usr/bin/env bash
# Vendors the Food <-> Map contract (Guide §7.2). The only way types.ts and testdata/contract_mocks
# change: edit the contract under its Change Rule, then run this.
#   sync-contract.sh          copy types.ts and the mocks, and record their sha256 in contract.lock
#   sync-contract.sh --check  exit 1 if a vendored file differs from the contract
# CONTRACT_DIR is the contract checkout; a relative path starts at the feature root.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
contract=${CONTRACT_DIR:-../../../../Aparajeyo_Doc/Documentaion/contracts/food_map}
[[ -f "$contract/types.ts" ]] || { echo "sync-contract: no contract at $contract (set CONTRACT_DIR)" >&2; exit 2; }

vendored_mocks=testdata/contract_mocks

# Vendored path -> contract path.
source_of() {
  case "$1" in
    "$vendored_mocks"/*) echo "$contract/mocks/${1##*/}" ;;
    *) echo "$contract/$1" ;;
  esac
}

sha() { sha256sum <"$1" | cut -d' ' -f1; }

case "${1:-}" in
  "")
    rm -rf "$vendored_mocks"
    mkdir -p "$vendored_mocks"
    cp "$contract"/mocks/*.json "$vendored_mocks/"
    cp "$contract/types.ts" types.ts
    for file in types.ts "$vendored_mocks"/*.json; do
      echo "$(sha "$file")  $file"
    done >contract.lock
    echo "sync-contract: vendored $(wc -l <contract.lock | tr -d ' ') files"
    ;;
  --check)
    failed=0
    # Every file that the contract, the vendored copy or the lock knows about.
    files=$({
      echo types.ts
      for mock in "$contract"/mocks/*.json "$vendored_mocks"/*.json; do
        [[ -f "$mock" ]] && echo "$vendored_mocks/${mock##*/}"
      done
      awk '{ print $2 }' contract.lock
    } | sort -u)
    for file in $files; do
      source=$(source_of "$file")
      if ! cmp -s "$source" "$file"; then
        # -N shows a file missing on either side as empty.
        diff -uN "$source" "$file" || true
        failed=1
      fi
      locked=$(awk -v file="$file" '$2 == file { print $1 }' contract.lock)
      if [[ ! -f "$file" || "$locked" != "$(sha "$file")" ]]; then
        echo "sync-contract: the sha256 of $file differs from contract.lock" >&2
        failed=1
      fi
    done
    exit "$failed"
    ;;
  *)
    echo "usage: sync-contract.sh [--check]" >&2
    exit 2
    ;;
esac
