#!/usr/bin/env bash
# Prepares Garage for the media pipeline: cluster layout, the food-media bucket, a read+write key
# for the workers and a read-only key for imgproxy. Safe to run again: what exists is left alone.
# The IDs and secrets of newly created keys are printed to stdout as NAME=value lines, this one
# time: store them in the secret manager. GARAGE overrides the garage CLI command.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ -n "${GARAGE:-}" ]]; then
  read -r -a garage_cmd <<<"$GARAGE"
else
  # The local stack. Git Bash with Docker only inside WSL: run this script there (see dev-up.sh).
  if ! command -v docker >/dev/null 2>&1 && command -v wsl.exe >/dev/null 2>&1; then
    windows_dir=$(pwd -W)
    drive=${windows_dir:0:1}
    MSYS_NO_PATHCONV=1 exec wsl.exe -d "${FOOD_WSL_DISTRO:-Ubuntu}" --       bash "/mnt/${drive,,}${windows_dir:2}/scripts/garage-bootstrap.sh"
  fi
  garage_cmd=(docker compose)
  [[ -f .env ]] && garage_cmd+=(--env-file .env)
  garage_cmd+=(--env-file .env.local exec -T garage /garage)
fi

garage() { "${garage_cmd[@]}" "$@" </dev/null; }

# Only a cluster that has never had a layout gets one: an operator's own layout stays.
layout=$(garage layout show)
if grep -q '^Current cluster layout version: 0$' <<<"$layout"; then
  node=$(garage node id -q)
  garage layout assign -z dc1 -c "${GARAGE_CAPACITY:-1G}" "${node%%@*}" >&2
  garage layout apply --version 1 >&2
fi

buckets=$(garage bucket list)
grep -qE '^[[:space:]]+food-media([[:space:]]|$)' <<<"$buckets" || garage bucket create food-media >&2

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

garage bucket allow --read --write food-media --key food-worker >&2
garage bucket allow --read food-media --key food-imgproxy >&2
