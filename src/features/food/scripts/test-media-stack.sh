#!/usr/bin/env bash
# A throwaway Garage + imgproxy for the media tests: the real services of docker-compose.yml under
# their own project name, random secrets and random loopback ports. Used by the Python and Vitest
# suites and by scripts/tests/garage-bootstrap.test.sh.
#
#   test-media-stack.sh up <project> [--garage-only]   starts, bootstraps, prints NAME=value lines
#   test-media-stack.sh garage <project> <args...>     runs the garage CLI in that stack
#   test-media-stack.sh config <project>               prints the compose configuration as JSON
#   test-media-stack.sh down <project>                 removes containers, network and volumes
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Git Bash with Docker only inside WSL: run this script there. Ports are reachable on localhost.
if ! command -v docker >/dev/null 2>&1 && command -v wsl.exe >/dev/null 2>&1; then
  windows_dir=$(pwd -W) # C:/dev/...
  drive=${windows_dir:0:1}
  MSYS_NO_PATHCONV=1 exec wsl.exe -d "${FOOD_WSL_DISTRO:-Ubuntu}" -- \
    bash "/mnt/${drive,,}${windows_dir:2}/scripts/test-media-stack.sh" "$@"
fi

action=${1:?usage: test-media-stack.sh up|garage|config|down <project>}
project=${2:?project name}
shift 2
# `down -v` deletes volumes, so only names made for tests are accepted.
[[ "$project" =~ ^food-media-test-[a-z0-9-]+$ ]] || { echo "project must start with food-media-test-" >&2; exit 2; }
env_file="/tmp/$project.env"

compose() {
  # env -i: an exported variable of the caller must not override the throwaway values.
  env -i PATH="$PATH" HOME="${HOME:-/tmp}" ${DOCKER_HOST:+DOCKER_HOST="$DOCKER_HOST"} \
    docker compose -p "$project" --env-file "$env_file" -f docker-compose.yml "$@"
}
setting() { sed -n "s/^$1=//p" "$env_file"; }
published() { local address; address=$(compose port "$1" "$2"); echo "http://127.0.0.1:${address##*:}"; }
wait_for() { # description, command...
  local what=$1
  shift
  for _ in $(seq 1 60); do
    "$@" >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "test-media-stack: $what did not become ready" >&2
  compose logs --tail 30 >&2
  return 1
}

write_env() {
  local secret
  secret() { openssl rand -hex 32; }
  (
    umask 077
    for name in IMGPROXY_KEY IMGPROXY_SALT GARAGE_RPC_SECRET GARAGE_ADMIN_TOKEN POSTGRES_PASSWORD \
      DIRECTUS_SECRET DIRECTUS_ADMIN_PASSWORD FOOD_INVALIDATE_TOKEN; do
      echo "$name=$(secret)"
    done
    echo "DIRECTUS_ADMIN_EMAIL=admin@example.invalid"
    echo "S3_REGION=food-test-1" # not the dev value: a hard-coded region breaks the signatures
    # Port 0: Docker picks a free one.
    for name in FOOD_S3_PORT FOOD_GARAGE_ADMIN_PORT FOOD_IMGPROXY_PORT; do echo "$name=0"; done
    # Compose interpolates the whole file, so these exist before the bootstrap creates the keys.
    for name in S3_ACCESS_KEY S3_SECRET_KEY S3_IMGPROXY_ACCESS_KEY S3_IMGPROXY_SECRET_KEY; do
      echo "$name=not-yet-created"
    done
  ) >"$env_file"
}

case $action in
  up)
    write_env
    compose up -d garage >&2
    wait_for garage compose exec -T garage /garage status
    if [[ "${1:-}" != --garage-only ]]; then
      keys=$(GARAGE="bash scripts/test-media-stack.sh garage $project" bash scripts/garage-bootstrap.sh)
      while IFS='=' read -r name value; do
        sed -i "s|^$name=.*|$name=$value|" "$env_file"
      done <<<"$keys"
      compose up -d imgproxy >&2
      wait_for imgproxy curl -fsS "$(published imgproxy 8080)/health"
      echo "IMGPROXY_BASE_URL=$(published imgproxy 8080)"
    fi
    echo "S3_ENDPOINT=$(published garage 3900)"
    echo "S3_BUCKET=food-media"
    for name in S3_REGION S3_ACCESS_KEY S3_SECRET_KEY S3_IMGPROXY_ACCESS_KEY S3_IMGPROXY_SECRET_KEY \
      IMGPROXY_KEY IMGPROXY_SALT; do
      echo "$name=$(setting "$name")"
    done
    ;;
  garage) compose exec -T garage /garage "$@" ;;
  config) compose config --format json ;;
  down)
    [[ -f "$env_file" ]] || exit 0
    compose down -v --remove-orphans >&2
    rm -f "$env_file"
    ;;
  *) echo "unknown action: $action" >&2; exit 2 ;;
esac
