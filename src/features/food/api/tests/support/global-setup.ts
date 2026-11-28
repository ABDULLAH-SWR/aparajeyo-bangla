// Vitest globalSetup: one PostGIS server and one Valkey server for the run.
//   default                  start testcontainers
//   FOOD_TEST_USE_COMPOSE=1  use the running servers of docker-compose.test.yml (see compose.ts)
// Migrations and the seeds (db/seeds/test_geo.sql, then test_base.sql) load once into a template
// database; setup.ts clones it for each test file.
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { resolveBinary } from "dbmate";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import postgres from "postgres";
import { GenericContainer, Wait } from "testcontainers";
import type { TestProject } from "vitest/node";
import {
  COMPOSE_PG_URL,
  COMPOSE_VALKEY_URL,
  POSTGIS_IMAGE,
  USE_COMPOSE,
  VALKEY_IMAGE,
} from "./compose";

const MIGRATIONS_DIR = resolve(fileURLToPath(import.meta.url), "../../../../db/migrations");
const SEEDS = ["test_geo.sql", "test_base.sql"].map((file) => resolve(MIGRATIONS_DIR, "../seeds", file));

declare module "vitest" {
  export interface ProvidedContext {
    pgServerUrl: string;
    pgTemplate: string;
    valkeyUrl: string;
    /** Scratch directory shared by the test files of one run. */
    runDir: string;
  }
}

export default async function setup(project: TestProject) {
  const stops: Array<() => Promise<unknown>> = [];

  let pgServerUrl: string;
  let valkeyUrl: string;
  if (USE_COMPOSE) {
    pgServerUrl = COMPOSE_PG_URL;
    valkeyUrl = COMPOSE_VALKEY_URL;
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

  const seed = postgres(templateUrl.toString(), { max: 1, onnotice: () => {} });
  for (const file of SEEDS) await seed.unsafe(readFileSync(file, "utf8"));
  await seed.end(); // a template cannot be cloned while anything is connected to it
  const runDir = mkdtempSync(join(tmpdir(), "food-test-run-"));

  project.provide("runDir", runDir);
  project.provide("pgServerUrl", pgServerUrl);
  project.provide("pgTemplate", template);
  project.provide("valkeyUrl", valkeyUrl);

  return async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${template} WITH (FORCE)`);
    await admin.end();
    for (const stop of stops) await stop();
    rmSync(runDir, { recursive: true, force: true });
  };
}
