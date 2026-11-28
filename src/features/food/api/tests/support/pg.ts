// The database of the running test file. setup.ts clones it from the migrated, seeded template.
import postgres from "postgres";
import { inject } from "vitest";
import { buildTestDeps } from "./deps";

async function asAdmin(...statements: string[]): Promise<void> {
  const admin = postgres(inject("pgServerUrl"), { max: 1, onnotice: () => {} });
  try {
    for (const statement of statements) await admin.unsafe(statement);
  } finally {
    await admin.end();
  }
}

const drop = (name: string) => `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`;

export const dropDatabase = (name: string) => asAdmin(drop(name));

/** Returns the new database's URL. A leftover of the same name from a killed run is replaced. */
export async function cloneTemplate(name: string): Promise<string> {
  await asAdmin(drop(name), `CREATE DATABASE ${name} TEMPLATE ${inject("pgTemplate")}`);
  const url = new URL(inject("pgServerUrl"));
  url.pathname = `/${name}`;
  return url.toString();
}

/** A connection to this file's database. `drop` is optional: setup.ts also drops it. */
export async function createFileDb() {
  const { databaseUrl } = buildTestDeps();
  const sql = postgres(databaseUrl, { max: 2, onnotice: () => {} });

  async function close(): Promise<void> {
    await sql.end();
    await dropDatabase(new URL(databaseUrl).pathname.slice(1));
  }

  return { url: databaseUrl, sql, drop: close };
}

export type FileDb = Awaited<ReturnType<typeof createFileDb>>;
