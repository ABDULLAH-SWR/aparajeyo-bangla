import { getFoodApiBaseUrl } from "./constants";
import mockPinsRaw from "./mocks/food_pins.geojson.json";
import mockPinDetailRaw from "./mocks/food_pin_detail.json";
import mockPinDetailMinimalRaw from "./mocks/food_pin_detail_minimal.json";
import type {
  ApiErrorResponse,
  FoodCategory,
  FoodPinDetail,
  FoodPinFeature,
  FoodPinsFeatureCollection,
  FoodPinsQueryParams,
} from "./types";

const mockPins = mockPinsRaw as unknown as FoodPinsFeatureCollection;
const mockDetail = mockPinDetailRaw as unknown as FoodPinDetail;
const mockDetailMinimal = mockPinDetailMinimalRaw as unknown as FoodPinDetail;
const mockDetailsById: Record<string, FoodPinDetail> = {
  [mockDetail.id]: mockDetail,
  [mockDetailMinimal.id]: mockDetailMinimal,
};

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

function filterMockPins(
  collection: FoodPinsFeatureCollection,
  params: Omit<FoodPinsQueryParams, "overlay">
): FoodPinsFeatureCollection {
  let features: FoodPinFeature[] = collection.features;

  if (params.district_id) {
    features = features.filter((f) => f.properties.district_id === params.district_id);
  }

  if (params.bbox) {
    const parts = params.bbox.split(",").map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      const [minLng, minLat, maxLng, maxLat] = parts;
      features = features.filter((f) => {
        const [lng, lat] = f.geometry.coordinates;
        return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
      });
    }
  }

  if (params.category) {
    const allowed = new Set(
      params.category
        .split(",")
        .map((c) => c.trim() as FoodCategory)
        .filter(Boolean)
    );
    if (allowed.size > 0) {
      features = features.filter((f) => allowed.has(f.properties.category));
    }
  }

  if (params.has_video === true) {
    features = features.filter((f) => f.properties.has_video);
  }

  return {
    type: "FeatureCollection",
    metadata: {
      ...collection.metadata,
      district_id: params.district_id ?? null,
      total_count: features.length,
      truncated: false,
    },
    features,
  };
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }
  let code = "INTERNAL_ERROR";
  let message = `Food API request failed with HTTP ${res.status}`;
  try {
    const body = (await res.json()) as ApiErrorResponse;
    if (body?.error?.code) code = body.error.code;
    if (body?.error?.message) message = body.error.message;
  } catch {
    // Non-JSON error body; keep fallback error envelope values.
  }
  throw new FoodApiError(res.status, code, message);
}

/**
 * Fetches GeoJSON food pins (`GET /api/v1/pins?overlay=food`).
 * Uses local M0 mock fixtures when `FOOD_API_BASE_URL` is not configured.
 */
export async function getFoodPins(
  params: Omit<FoodPinsQueryParams, "overlay"> = {},
  signal?: AbortSignal
): Promise<FoodPinsFeatureCollection> {
  const baseUrl = getFoodApiBaseUrl();
  if (!baseUrl) {
    return filterMockPins(mockPins, params);
  }

  const search = new URLSearchParams({ overlay: "food" });
  if (params.district_id) search.set("district_id", params.district_id);
  if (params.bbox) search.set("bbox", params.bbox);
  if (params.category) search.set("category", params.category);
  if (params.has_video !== undefined) search.set("has_video", String(params.has_video));

  const res = await fetch(`${baseUrl}/api/v1/pins?${search.toString()}`, { signal });
  return parseJsonOrThrow<FoodPinsFeatureCollection>(res);
}

/**
 * Fetches full Rich Pin Card detail (`GET /api/v1/pins/food/:id`).
 * Returns null if not found when operating on M0 mocks, or throws `FoodApiError` on live API errors.
 */
export async function getFoodPinDetail(
  id: string,
  signal?: AbortSignal
): Promise<FoodPinDetail | null> {
  const baseUrl = getFoodApiBaseUrl();
  if (!baseUrl) {
    if (mockDetailsById[id]) {
      return mockDetailsById[id];
    }
    const summary = mockPins.features.find((f) => f.id === id);
    if (!summary) return null;

    // Synthesize a minimal contract-compliant detail for remaining mock pins.
    return {
      id: summary.id,
      pin_type: "food_poi",
      district_id: summary.properties.district_id,
      district_name_en: summary.properties.district_id,
      district_name_bn: summary.properties.district_id,
      upazila_id: summary.properties.upazila_id,
      upazila_name_en: null,
      upazila_name_bn: null,
      coordinates: summary.geometry.coordinates,
      name_en: summary.properties.name_en,
      name_bn: summary.properties.name_bn,
      category: summary.properties.category,
      cuisines: ["other"],
      description_en: null,
      description_bn: null,
      address_en: null,
      address_bn: null,
      opening_hours: null,
      phone: null,
      website: null,
      photos: [],
      youtube_video_ids: [],
      videos: [],
      source: summary.properties.source,
      source_id: `mock/${summary.id}`,
      osm_attribution: {
        text:
          summary.properties.source === "osm"
            ? "© OpenStreetMap contributors"
            : "© Overture Maps Foundation",
        url:
          summary.properties.source === "osm"
            ? "https://www.openstreetmap.org/copyright"
            : "https://overturemaps.org/",
        license: summary.properties.source === "osm" ? "ODbL-1.0" : "CDLA-Permissive-2.0",
      },
      rating: null,
      review_count: null,
      updated_at: "2026-11-26T14:00:00+06:00",
    };
  }

  const res = await fetch(`${baseUrl}/api/v1/pins/food/${encodeURIComponent(id)}`, { signal });
  if (res.status === 404) return null;
  return parseJsonOrThrow<FoodPinDetail>(res);
}
