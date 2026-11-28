#!/usr/bin/env bash
# Enables login for the least-privilege roles of migrations 0010 and 0012. Passwords are set here,
# never in a migration. PSQL overrides the client binary.
set -euo pipefail
read -r -a psql_cmd <<<"${PSQL:-psql}"
"${psql_cmd[@]}" "${DATABASE_URL_OWNER:?required}" -v ON_ERROR_STOP=1 \
  -v api_pw="${FOOD_API_DB_PASSWORD:?required}" -v worker_pw="${FOOD_WORKER_DB_PASSWORD:?required}" \
  -v directus_pw="${DIRECTUS_DB_PASSWORD:?required}" <<'SQL'
ALTER ROLE food_api      WITH LOGIN PASSWORD :'api_pw';
ALTER ROLE food_worker   WITH LOGIN PASSWORD :'worker_pw';
ALTER ROLE directus_food WITH LOGIN PASSWORD :'directus_pw';
SQL
