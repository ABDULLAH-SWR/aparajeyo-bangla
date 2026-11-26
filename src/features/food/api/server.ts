import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const foodDir = path.resolve(__dirname, "..");
const port = Number(process.env.FOOD_API_PORT ?? 8002);

function isTcpPortOpen(host: string, targetPort: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: targetPort });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}

function toWslPath(winPath: string): string {
  const resolved = path.resolve(winPath);
  const drive = resolved[0].toLowerCase();
  const rest = resolved.slice(2).replace(/\\/g, "/");
  return `/mnt/${drive}${rest}`;
}

let wslKeepalive: ChildProcess | null = null;

async function ensureLocalStackReady(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? "postgresql://food:food@127.0.0.1:5433/aparajeyo_food";
  let targetHost = "127.0.0.1";
  let targetPort = 5433;
  try {
    const parsed = new URL(dbUrl);
    targetHost = parsed.hostname || "127.0.0.1";
    targetPort = Number(parsed.port || 5432);
  } catch {
    // keep defaults
  }

  if (await isTcpPortOpen(targetHost, targetPort)) {
    return;
  }

  if (process.platform !== "win32" || (targetHost !== "127.0.0.1" && targetHost !== "localhost")) {
    console.warn(`[food-api] Warning: PostgreSQL at ${targetHost}:${targetPort} is not reachable yet.`);
    return;
  }

  console.log("[food-api] Local PostGIS/Valkey stack is asleep; waking WSL Docker Compose...");
  // Keep WSL VM awake while this server runs
  wslKeepalive = spawn("wsl", ["-d", "Ubuntu", "--", "sleep", "infinity"], {
    stdio: "ignore",
    windowsHide: true,
  });
  const cleanup = () => {
    if (wslKeepalive && !wslKeepalive.killed) {
      wslKeepalive.kill();
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  const wslFoodDir = toWslPath(foodDir);
  const up = spawnSync(
    "wsl",
    ["-d", "Ubuntu", "--", "bash", "-c", `cd '${wslFoodDir}' && docker compose up -d`],
    { encoding: "utf8", windowsHide: true }
  );
  if (up.status !== 0) {
    console.error("[food-api] Failed to start Docker Compose in WSL:", up.stderr || up.stdout);
    return;
  }

  for (let i = 0; i < 30; i++) {
    if (await isTcpPortOpen(targetHost, targetPort, 1000)) {
      console.log("[food-api] PostGIS, Valkey, Garage S3, imgproxy, and Directus are ready.");
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.warn("[food-api] Timed out waiting for PostGIS port", targetPort);
}

await ensureLocalStackReady();

console.log(`[food-api] Hono server listening on http://localhost:${port}`);

const serverConfig = {
  port,
  fetch: app.fetch,
};

export default serverConfig;
