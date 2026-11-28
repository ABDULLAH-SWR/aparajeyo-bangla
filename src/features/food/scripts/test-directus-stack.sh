#!/usr/bin/env bash
# A throwaway stack for the Directus tests (S8): the real services of docker-compose.yml under their
# own project name, with random secrets, random loopback ports and a private internal subnet.
#
#   test-directus-stack.sh up <project>               starts postgres and valkey, prints NAME=value
#   test-directus-stack.sh roles <project>            runs db-bootstrap-roles.sh (after dbmate up)
#   test-directus-stack.sh start <project>            starts Directus and the API, prints their URLs
#   test-directus-stack.sh psql <project> <args...>   runs psql in the database container
#   test-directus-stack.sh directus <project> <args...>  runs the Directus CLI in its container
#   test-directus-stack.sh export <project>           prints a fresh Directus schema snapshot
#   test-directus-stack.sh config <project>           prints the compose configuration as JSON
#   test-directus-stack.sh logs <project> <service>   prints a service's recent log lines
#   test-directus-stack.sh down <project>             removes containers, networks and volumes
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Git Bash with Docker only inside WSL: run this script there. Ports are reachable on localhost.
if ! command -v docker >/dev/null 2>&1 && command -v wsl.exe >/dev/null 2>&1; then
  windows_dir=$(pwd -W) # C:/dev/...
  drive=${windows_dir:0:1}
  MSYS_NO_PATHCONV=1 exec wsl.exe -d "${FOOD_WSL_DISTRO:-Ubuntu}" -- \
    bash "/mnt/${drive,,}${windows_dir:2}/scripts/test-directus-stack.sh" "$@"
fi

action=${1:?usage: test-directus-stack.sh up|roles|start|psql|directus|export|config|logs|down <project>}
project=${2:?project name}
shift 2
# `down -v` deletes volumes, so only names made for tests are accepted.
[[ "$project" =~ ^food-directus-test-[a-z0-9-]+$ ]] ||
  { echo "project must start with food-directus-test-" >&2; exit 2; }
env_file="/tmp/$project.env"

compose() {
  # env -i: an exported variable of the caller must not override the throwaway values.
  env -i PATH="$PATH" HOME="${HOME:-/tmp}" ${DOCKER_HOST:+DOCKER_HOST="$DOCKER_HOST"} \
    docker compose -p "$project" --env-file "$env_file" -f docker-compose.yml "$@"
}
setting() { sed -n "s/^$1=//p" "$env_file"; }
port_of() { local address; address=$(compose port "$1" "$2"); echo "${address##*:}"; }
wait_for() { # service, command...
  local service=$1
  shift
  for _ in $(seq 1 180); do
    "$@" >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "test-directus-stack: $service did not become ready" >&2
  compose logs --tail 60 "$service" >&2
  return 1
}

write_env() {
  local secret
  secret() { openssl rand -hex 32; }
  (
    umask 077
    for name in IMGPROXY_KEY IMGPROXY_SALT GARAGE_RPC_SECRET GARAGE_ADMIN_TOKEN POSTGRES_PASSWORD \
      FOOD_API_DB_PASSWORD FOOD_WORKER_DB_PASSWORD DIRECTUS_DB_PASSWORD DIRECTUS_SECRET \
      DIRECTUS_ADMIN_PASSWORD FOOD_INVALIDATE_TOKEN S3_IMGPROXY_ACCESS_KEY S3_IMGPROXY_SECRET_KEY; do
      echo "$name=$(secret)"
    done
    echo "DIRECTUS_ADMIN_EMAIL=admin@example.com"
    echo "S3_REGION=food-test-1"
    echo "FOOD_CONTAINER_PREFIX=$project"
    # Not the dev subnet, and random so that two runs rarely collide.
    echo "FOOD_INTERNAL_PREFIX=10.213.$((RANDOM % 254 + 1))"
    # Port 0: Docker picks a free one.
    for name in FOOD_PG_PORT FOOD_VALKEY_PORT FOOD_DIRECTUS_PORT FOOD_API_PORT; do echo "$name=0"; done
  ) >"$env_file"
}

database_url() { # host:port
  echo "postgresql://food:$(setting POSTGRES_PASSWORD)@$1/aparajeyo_food?sslmode=disable"
}

case $action in
  up)
    write_env
    compose up -d postgres valkey >&2
    # Over TCP: the temporary server that runs during first-time setup listens on a socket only.
    wait_for postgres compose exec -T postgres pg_isready -h 127.0.0.1 -U food
    wait_for valkey compose exec -T valkey valkey-cli ping
    echo "DATABASE_URL_OWNER=$(database_url "127.0.0.1:$(port_of postgres 5432)")"
    echo "VALKEY_URL=redis://127.0.0.1:$(port_of valkey 6379)/0"
    for name in DIRECTUS_DB_PASSWORD DIRECTUS_ADMIN_EMAIL DIRECTUS_ADMIN_PASSWORD FOOD_INVALIDATE_TOKEN; do
      echo "$name=$(setting "$name")"
    done
    ;;
  roles)
    DATABASE_URL_OWNER=$(database_url 127.0.0.1:5432) \
      PSQL="bash scripts/test-directus-stack.sh psql $project" \
      FOOD_API_DB_PASSWORD=$(setting FOOD_API_DB_PASSWORD) \
      FOOD_WORKER_DB_PASSWORD=$(setting FOOD_WORKER_DB_PASSWORD) \
      DIRECTUS_DB_PASSWORD=$(setting DIRECTUS_DB_PASSWORD) \
      bash scripts/db-bootstrap-roles.sh >&2
    ;;
  start)
    compose up -d --build directus food-api >&2
    directus="http://127.0.0.1:$(port_of directus 8055)"
    api="http://127.0.0.1:$(port_of food-api 8002)"
    wait_for directus curl -fsS "$directus/server/ping"
    wait_for food-api curl -fsS "$api/api/v1/food/health"
    echo "DIRECTUS_URL=$directus"
    echo "FOOD_API_URL=$api"
    # directus-bootstrap.ts defaults to the dev subnet; this stack has its own.
    echo "FOOD_INVALIDATE_URL=http://$(setting FOOD_INTERNAL_PREFIX).10:8003/internal/v1/cache/invalidate"
    ;;
  psql) compose exec -T postgres psql "$@" ;;
  directus) compose exec -T directus node cli.js "$@" ;;
  export) # a fresh schema snapshot, on stdout
    compose exec -T directus sh -c 'node cli.js schema snapshot --yes /tmp/export.yaml >&2 && cat /tmp/export.yaml'
    ;;
  config) compose config --format json ;;
  logs) compose logs --no-log-prefix --tail 200 "$@" ;;
  down)
    [[ -f "$env_file" ]] || exit 0
    compose down -v --remove-orphans --rmi local >&2
    rm -f "$env_file"
    ;;
  *) echo "unknown action: $action" >&2; exit 2 ;;
esac
