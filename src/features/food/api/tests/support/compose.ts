// The servers of docker-compose.test.yml. Fixed on purpose: no environment variable can point the
// tests, which create databases and flush Valkey, at a developer's own stack.
export const USE_COMPOSE = process.env.FOOD_TEST_USE_COMPOSE === "1";
export const COMPOSE_PG_URL = "postgresql://food@127.0.0.1:55432/postgres?sslmode=disable";
export const COMPOSE_VALKEY_URL = "redis://127.0.0.1:56379/0";
