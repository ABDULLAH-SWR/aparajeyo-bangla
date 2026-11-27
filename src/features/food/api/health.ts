// Internal dependency report. Deliberately not part of the Map contract (C8).
import type { Context } from "hono";
import { z } from "zod";
import type { Logger } from "./logger";
import type { FoodRepository } from "./repository";
import type { ValkeyCache } from "./valkey";

export const HealthResponseSchema = z.object({
  /** "down" when the API cannot serve. A missing cache only degrades it. */
  status: z.enum(["ok", "down"]),
  db: z.enum(["ok", "down"]),
  cache: z.enum(["ok", "degraded"]),
  dataset_version: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  epoch: z.number().int().nonnegative().nullable(),
});

export async function healthHandler(c: Context, deps: { repo: FoodRepository; cache: ValkeyCache; logger: Logger }) {
  const [database, epoch] = await Promise.all([
    deps.repo.readDatasetVersion().then(
      (datasetVersion) => ({ db: "ok" as const, datasetVersion }),
      (err) => {
        deps.logger.error({ err }, "health: database unreachable");
        return { db: "down" as const, datasetVersion: null };
      },
    ),
    deps.cache.readEpoch(),
  ]);
  const up = database.db === "ok";
  const body = HealthResponseSchema.parse({
    status: up ? "ok" : "down",
    db: database.db,
    cache: epoch === null ? "degraded" : "ok",
    dataset_version: database.datasetVersion,
    epoch,
  });
  c.header("Cache-Control", "no-store");
  return c.json(body, up ? 200 : 503);
}
