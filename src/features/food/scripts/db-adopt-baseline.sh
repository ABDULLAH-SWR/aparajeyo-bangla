#!/usr/bin/env bash
# Run ONCE per pre-existing environment, before the first `dbmate up`: records the baseline as applied
# without executing it, then applies every later migration (Guide Appendix A.1).
# PSQL and DBMATE override the client binaries.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
read -r -a psql_cmd <<<"${PSQL:-psql}"
"${psql_cmd[@]}" "${DATABASE_URL_OWNER:?required}" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (version varchar(128) PRIMARY KEY);
INSERT INTO schema_migrations (version) VALUES ('0001') ON CONFLICT DO NOTHING;
SQL
"${DBMATE:-dbmate}" --url "$DATABASE_URL_OWNER" --migrations-dir db/migrations --no-dump-schema up --strict
