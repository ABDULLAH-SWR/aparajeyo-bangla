import { FOOD_CATEGORIES, getFoodApiBaseUrl } from "./constants";
import type {
  ApiErrorResponse,
  FoodCategory,
  FoodHealthResponse,
  FoodPinDetail,
  FoodPinsFeatureCollection,
  FoodPinsQueryParams,
} from "./types";

const VALID_CATEGORIES = new Set<string>(FOOD_CATEGORIES);

interface CachedEntry<T> {
  etag: string;
  payload: T;
}

const etagCache = new Map<string, CachedEntry<unknown>>();

export class FoodApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "FoodApiError";
    this.status = status;
    this.code = code;
  }
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

/** Clears the client-side ETag cache. */
export function clearFoodApiCache(): void {
  etagCache.clear();
}

function assertFoodPinsCollection(payload: unknown): FoodPinsFeatureCollection {
  if (!payload || typeof payload !== "object") {
    throw new FoodApiError(502, "INTERNAL_ERROR", "Invalid GeoJSON payload from Food API.");
  }
  const obj = payload as Record<string, unknown>;
  if (obj.type !== "FeatureCollection" || !Array.isArray(obj.features)) {
    throw new FoodApiError(502, "INTERNAL_ERROR", "Food pins response is not a FeatureCollection.");
  }
  const metadata = obj.metadata as Record<string, unknown> | undefined;
  if (!metadata || metadata.overlay !== "food") {
    throw new FoodApiError(502, "INTERNAL_ERROR", "Food pins response missing food metadata.");
  }
  for (const feat of obj.features as Array<Record<string, unknown>>) {
    const props = feat?.properties as Record<string, unknown> | undefined;
    if (
      feat?.type !== "Feature" ||
      typeof feat.id !== "string" ||
      !props ||
      feat.id !== props.id ||
      props.pin_type !== "food_poi" ||
      !VALID_CATEGORIES.has(String(props.category)) ||
      (props.name_en === null && props.name_bn === null)
    ) {
      throw new FoodApiError(502, "INTERNAL_ERROR", "Food pin feature violated integration contract.");
    }
  }
  return payload as FoodPinsFeatureCollection;
}

function assertFoodPinDetail(payload: unknown): FoodPinDetail {
  if (!payload || typeof payload !== "object") {
    throw new FoodApiError(502, "INTERNAL_ERROR", "Invalid detail payload from Food API.");
  }
  const d = payload as Record<string, unknown>;
  if (
    typeof d.id !== "string" ||
    d.pin_type !== "food_poi" ||
    typeof d.district_id !== "string" ||
    !VALID_CATEGORIES.has(String(d.category)) ||
    (d.name_en === null && d.name_bn === null) ||
    !Array.isArray(d.photos) ||
    !Array.isArray(d.youtube_video_ids) ||
    !Array.isArray(d.videos)
  ) {
    throw new FoodApiError(502, "INTERNAL_ERROR", "Food pin detail violated integration contract.");
  }
  return payload as FoodPinDetail;
}

async function fetchLiveJson<T>(
  url: string,
  options: { signal?: AbortSignal; bypassCache?: boolean } = {}
): Promise<T> {
  const { signal, bypassCache = false } = options;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (!bypassCache) {
    const cached = etagCache.get(url);
    if (cached) {
      headers["If-None-Match"] = cached.etag;
    }
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers, signal, cache: "no-store" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new FoodApiError(503, "UPSTREAM_UNAVAILABLE", `Food API request failed: ${msg}`);
  }

  if (res.status === 304) {
    const cached = etagCache.get(url);
    if (cached) return cached.payload as T;
  }

  if (!res.ok) {
    let code = "INTERNAL_ERROR";
    let message = `Food API request failed with HTTP ${res.status}`;
    try {
      const body = (await res.json()) as ApiErrorResponse;
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.message) message = body.error.message;
    } catch {
      // Non-JSON error body; retain HTTP status fallback.
    }
    throw new FoodApiError(res.status, code, message);
  }

  const data = (await res.json()) as T;
  const etag = res.headers.get("ETag");
  if (etag) {
    etagCache.set(url, { etag, payload: data });
  }
  return data;
}

export interface FoodRequestOptions {
  signal?: AbortSignal;
  baseUrl?: string;
  bypassCache?: boolean;
}

/** Fetches live GeoJSON food pins (`GET /api/v1/pins?overlay=food`) from the Hono API. */
export async function getFoodPins(
  params: Omit<FoodPinsQueryParams, "overlay" | "refresh"> = {},
  options: FoodRequestOptions = {}
): Promise<FoodPinsFeatureCollection> {
  const baseUrl = (options.baseUrl ?? getFoodApiBaseUrl()).replace(/\/+$/, "");
  const search = new URLSearchParams({ overlay: "food" });

  if (params.district_id) search.set("district_id", params.district_id);
  if (params.bbox) search.set("bbox", params.bbox);
  if (params.category) {
    const cats = params.category
      .split(",")
      .map((c) => c.trim())
      .filter((c): c is FoodCategory => VALID_CATEGORIES.has(c));
    if (cats.length > 0) search.set("category", cats.join(","));
  }
  if (params.has_video !== undefined) search.set("has_video", String(params.has_video));

  const payload = await fetchLiveJson<unknown>(`${baseUrl}/api/v1/pins?${search.toString()}`, {
    signal: options.signal,
    bypassCache: options.bypassCache,
  });
  return assertFoodPinsCollection(payload);
}

/** Fetches live Rich Pin Card detail (`GET /api/v1/pins/food/:id`) from the Hono API. */
export async function getFoodPinDetail(
  id: string,
  options: FoodRequestOptions = {}
): Promise<FoodPinDetail | null> {
  const baseUrl = (options.baseUrl ?? getFoodApiBaseUrl()).replace(/\/+$/, "");
  try {
    const payload = await fetchLiveJson<unknown>(
      `${baseUrl}/api/v1/pins/food/${encodeURIComponent(id)}`,
      {
        signal: options.signal,
        bypassCache: options.bypassCache,
      }
    );
    return assertFoodPinDetail(payload);
  } catch (err) {
    if (err instanceof FoodApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/** Fetches live Food API health and PostGIS dataset counts. */
export async function getFoodApiHealth(
  options: FoodRequestOptions = {}
): Promise<FoodHealthResponse> {
  const baseUrl = (options.baseUrl ?? getFoodApiBaseUrl()).replace(/\/+$/, "");
  return fetchLiveJson<FoodHealthResponse>(`${baseUrl}/api/v1/food/health`, {
    signal: options.signal,
    bypassCache: true,
  });
}
