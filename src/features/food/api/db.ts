import postgres from "postgres";

/** Connections open lazily, on the first query. */
export function createPgPool(url: string) {
  return postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export type PgPool = ReturnType<typeof createPgPool>;
