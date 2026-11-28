#!/usr/bin/env bash
# Runs a test suite repeatedly and fails on the first red run (Guide §7.3 Slice 1.11).
#   flake-gate.sh RUNS COMMAND [ARG...]
# A failure means nondeterminism to fix at its source. Nothing here retries.
set -euo pipefail
if [[ $# -lt 2 || ! $1 =~ ^[1-9][0-9]*$ ]]; then
  echo "usage: flake-gate.sh RUNS COMMAND [ARG...]" >&2
  exit 2
fi
runs=$1
shift
for ((run = 1; run <= runs; run++)); do
  echo "flake-gate: run $run of $runs: $*"
  if ! "$@"; then
    echo "flake-gate: run $run of $runs failed" >&2
    exit 1
  fi
done
echo "flake-gate: $runs of $runs runs passed"
