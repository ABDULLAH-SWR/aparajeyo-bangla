// Vitest globalSetup: one PostGIS server and one Valkey server for the run.
//   default                  start testcontainers
//   FOOD_TEST_USE_COMPOSE=1  use the running servers at DATABASE_URL_OWNER (role needs CREATEDB) and VALKEY_URL
// Migrations run once into a template database; each test file clones it (see pg.ts).
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { resolveBinary } from "dbmate";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import postgres from "postgres";
import { GenericContainer, Wait } from "testcontainers";
import type { TestProject } from "vitest/node";

const MIGRATIONS_DIR = resolve(fileURLToPath(import.meta.url), "../../../../db/migrations");
const POSTGIS_IMAGE = "postgis/postgis:17-3.5"; // must equal the compose `postgres` image tag
const VALKEY_IMAGE = "valkey/valkey:8.1-alpine"; // must equal the compose `valkey` image tag

declare module "vitest" {
  export interface ProvidedContext {
    pgServerUrl: string;
    pgTemplate: string;
    valkeyUrl: string;
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`FOOD_TEST_USE_COMPOSE=1 needs ${name}`);
  return value;
}

export default async function setup(project: TestProject) {
  const useCompose = process.env.FOOD_TEST_USE_COMPOSE === "1";
  const stops: Array<() => Promise<unknown>> = [];

  let pgServerUrl: string;
  let valkeyUrl: string;
  if (useCompose) {
    pgServerUrl = required("DATABASE_URL_OWNER");
    valkeyUrl = required("VALKEY_URL");
  } else {
    const pg = await new PostgreSqlContainer(POSTGIS_IMAGE).start();
    const valkey = await new GenericContainer(VALKEY_IMAGE)
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
      .start();
    stops.push(() => pg.stop(), () => valkey.stop());
    pgServerUrl = `${pg.getConnectionUri()}?sslmode=disable`;
    valkeyUrl = `redis://${valkey.getHost()}:${valkey.getMappedPort(6379)}/0`;
  }

  const template = `food_template_${randomBytes(6).toString("hex")}`;
  const admin = postgres(pgServerUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`CREATE DATABASE ${template}`);
  const templateUrl = new URL(pgServerUrl);
  templateUrl.pathname = `/${template}`;
  await promisify(execFile)(resolveBinary(), [
    "--url", templateUrl.toString(), "--migrations-dir", MIGRATIONS_DIR, "--no-dump-schema", "up", "--strict",
  ]);

  project.provide("pgServerUrl", pgServerUrl);
  project.provide("pgTemplate", template);
  project.provide("valkeyUrl", valkeyUrl);

  return async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${template} WITH (FORCE)`);
    await admin.end();
    for (const stop of stops) await stop();
  };
}
