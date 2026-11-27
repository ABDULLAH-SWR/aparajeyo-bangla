// Process boundary: the real entrypoint, started the way operators start it.
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, expect, inject, test } from "vitest";
import { createFileDb, type FileDb } from "./support/pg";
import { insertImportRun } from "./support/seed";
import { validEnv, without } from "./support/env";

const SERVER = fileURLToPath(new URL("../server.ts", import.meta.url));
const BOOT_BUDGET_MS = 3000;

let db: FileDb;
let child: ChildProcess | null = null;

beforeAll(async () => {
  db = await createFileDb();
  await insertImportRun(db.sql);
});
afterEach(() => {
  child?.kill();
  child = null;
});
afterAll(() => db.drop());

async function freePort(): Promise<number> {
  const probe = createServer().listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address() as { port: number };
  probe.close();
  return port;
}

/** Runs from an empty directory so that no developer .env file is picked up. */
function startServer(env: Record<string, string>) {
  const { PATH, SystemRoot, TEMP } = process.env;
  // Typed loosely: the Next app's ProcessEnv augmentation makes NODE_ENV mandatory.
  const childEnv: Record<string, string | undefined> = { PATH, SystemRoot, TEMP, ...env };
  const started = spawn(process.execPath, [SERVER], {
    cwd: tmpdir(),
    env: childEnv as NodeJS.ProcessEnv,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  started.stderr!.on("data", (chunk) => (stderr += chunk));
  child = started;
  return { process: started, stderr: () => stderr };
}

const liveEnv = (port: number) =>
  validEnv({ PORT: String(port), DATABASE_URL: db.url, VALKEY_URL: inject("valkeyUrl") });

test("c1 serves health within 3 s of starting", async () => {
  const port = await freePort();
  const deadline = Date.now() + BOOT_BUDGET_MS;
  const server = startServer(liveEnv(port));

  let status = 0;
  while (status !== 200 && Date.now() < deadline) {
    try {
      status = (await fetch(`http://127.0.0.1:${port}/api/v1/food/health`)).status;
    } catch {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  expect(status, server.stderr()).toBe(200);
});

test("c2 exits with code 1 and names the missing variable", async () => {
  const server = startServer(without(liveEnv(await freePort()), "DATABASE_URL"));

  const [code] = await once(server.process, "close", { signal: AbortSignal.timeout(BOOT_BUDGET_MS) });

  expect(code).toBe(1);
  expect(server.stderr()).toContain("DATABASE_URL");
});
