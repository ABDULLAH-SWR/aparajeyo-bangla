// The servers of docker-compose.test.yml. Fixed on purpose: no environment variable can point the
// tests, which create databases and flush Valkey, at a developer's own stack.
export const USE_COMPOSE = process.env.FOOD_TEST_USE_COMPOSE === "1";
export const COMPOSE_PG_URL = "postgresql://food@127.0.0.1:55432/postgres?sslmode=disable";
export const COMPOSE_VALKEY_URL = "redis://127.0.0.1:56379/0";

// The images of that file's services; testcontainers starts the same ones. The tags must stay equal
// there, and the postgis tag in scripts/test-migrations.sh too.
export const POSTGIS_IMAGE = "postgis/postgis:17-3.5";
export const VALKEY_IMAGE = "valkey/valkey:8.1-alpine";
