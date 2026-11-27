/// <reference types="bun" />
// Runs the repository's bash scripts (src/features/food/scripts) against a test database.
import { resolveBinary } from "dbmate";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FOOD_ROOT } from "./db";

// On Windows, a bare `bash` can resolve to the WSL launcher, which cannot see Windows paths.
const GIT_BASH = "C:\\Program Files\\Git\\bin\\bash.exe";
const BASH = process.platform === "win32" && existsSync(GIT_BASH) ? GIT_BASH : "bash";

const posix = (path: string) => path.replaceAll("\\", "/");

export async function runScript(script: string, env: Record<string, string>) {
  // Hosts without psql (Windows + Docker in WSL) go through the server's own psql.
  const psql = Bun.which("psql") ? "psql" : `bash ${posix(join(import.meta.dir, "psql-in-container.sh"))}`;
  const proc = Bun.spawn([BASH, posix(join(FOOD_ROOT, "scripts", script))], {
    env: { ...process.env, PSQL: psql, DBMATE: posix(resolveBinary()), ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, output: stdout + stderr };
}
