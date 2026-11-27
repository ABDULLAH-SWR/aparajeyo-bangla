/// <reference types="bun" />
// PostGIS test harness. Each test file gets its own database, migrated by dbmate.
//   default                  start a postgis testcontainer
//   FOOD_TEST_USE_COMPOSE=1  use the running server at DATABASE_URL_OWNER (role needs CREATEDB)
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { resolveBinary } from "dbmate";
import { randomBytes } from "node:crypto";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import postgres from "postgres";

export const FOOD_ROOT = resolve(import.meta.dir, "../../..");
export const MIGRATIONS_DIR = join(FOOD_ROOT, "db", "migrations");
export const USE_COMPOSE = process.env.FOOD_TEST_USE_COMPOSE === "1";
const IMAGE = "postgis/postgis:17-3.5"; // must equal the compose `postgres` image tag

let server: Promise<string> | undefined;

function serverUrl(): Promise<string> {
  server ??= (async () => {
    if (USE_COMPOSE) {
      const url = process.env.DATABASE_URL_OWNER;
      if (!url) throw new Error("FOOD_TEST_USE_COMPOSE=1 needs DATABASE_URL_OWNER");
      return url;
    }
    const container = await new PostgreSqlContainer(IMAGE).start();
    return `${container.getConnectionUri()}?sslmode=disable`;
  })();
  return server;
}

function withDatabase(url: string, database: string): string {
  const next = new URL(url);
  next.pathname = `/${database}`;
  return next.toString();
}

const connect = (url: string) => postgres(url, { max: 1, onnotice: () => {} });

/** The statements dbmate would run for `up`, for building a pre-adoption database by hand. */
export function upSection(file: string): string {
  const text = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  return text.split("-- migrate:down")[0]!;
}

export async function createTestDb() {
  const base = await serverUrl();
  const name = `food_test_${randomBytes(6).toString("hex")}`;
  const admin = connect(base);
  await admin.unsafe(`CREATE DATABASE ${name}`);
  const url = withDatabase(base, name);
  const sql = connect(url);

  /** Applies pending migrations, optionally stopping after version `upTo` (for example "0006"). */
  async function migrate(upTo?: string): Promise<void> {
    let dir = MIGRATIONS_DIR;
    if (upTo) {
      dir = mkdtempSync(join(tmpdir(), "food-migrations-"));
      for (const file of readdirSync(MIGRATIONS_DIR)) {
        if (file.slice(0, upTo.length) <= upTo) copyFileSync(join(MIGRATIONS_DIR, file), join(dir, file));
      }
    }
    const proc = Bun.spawn(
      [resolveBinary(), "--url", url, "--migrations-dir", dir, "--no-dump-schema", "up", "--strict"],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (upTo) rmSync(dir, { recursive: true, force: true });
    if (code !== 0) throw new Error(`dbmate up failed (${code}):\n${out}${err}`);
  }

  async function drop(): Promise<void> {
    await sql.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  }

  return { name, url, sql, migrate, drop };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
