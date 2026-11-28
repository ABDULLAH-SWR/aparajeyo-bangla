import { Hono } from "hono";
import { cors } from "hono/cors";
import { etag, RETAINED_304_HEADERS } from "hono/etag";
import { FoodPinDetailSchema, FoodPinsFeatureCollectionSchema } from "../contract/schemas";
import { systemClock } from "./clock";
import type { Config } from "./config";
import { createPgPool } from "./db";
import { errorBody } from "./errors";
import { healthHandler } from "./health";
import { createImgproxySigner, type ImgproxySigner } from "./imgproxy";
import { consoleLogger, type Logger } from "./logger";
import { toCollection, toPinDetail } from "./mappers";
import { createMetrics } from "./metrics";
import { createFoodRepository, type FoodRepository, type PinScope } from "./repository";
import { snapToZ12TileRange } from "./tiles";
import { detailParamValidator, makePinsQuerySchema, pinsQueryValidator } from "./validation";
import { createValkeyCache, detailKey, filterHash, pinsKey, type ValkeyCache } from "./valkey";

const CORS_304_HEADERS = ["access-control-allow-origin", "access-control-expose-headers"];
const PINS_TTL_SECONDS = 3600;
const DETAIL_TTL_SECONDS = 86_400;

interface FoodAppDeps {
  config: Pick<Config, "districtIds" | "corsAllowedOrigins">;
  repo: FoodRepository;
  cache: ValkeyCache;
  signer: ImgproxySigner;
  logger: Logger;
}

function toScope(q: { district_id?: string; bbox?: [number, number, number, number] }): PinScope {
  if (q.district_id !== undefined) return { kind: "district", id: q.district_id };
  if (q.bbox !== undefined) return { kind: "bbox", tiles: snapToZ12TileRange(q.bbox) };
  return { kind: "featured" };
}

export function createFoodApp(deps: FoodAppDeps) {
  const pinsQuery = makePinsQuerySchema(deps.config.districtIds);

  // loadConfig rejects "*" in production, so the wildcard form exists only in development and tests.
  const { corsAllowedOrigins } = deps.config;

  const routes = new Hono()
    .use(
      "/api/v1/*",
      cors({
        origin: corsAllowedOrigins.includes("*") ? "*" : corsAllowedOrigins,
        allowMethods: ["GET", "OPTIONS"],
        allowHeaders: ["If-None-Match"],
        exposeHeaders: ["ETag"],
        maxAge: 600,
      }),
    )
    // A client that sends If-None-Match itself sees the 304, so it must still pass the CORS check.
    .use("/api/v1/*", etag({ weak: true, retainedHeaders: [...RETAINED_304_HEADERS, ...CORS_304_HEADERS] }))
    .get("/api/v1/pins", pinsQueryValidator(pinsQuery), async (c) => {
      const q = c.req.valid("query");
      const scope = toScope(q);
      const epoch = await deps.cache.epoch();
      const datasetVersion = await deps.repo.getDatasetVersion(epoch);
      if (datasetVersion === null) {
        deps.logger.error({ request_id: c.req.header("x-request-id") }, "no successful food_poi_import in sync_runs");
        return c.json(errorBody("INTERNAL_ERROR"), 500);
      }
      const produce = async () =>
        toCollection(await deps.repo.findPins(scope, q), { scope, datasetVersion, signer: deps.signer });
      const { value, hit } = await deps.cache.cached(
        pinsKey({ datasetVersion, epoch, scope, filterHash: filterHash(q) }),
        PINS_TTL_SECONDS,
        FoodPinsFeatureCollectionSchema,
        produce,
      );
      c.header("Cache-Control", "public, max-age=60");
      c.header("Vary", "Origin");
      c.header("X-Cache", hit ? "HIT" : "MISS");
      return c.json(value, 200);
    })
    .get("/api/v1/pins/food/:id", detailParamValidator, async (c) => {
      const { id } = c.req.valid("param");
      const epoch = await deps.cache.epoch();
      const { value, hit } = await deps.cache.cached(
        detailKey(epoch, id),
        DETAIL_TTL_SECONDS,
        FoodPinDetailSchema,
        async () => {
          const found = await deps.repo.findDetail(id);
          return found === null ? null : toPinDetail(found.place, found.photos, found.videos, deps.signer);
        },
      );
      if (value === null) return c.json(errorBody("FOOD_PLACE_NOT_FOUND"), 404);
      c.header("Cache-Control", "public, max-age=300");
      c.header("Vary", "Origin");
      c.header("X-Cache", hit ? "HIT" : "MISS");
      return c.json(value, 200);
    })
    .get("/api/v1/food/health", (c) => healthHandler(c, deps));

  routes.notFound((c) => c.json(errorBody("NOT_FOUND"), 404));
  routes.onError((err, c) => {
    // Detail stays server-side: driver messages can expose hosts and SQL.
    deps.logger.error({ err, request_id: c.req.header("x-request-id") }, "unhandled error");
    return c.json(errorBody("INTERNAL_ERROR"), 500);
  });
  return routes;
}

export type FoodApiApp = ReturnType<typeof createFoodApp>;

/** The production dependencies. Connections open lazily, on first use. */
export function buildDeps(config: Config): FoodAppDeps {
  const logger = consoleLogger;
  return {
    config,
    repo: createFoodRepository(createPgPool(config.databaseUrl)),
    cache: createValkeyCache(config.valkeyUrl, { logger, metrics: createMetrics(), clock: systemClock }),
    signer: createImgproxySigner(config.imgproxy),
    logger,
  };
}
