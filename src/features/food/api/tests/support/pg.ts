// A throwaway database per test file, cloned from the migrated template.
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { inject } from "vitest";

export async function createFileDb() {
  const name = `food_t_${randomBytes(6).toString("hex")}`;
  const admin = postgres(inject("pgServerUrl"), { max: 1, onnotice: () => {} });
  await admin.unsafe(`CREATE DATABASE ${name} TEMPLATE ${inject("pgTemplate")}`);
  const url = new URL(inject("pgServerUrl"));
  url.pathname = `/${name}`;
  const sql = postgres(url.toString(), { max: 2, onnotice: () => {} });

  async function drop(): Promise<void> {
    await sql.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  }

  return { url: url.toString(), sql, drop };
}

export type FileDb = Awaited<ReturnType<typeof createFileDb>>;
