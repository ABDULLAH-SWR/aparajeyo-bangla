/// <reference types="bun" />
// Drives scripts/test-directus-stack.sh. Needs the Docker CLI with Compose (on Windows, inside WSL).
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";
import { readComposeConfig, readSettings, runStackScript } from "./stack-script";

const BOOTSTRAP = fileURLToPath(new URL("../../../scripts/directus-bootstrap.ts", import.meta.url));

const DatabaseSettingsSchema = z.object({
  DATABASE_URL_OWNER: z.url(),
  VALKEY_URL: z.url(),
  DIRECTUS_DB_PASSWORD: z.string(),
  DIRECTUS_ADMIN_EMAIL: z.string(),
  DIRECTUS_ADMIN_PASSWORD: z.string(),
  FOOD_INVALIDATE_TOKEN: z.string(),
  FOOD_INTERNAL_PREFIX: z.string(),
});

const ServiceSettingsSchema = z.object({
  DIRECTUS_URL: z.url(),
  FOOD_API_URL: z.url(),
});

export type DirectusSettings = z.infer<typeof DatabaseSettingsSchema> & z.infer<typeof ServiceSettingsSchema>;

/** Runs the operators' script exactly as they do: its own process, configured by environment. */
export async function runBootstrap(settings: DirectusSettings, ...args: string[]): Promise<void> {
  await promisify(execFile)(process.execPath, [BOOTSTRAP, ...args], { env: { ...process.env, ...settings } });
}

export const newProjectName = () => `food-directus-test-${randomBytes(5).toString("hex")}`;

export function directusStack(project: string) {
  const run = runStackScript("test-directus-stack.sh", project);

  return {
    run,
    composeConfig: () => readComposeConfig(run),
    /** Starts the databases. */
    up: async () => DatabaseSettingsSchema.parse(readSettings(await run("up"))),
    /** Starts the services. The database must be migrated and its roles bootstrapped. */
    start: async () => ServiceSettingsSchema.parse(readSettings(await run("start"))),
    down: async () => void (await run("down")),
  };
}
