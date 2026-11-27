import { hc } from "hono/client";
import { z } from "zod";
import type { FoodApiApp } from "./api/app";
import { FOOD_CATEGORIES, type FOOD_ERROR_CODES } from "./contract/enums";
import { ApiErrorResponseSchema, FoodPinDetailSchema, FoodPinsFeatureCollectionSchema } from "./contract/schemas";
import type { FoodCategory, FoodPinDetail, FoodPinsFeatureCollection } from "./types";

/** `globalThis.fetch` and a Hono `app.fetch` both satisfy this. */
export type FoodFetch = (request: Request) => Response | Promise<Response>;

export interface FoodServiceDeps {
  baseUrl: string;
  fetch?: FoodFetch;
  /** The most responses kept for ETag revalidation. */
  cacheCapacity?: number;
}

export interface FoodPinsFilter {
  districtId?: string;
  /** "minLng,minLat,maxLng,maxLat". Cannot be combined with districtId. */
  bbox?: string;
  categories?: FoodCategory[];
  hasVideo?: boolean;
}

/** The API's codes, plus the client-only code for a request that got no response (contract C2). */
export type FoodClientErrorCode = (typeof FOOD_ERROR_CODES)[number] | "UPSTREAM_UNAVAILABLE";

export class FoodApiError extends Error {
  readonly status: number;
  readonly code: FoodClientErrorCode;

  constructor(status: number, code: FoodClientErrorCode, message: string) {
    super(message);
    this.name = "FoodApiError";
    this.status = status;
    this.code = code;
  }
}

const CategoriesSchema = z.array(z.enum(FOOD_CATEGORIES)).min(1).optional();

/** Maps a non-2xx response. A body that is not the contract envelope (a proxy page, say) is internal. */
async function toApiError(res: Pick<Response, "status" | "json">): Promise<FoodApiError> {
  const body = await res.json().catch(() => undefined);
  const envelope = ApiErrorResponseSchema.safeParse(body);
  if (!envelope.success) {
    return new FoodApiError(res.status, "INTERNAL_ERROR", `Food API request failed with HTTP ${res.status}.`);
  }
  return new FoodApiError(res.status, envelope.data.error.code, envelope.data.error.message);
}

/** Picks the best available bilingual display name following the contract fallback rule. */
export function getFoodDisplayName(
  place: { name_en: string | null; name_bn: string | null },
  language: "en" | "bn"
): string {
  if (language === "bn") {
    return place.name_bn ?? place.name_en ?? "";
  }
  return place.name_en ?? place.name_bn ?? "";
}

/** Revalidates by ETag: a `304` is answered with the body stored for that URL. */
function withEtagCache(send: FoodFetch, capacity: number): (request: Request) => Promise<Response> {
  const entries = new Map<string, { etag: string; body: string }>();

  function store(url: string, entry: { etag: string; body: string }): void {
    entries.delete(url);
    entries.set(url, entry);
    // A Map iterates in insertion order, so the first key is the oldest.
    for (const oldest of entries.keys()) {
      if (entries.size <= capacity) break;
      entries.delete(oldest);
    }
  }

  return async (request) => {
    const entry = entries.get(request.url);
    if (entry) request.headers.set("If-None-Match", entry.etag);
    let res = await send(request);
    if (res.status === 304) {
      if (entry) {
        store(request.url, entry); // marks it most recently used
        return new Response(entry.body, { status: 200, headers: { "Content-Type": "application/json" } });
      }
      // Nothing here to answer it with: ask once more, unconditionally.
      const retry = new Request(request);
      retry.headers.delete("If-None-Match");
      res = await send(retry);
    }
    const etag = res.headers.get("ETag");
    if (res.status === 200 && etag) store(request.url, { etag, body: await res.clone().text() });
    return res;
  };
}

/**
 * The client of the Food API. Each instance owns its cache: browser code holds one instance,
 * and nothing is shared between server requests unless the caller shares the instance.
 */
export function createFoodService({
  baseUrl,
  fetch: send = (request) => fetch(request),
  cacheCapacity = 64,
}: FoodServiceDeps) {
  const cachedSend = withEtagCache(send, cacheCapacity);
  const client = hc<FoodApiApp>(baseUrl, {
    // This cache does the revalidation, so the browser's HTTP cache stays out of it.
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, { ...init, cache: "no-store" });
      try {
        return await cachedSend(request);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new FoodApiError(0, "UPSTREAM_UNAVAILABLE", `Food API request failed: ${reason}`);
      }
    },
  });

  return {
    /** Live GeoJSON food pins (`GET /api/v1/pins?overlay=food`). */
    async getFoodPins(filter: FoodPinsFilter = {}): Promise<FoodPinsFeatureCollection> {
      if (!CategoriesSchema.safeParse(filter.categories).success) {
        throw new FoodApiError(400, "INVALID_CATEGORY", "categories must be one or more FoodCategory values.");
      }
      const res = await client.api.v1.pins.$get({
        query: {
          overlay: "food",
          district_id: filter.districtId,
          bbox: filter.bbox,
          category: filter.categories?.join(","),
          has_video: filter.hasVideo?.toString(),
        },
      });
      if (!res.ok) throw await toApiError(res);
      return FoodPinsFeatureCollectionSchema.parse(await res.json());
    },

    /** Live Rich Pin Card detail (`GET /api/v1/pins/food/:id`). */
    async getFoodPinDetail(id: string): Promise<FoodPinDetail> {
      // hc inserts path params verbatim.
      const res = await client.api.v1.pins.food[":id"].$get({ param: { id: encodeURIComponent(id) } });
      if (!res.ok) throw await toApiError(res);
      return FoodPinDetailSchema.parse(await res.json());
    },
  };
}

export type FoodService = ReturnType<typeof createFoodService>;
