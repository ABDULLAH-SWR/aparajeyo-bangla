/// <reference types="bun" />
// Vitest globalSetup of the `directus` project: one throwaway stack for the whole run, migrated by
// dbmate and seeded with the geo fixture.
import { resolveBinary } from "dbmate";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import postgres from "postgres";
import type { TestProject } from "vitest/node";
import { directusStack, newProjectName, runBootstrap, type DirectusSettings } from "./directus-stack";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../db/migrations", import.meta.url));
const SEEDS = ["test_geo.sql", "test_base.sql"].map(
  (file) => new URL(`../../../db/seeds/${file}`, import.meta.url),
);

declare module "vitest" {
  export interface ProvidedContext {
    directusProject: string;
    directus: DirectusSettings;
  }
}

export default async function setup(project: TestProject) {
  const name = newProjectName();
  const stack = directusStack(name);
  try {
    const settings = await stack.up();
    await promisify(execFile)(resolveBinary(), [
      "--url", settings.DATABASE_URL_OWNER, "--migrations-dir", MIGRATIONS_DIR, "--no-dump-schema", "up", "--strict",
    ]);
    const owner = postgres(settings.DATABASE_URL_OWNER, { max: 1, onnotice: () => {} });
    for (const seed of SEEDS) await owner.unsafe(readFileSync(seed, "utf8"));
    await owner.end();
    await stack.run("roles");

    const services = await stack.start();
    await runBootstrap({ ...settings, ...services }, "register");
    await stack.run("directus", "schema", "apply", "--yes", "/directus/food/snapshot.yaml");
    await runBootstrap({ ...settings, ...services });

    project.provide("directusProject", name);
    project.provide("directus", { ...settings, ...services });
  } catch (error) {
    await stack.down();
    throw error;
  }

  return () => stack.down();
}
