import postgres from "postgres";

const DEFAULT_DATABASE_URL = "postgresql://food:food@127.0.0.1:5433/aparajeyo_food";

export const sql = postgres(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});
