/// <reference types="bun" />
// Runs the scripts that drive a throwaway compose stack (scripts/test-*-stack.sh), and reads what
// they print.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// On Windows, a bare `bash` can resolve to the WSL launcher, which cannot see Windows paths.
const GIT_BASH = "C:\\Program Files\\Git\\bin\\bash.exe";
export const BASH = process.platform === "win32" && existsSync(GIT_BASH) ? GIT_BASH : "bash";

/** `scripts/<script> <action> <project> <args...>`: resolves to its stdout, or throws with its output. */
export function runStackScript(script: string, project: string) {
  const path = fileURLToPath(new URL(`../../../scripts/${script}`, import.meta.url)).replaceAll("\\", "/");

  return async (action: string, ...args: string[]): Promise<string> => {
    const proc = Bun.spawn([BASH, path, action, project, ...args], { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) throw new Error(`${script} ${action} failed (${exitCode}):\n${stdout}${stderr}`);
    return stdout;
  };
}

/** The NAME=value lines of a script's output. A value may itself contain "=". */
export const readSettings = (output: string): Record<string, string> =>
  Object.fromEntries(
    output
      .split(/\r?\n/)
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );

const ComposeSchema = z.object({
  services: z.record(
    z.string(),
    z.object({
      image: z.string().optional(), // a service that compose builds (food-api) has no image name
      ports: z.array(z.object({ host_ip: z.string().optional(), target: z.number() })).optional(),
      environment: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

/** The compose configuration of a stack, as its script's `config` action prints it. */
export const readComposeConfig = async (run: ReturnType<typeof runStackScript>) =>
  ComposeSchema.parse(JSON.parse(await run("config")));
