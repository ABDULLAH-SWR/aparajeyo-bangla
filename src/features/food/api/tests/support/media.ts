/// <reference types="bun" />
// A real Garage and imgproxy: the services of docker-compose.yml, started under a throwaway project
// by scripts/test-media-stack.sh. Needs the Docker CLI with Compose (on Windows, inside WSL).
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// On Windows, a bare `bash` can resolve to the WSL launcher, which cannot see Windows paths.
const GIT_BASH = "C:\\Program Files\\Git\\bin\\bash.exe";
const BASH = process.platform === "win32" && existsSync(GIT_BASH) ? GIT_BASH : "bash";
const SCRIPT = fileURLToPath(new URL("../../../scripts/test-media-stack.sh", import.meta.url)).replaceAll("\\", "/");

const SettingsSchema = z.object({
  IMGPROXY_BASE_URL: z.url(),
  IMGPROXY_KEY: z.string(),
  IMGPROXY_SALT: z.string(),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string(),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
});

const PortSchema = z.object({ host_ip: z.string().optional(), target: z.number() });
const ComposeSchema = z.object({
  services: z.record(z.string(), z.object({ image: z.string(), ports: z.array(PortSchema).optional() })),
});

export async function startMediaStack() {
  const project = `food-media-test-${randomBytes(5).toString("hex")}`;

  async function script(action: string, ...args: string[]): Promise<string> {
    const proc = Bun.spawn([BASH, SCRIPT, action, project, ...args], { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) throw new Error(`test-media-stack.sh ${action} failed (${exitCode}):\n${stderr}`);
    return stdout;
  }

  const down = async () => void (await script("down"));
  try {
    const lines = (await script("up")).split(/\r?\n/).filter((line) => line.includes("="));
    const settings = SettingsSchema.parse(Object.fromEntries(lines.map((line) => line.split("=", 2))));
    return {
      ...settings,
      garage: (...args: string[]) => script("garage", ...args),
      composeConfig: async () => ComposeSchema.parse(JSON.parse(await script("config"))),
      down,
    };
  } catch (error) {
    await down();
    throw error;
  }
}

export type MediaStack = Awaited<ReturnType<typeof startMediaStack>>;
