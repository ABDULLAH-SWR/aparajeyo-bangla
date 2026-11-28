/// <reference types="bun" />
// Drives scripts/test-directus-stack.sh. Needs the Docker CLI with Compose (on Windows, inside WSL).
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";
import { BASH } from "./media";

const SCRIPT = fileURLToPath(new URL("../../../scripts/test-directus-stack.sh", import.meta.url)).replaceAll("\\", "/");
const BOOTSTRAP = fileURLToPath(new URL("../../../scripts/directus-bootstrap.ts", import.meta.url));

export const DatabaseSettingsSchema = z.object({
  DATABASE_URL_OWNER: z.url(),
  VALKEY_URL: z.url(),
  DIRECTUS_DB_PASSWORD: z.string(),
  DIRECTUS_ADMIN_EMAIL: z.string(),
  DIRECTUS_ADMIN_PASSWORD: z.string(),
  FOOD_INVALIDATE_TOKEN: z.string(),
});

const ServiceSettingsSchema = z.object({
  DIRECTUS_URL: z.url(),
  FOOD_API_URL: z.url(),
  FOOD_INVALIDATE_URL: z.url(),
});

export type DirectusSettings = z.infer<typeof DatabaseSettingsSchema> & z.infer<typeof ServiceSettingsSchema>;

const readSettings = (output: string) =>
  Object.fromEntries(
    output
      .split(/\r?\n/)
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );

/** Runs the operators' script exactly as they do: its own process, configured by environment. */
export async function runBootstrap(settings: DirectusSettings, ...args: string[]): Promise<void> {
  await promisify(execFile)(process.execPath, [BOOTSTRAP, ...args], { env: { ...process.env, ...settings } });
}

export const newProjectName = () => `food-directus-test-${randomBytes(5).toString("hex")}`;

export function directusStack(project: string) {
  async function run(action: string, ...args: string[]): Promise<string> {
    const proc = Bun.spawn([BASH, SCRIPT, action, project, ...args], { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) throw new Error(`test-directus-stack.sh ${action} failed (${exitCode}):\n${stdout}${stderr}`);
    return stdout;
  }

  return {
    run,
    /** Starts the databases. */
    up: async () => DatabaseSettingsSchema.parse(readSettings(await run("up"))),
    /** Starts the services. The database must be migrated and its roles bootstrapped. */
    start: async () => ServiceSettingsSchema.parse(readSettings(await run("start"))),
    down: async () => void (await run("down")),
  };
}
