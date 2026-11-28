#!/usr/bin/env bash
# up -> roll back every migration -> up, on a fresh PostGIS container (Guide §7.4).
# Needs Docker. It takes no database URL on purpose: rolling back drops every Food table, so it only
# ever runs against the container it starts itself. DBMATE overrides the client binary.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
dbmate_bin=${DBMATE:-dbmate}
image=postgis/postgis:17-3.5 # must equal the compose `postgres` image tag

command -v "$dbmate_bin" >/dev/null || { echo "test-migrations: $dbmate_bin is not installed" >&2; exit 2; }

# No password to commit. Safe only because the port is bound to loopback.
container=$(docker run -d --rm -e POSTGRES_USER=food -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p 127.0.0.1::5432 "$image")
trap 'docker rm -f "$container" >/dev/null' EXIT

# Over TCP: the temporary server that runs during first-time setup listens on a socket only.
for ((attempt = 1; ; attempt++)); do
  docker exec "$container" pg_isready -h 127.0.0.1 -U food >/dev/null 2>&1 && break
  ((attempt < 60)) || { echo "test-migrations: PostgreSQL did not start" >&2; exit 1; }
  sleep 1
done
address=$(docker port "$container" 5432/tcp | head -n1)

migrate() {
  "$dbmate_bin" --url "postgresql://food@$address/food_migrations?sslmode=disable" \
    --migrations-dir db/migrations --no-dump-schema "$@"
}

versions=(db/migrations/*.sql)
echo "test-migrations: up"
migrate up --strict
for ((left = ${#versions[@]}; left > 0; left--)); do
  migrate rollback
done
applied=$(docker exec "$container" psql -U food -d food_migrations -tAc 'SELECT count(*) FROM schema_migrations')
[[ $applied == 0 ]] || { echo "test-migrations: $applied migrations survived the rollback" >&2; exit 1; }
echo "test-migrations: up again"
migrate up --strict
echo "test-migrations: ok (${#versions[@]} migrations)"
