// Composes the real application the way server.ts does, against a test database.
import { fileURLToPath } from "node:url";
import { createFoodApp } from "../../app";
import { systemClock, type Clock } from "../../clock";
import { loadDistrictIds } from "../../config";
import { createPgPool } from "../../db";
import type { ImgproxySigner } from "../../imgproxy";
import type { Logger } from "../../logger";
import { createMetrics } from "../../metrics";
import { createFoodRepository } from "../../repository";
import { createValkeyCache } from "../../valkey";

interface LogEntry {
  level: "warn" | "error";
  context: Record<string, unknown>;
  message: string;
}

export const CLOSED_DATABASE_URL = "postgresql://nobody@127.0.0.1:1/nowhere";

const districtIds = loadDistrictIds(
  fileURLToPath(new URL("../../../data/geo_codes.v03.json", import.meta.url)),
);

/** Cache tests pass a real Valkey. Everything else runs with the cache unreachable. */
const CLOSED_VALKEY_URL = "redis://127.0.0.1:1/0";

export interface TestAppOptions {
  databaseUrl: string;
  valkeyUrl?: string;
  clock?: Clock;
  signer?: ImgproxySigner;
}

const FAKE_SIGNER: ImgproxySigner = { sign: (s3Key, width) => `https://img.example.test/${width}/${s3Key}` };

export function createTestApp({
  databaseUrl,
  valkeyUrl = CLOSED_VALKEY_URL,
  clock = systemClock,
  signer = FAKE_SIGNER,
}: TestAppOptions) {
  const sql = createPgPool(databaseUrl);
  const logs: LogEntry[] = [];
  const logger: Logger = {
    warn: (context, message) => void logs.push({ level: "warn", context, message }),
    error: (context, message) => void logs.push({ level: "error", context, message }),
  };
  const metrics = createMetrics();
  const cache = createValkeyCache(valkeyUrl, { logger, metrics, clock });
  const app = createFoodApp({
    config: { districtIds, corsAllowedOrigins: ["https://map.example.test"] },
    repo: createFoodRepository(sql),
    cache,
    signer,
    logger,
  });

  async function close(): Promise<void> {
    cache.close();
    await sql.end({ timeout: 1 });
  }

  return { app, cache, logs, metrics, close };
}

export type TestApp = ReturnType<typeof createTestApp>;
