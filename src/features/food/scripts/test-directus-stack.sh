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
source scripts/lib/stack.sh
reexec_in_wsl scripts/test-directus-stack.sh "$@"

action=${1:?usage: test-directus-stack.sh up|roles|start|psql|directus|export|config|logs|down <project>}
require_test_project food-directus-test- "${2:?project name}"
shift 2

database_url() { # host:port
  echo "postgresql://food:$(setting POSTGRES_PASSWORD)@$1/aparajeyo_food?sslmode=disable"
}

case $action in
  up)
    # Port 0: Docker picks a free one. The internal subnet is not the dev one, and is random so that
    # two runs rarely collide.
    write_stack_env FOOD_PG_PORT=0 FOOD_VALKEY_PORT=0 FOOD_DIRECTUS_PORT=0 FOOD_API_PORT=0 \
      "FOOD_CONTAINER_PREFIX=$project" "FOOD_INTERNAL_PREFIX=10.213.$((RANDOM % 254 + 1))"
    compose up -d postgres valkey >&2
    # Over TCP: the temporary server that runs during first-time setup listens on a socket only.
    wait_for 180 postgres compose exec -T postgres pg_isready -h 127.0.0.1 -U food
    wait_for 180 valkey compose exec -T valkey valkey-cli ping
    echo "DATABASE_URL_OWNER=$(database_url "127.0.0.1:$(port_of postgres 5432)")"
    echo "VALKEY_URL=redis://127.0.0.1:$(port_of valkey 6379)/0"
    for name in DIRECTUS_DB_PASSWORD DIRECTUS_ADMIN_EMAIL DIRECTUS_ADMIN_PASSWORD FOOD_INVALIDATE_TOKEN \
      FOOD_INTERNAL_PREFIX; do
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
    wait_for 180 directus curl -fsS "$directus/server/ping"
    wait_for 180 food-api curl -fsS "$api/api/v1/food/health"
    echo "DIRECTUS_URL=$directus"
    echo "FOOD_API_URL=$api"
    ;;
  psql) compose exec -T postgres psql "$@" ;;
  directus) compose exec -T directus node cli.js "$@" ;;
  export) # a fresh schema snapshot, on stdout
    compose exec -T directus sh -c 'node cli.js schema snapshot --yes /tmp/export.yaml >&2 && cat /tmp/export.yaml'
    ;;
  config) compose config --format json ;;
  logs) compose logs --no-log-prefix --tail 200 "$@" ;;
  down) stack_down --rmi local ;;
  *) echo "unknown action: $action" >&2; exit 2 ;;
esac
