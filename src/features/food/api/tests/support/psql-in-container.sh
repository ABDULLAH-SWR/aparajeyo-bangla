#!/usr/bin/env bash
# psql stand-in for hosts without a Postgres client: runs psql inside the database container.
# Usage matches psql, with the connection URL as the first argument. Stdin is forwarded.
set -euo pipefail
export MSYS_NO_PATHCONV=1
container=${FOOD_TEST_PG_CONTAINER:-aparajeyo-food-postgres}
# Inside the container the server listens on 5432, whatever port the host publishes.
url=$(printf '%s' "$1" | sed -E 's#@[^/@]+/#@127.0.0.1:5432/#')
shift
if command -v docker >/dev/null 2>&1; then
  exec docker exec -i "$container" psql "$url" "$@"
fi
exec wsl.exe -d "${FOOD_TEST_WSL_DISTRO:-Ubuntu}" -- docker exec -i "$container" psql "$url" "$@"
