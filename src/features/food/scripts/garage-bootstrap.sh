#!/usr/bin/env bash
# Prepares Garage for the media pipeline: cluster layout, the S3_BUCKET bucket, a read+write key
# for the workers and a read-only key for imgproxy. Safe to run again: what exists is left alone.
# The IDs and secrets of newly created keys are printed to stdout as NAME=value lines, this one
# time: store them in the secret manager. GARAGE overrides the garage CLI command; its caller sets
# S3_BUCKET. For the local stack, an unset S3_BUCKET comes from the env files compose reads.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/lib/stack.sh

if [[ -n "${GARAGE:-}" ]]; then
  read -r -a garage_cmd <<<"$GARAGE"
else
  # The local stack.
  reexec_in_wsl scripts/garage-bootstrap.sh
  env_files=()
  [[ -f .env ]] && env_files+=(.env)
  env_files+=(.env.local) # read last, so it wins
  garage_cmd=(docker compose)
  for file in "${env_files[@]}"; do garage_cmd+=(--env-file "$file"); done
  garage_cmd+=(exec -T garage /garage)
  if [[ -z "${S3_BUCKET:-}" ]]; then
    S3_BUCKET=$(sed -n 's/^S3_BUCKET=//p' "${env_files[@]}" | tail -n 1 | tr -d "\r\"'")
  fi
fi

bucket=${S3_BUCKET:?required}

garage() { "${garage_cmd[@]}" "$@" </dev/null; }

# Only a cluster that has never had a layout gets one: an operator's own layout stays.
layout=$(garage layout show)
if grep -q '^Current cluster layout version: 0$' <<<"$layout"; then
  node=$(garage node id -q)
  garage layout assign -z dc1 -c "${GARAGE_CAPACITY:-1G}" "${node%%@*}" >&2
  garage layout apply --version 1 >&2
fi

buckets=$(garage bucket list)
grep -qE "^[[:space:]]+${bucket//./[.]}([[:space:]]|$)" <<<"$buckets" ||
  garage bucket create "$bucket" >&2

# Garage accepts a second key of the same name, so look before creating.
keys=$(garage key list)
create_key() { # key name, variable for the ID, variable for the secret
  local created
  grep -qE "[[:space:]]$1([[:space:]]|$)" <<<"$keys" && return 0
  created=$(garage key create "$1")
  echo "$2=$(sed -n 's/^Key ID: *//p' <<<"$created")"
  echo "$3=$(sed -n 's/^Secret key: *//p' <<<"$created")"
}
create_key food-worker S3_ACCESS_KEY S3_SECRET_KEY
create_key food-imgproxy S3_IMGPROXY_ACCESS_KEY S3_IMGPROXY_SECRET_KEY

garage bucket allow --read --write "$bucket" --key food-worker >&2
garage bucket allow --read "$bucket" --key food-imgproxy >&2
