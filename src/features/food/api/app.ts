import { Hono } from "hono";
import { cors } from "hono/cors";
import { etag, RETAINED_304_HEADERS } from "hono/etag";
import { FoodPinDetailSchema, FoodPinsFeatureCollectionSchema } from "../contract/schemas";
import type { FoodHealthResponse } from "../types";
import { errorBody } from "./errors";
import type { ImgproxySigner } from "./imgproxy";
import type { Logger } from "./logger";
import { toCollection, toPinDetail } from "./mappers";
import type { FoodRepository, PinScope } from "./repository";
import { detailParamValidator, makePinsQuerySchema, pinsQueryValidator } from "./validation";
import { detailKey, filterHash, pinsKey, type ValkeyCache } from "./valkey";

const CORS_304_HEADERS = ["access-control-allow-origin", "access-control-expose-headers"];
const PINS_TTL_SECONDS = 3600;
const DETAIL_TTL_SECONDS = 86_400;

export interface FoodAppDeps {
  config: { districtIds: ReadonlySet<string>; corsAllowedOrigins: string[] };
  repo: FoodRepository;
  cache: ValkeyCache;
  signer: ImgproxySigner;
  logger: Logger;
}

function toScope(q: { district_id?: string; bbox?: [number, number, number, number] }): PinScope {
  if (q.district_id !== undefined) return { kind: "district", id: q.district_id };
  if (q.bbox !== undefined) return { kind: "bbox", bbox: q.bbox };
  return { kind: "national" };
}

/** null means "do not cache": a raw bbox has no shareable key until Slice 0C.11 snaps it to z12 tiles. */
function scopeKeyOf(scope: PinScope): string | null {
  if (scope.kind === "district") return `d:${scope.id}`;
  return scope.kind === "national" ? "featured" : null;
}

export function createFoodApp(deps: FoodAppDeps) {
  const pinsQuery = makePinsQuerySchema(deps.config.districtIds);

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
      const produce = async () =>
        toCollection(await deps.repo.findPins(scope, q), { scope, datasetVersion, signer: deps.signer });
      const scopeKey = scopeKeyOf(scope);
      const { value, hit } =
        scopeKey === null
          ? { value: FoodPinsFeatureCollectionSchema.parse(await produce()), hit: false }
          : await deps.cache.cached(
              pinsKey({ datasetVersion, epoch, scope: scopeKey, filterHash: filterHash(q) }),
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
      const { value, hit } = await deps.cache.cachedNullable(
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
    // Replaced by the dependency report in Slice 0C.15.
    .get("/api/v1/food/health", async (c) => {
      const body: FoodHealthResponse = {
        status: "ok",
        service: "aparajeyo-food-api",
        ...(await deps.repo.getHealth()),
        imgproxy_enabled: true,
      };
      return c.json(body, 200);
    });

  routes.notFound((c) => c.json(errorBody("NOT_FOUND"), 404));
  routes.onError((err, c) => {
    // Detail stays server-side: driver messages can expose hosts and SQL.
    deps.logger.error({ err, request_id: c.req.header("x-request-id") }, "unhandled error");
    return c.json(errorBody("INTERNAL_ERROR"), 500);
  });
  return routes;
}

export type FoodApiApp = ReturnType<typeof createFoodApp>;
