// Cache keys, TTLs and invalidation: Guide Appendix C.
import crypto from "node:crypto";
import Redis from "ioredis";
import type { z } from "zod";
import type { Clock } from "./clock";
import type { Logger } from "./logger";
import type { Metrics } from "./metrics";

const EPOCH_KEY = "food:epoch";
const EPOCH_MEMO_MS = 5000;

type Operation = "connect" | "get" | "set" | "incr";

export function filterHash(filters: { category?: readonly string[]; has_video?: boolean }): string {
  const canonical = JSON.stringify({
    categories: [...new Set(filters.category ?? [])].sort(),
    has_video: filters.has_video ?? null,
  });
  return crypto.createHash("sha1").update(canonical).digest("hex").slice(0, 12);
}

export function pinsKey(parts: {
  datasetVersion: string | null;
  epoch: number;
  scope: string;
  filterHash: string;
}): string {
  return `food:v2:pins:${parts.datasetVersion}:${parts.epoch}:${parts.scope}:${parts.filterHash}`;
}

export const detailKey = (epoch: number, id: string) => `food:v2:detail:${epoch}:${id}`;

export function createValkeyCache(url: string, deps: { logger: Logger; metrics: Metrics; clock: Clock }) {
  const redis = new Redis(url.replace(/^valkey:\/\//i, "redis://"), {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    commandTimeout: 500,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
  });

  function report(op: Operation, err: unknown): void {
    deps.metrics.increment("food_api_valkey_errors_total", { op });
    deps.logger.warn({ err, op }, "valkey error");
  }

  redis.on("error", (err) => report("connect", err));
  let connecting: Promise<void> | undefined;

  async function ready(): Promise<void> {
    if (redis.status === "wait") connecting = redis.connect().finally(() => (connecting = undefined));
    await connecting;
  }

  /** Runs one command. A failure is reported and yields undefined, so the caller can fall back. */
  async function attempt<T>(op: Operation, command: () => Promise<T>): Promise<T | undefined> {
    try {
      await ready();
      return await command();
    } catch (err) {
      report(op, err);
      return undefined;
    }
  }

  function parse<T extends z.ZodType>(key: string, raw: string, schema: T): { value: z.output<T> } | null {
    try {
      return { value: schema.parse(JSON.parse(raw)) };
    } catch (err) {
      deps.logger.warn({ err, key }, "unreadable cache entry");
      return null;
    }
  }

  /** Always returns `schema.parse` output, so a hit and a miss serialize identically. A null is not stored. */
  async function cachedNullable<T extends z.ZodType>(
    key: string,
    ttlSeconds: number,
    schema: T,
    produce: () => Promise<unknown>,
  ): Promise<{ value: z.output<T> | null; hit: boolean }> {
    const raw = await attempt("get", () => redis.get(key));
    const stored = typeof raw === "string" ? parse(key, raw, schema) : null;
    if (stored) return { value: stored.value, hit: true };

    const produced = await produce();
    if (produced === null) return { value: null, hit: false };
    const value = schema.parse(produced);
    await attempt("set", () => redis.set(key, JSON.stringify(value), "EX", ttlSeconds));
    return { value, hit: false };
  }

  let memo: { epoch: number; readAt: number } | null = null;

  return {
    cachedNullable,

    async cached<T extends z.ZodType>(
      key: string,
      ttlSeconds: number,
      schema: T,
      produce: () => Promise<NonNullable<unknown>>,
    ): Promise<{ value: z.output<T>; hit: boolean }> {
      const result = await cachedNullable(key, ttlSeconds, schema, produce);
      return { value: result.value as z.output<T>, hit: result.hit };
    },

    /** Memoized in process for at most 5 s: the server-side staleness bound after a bump. */
    async epoch(): Promise<number> {
      const now = deps.clock.now();
      if (memo && now - memo.readAt < EPOCH_MEMO_MS) return memo.epoch;
      const raw = await attempt("get", () => redis.get(EPOCH_KEY));
      if (raw !== undefined) memo = { epoch: Number(raw ?? 0), readAt: now };
      return memo?.epoch ?? 0;
    },

    /** Throws on failure: a writer must know that its change was not published. */
    async bumpEpoch(reason: string): Promise<void> {
      try {
        await ready();
        await redis.incr(EPOCH_KEY);
      } catch (err) {
        report("incr", new Error(`epoch bump failed (${reason})`, { cause: err }));
        throw err;
      }
    },

    close(): void {
      redis.disconnect();
    },
  };
}

export type ValkeyCache = ReturnType<typeof createValkeyCache>;
