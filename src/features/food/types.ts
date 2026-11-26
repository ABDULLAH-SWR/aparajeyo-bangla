/**
 * Aparajeyo: Food <-> Map Integration Contract Types (v0.1 - M0)
 *
 * Mirror of Aparajeyo_Doc/Documentaion/contracts/food_map/types.ts.
 * Zero-dependency TypeScript types shared between the Food track
 * (places-media-sync / geospatial-api) and Product B (Interactive Map).
 * All JSON payloads use snake_case.
 */

/** GeoJSON Point coordinates in [longitude, latitude] (SRID 4326). */
export type LngLat = [number, number];

export type FoodCategory =
  | "restaurant"
  | "street_food"
  | "cafe"
  | "tea_stall"
  | "sweets_bakery"
  | "fast_food"
  | "food_court"
  | "dessert"
  | "other";

/** Proposed: closed cuisine tags derived from OSM `cuisine` and Overture category. */
export type FoodCuisine =
  | "bangladeshi"
  | "biryani_kacchi"
  | "fish_seafood"
  | "kebab_grill"
  | "pitha"
  | "mishti"
  | "chinese_thai"
  | "indian"
  | "western"
  | "other";

export type PlaceSource = "osm" | "overture";

export type FoodPhotoSource = "wikimedia" | "ugc";

/* -------------------------------------------------------------------------- */
/* 1. GET /api/v1/pins?overlay=food                                           */
/* -------------------------------------------------------------------------- */

export interface FoodPinsQueryParams {
  overlay: "food";
  /** 6-char HDX COD-AB ADM2_PCODE (e.g. "BD3026"). */
  district_id?: string;
  /** Proposed: "minLng,minLat,maxLng,maxLat" viewport bounding box. */
  bbox?: string;
  /** Comma-separated FoodCategory values. */
  category?: string;
  /** When true, return only places with at least one approved video. */
  has_video?: boolean;
}

export interface FoodPinProperties {
  /** Place UUID v4 (matches top-level Feature.id). */
  id: string;
  /** Constant discriminator for cross-overlay pin routing. */
  pin_type: "food_poi";
  /** 6-char HDX COD-AB ADM2_PCODE (e.g. "BD3026"). */
  district_id: string;
  /** 10-char HDX COD-AB ADM3_PCODE (e.g. "BD30262000"), or null. */
  upazila_id: string | null;
  /** English place name (at least one of name_en / name_bn is non-null). */
  name_en: string | null;
  /** Bangla place name (at least one of name_en / name_bn is non-null). */
  name_bn: string | null;
  category: FoodCategory;
  has_video: boolean;
  /** HMAC-signed imgproxy URL (~320px thumbnail), or null if no photo. */
  thumbnail_url: string | null;
  source: PlaceSource;
}

export interface FoodPinFeature {
  type: "Feature";
  /** Place UUID v4 (matches properties.id for MapLibre promoteId). */
  id: string;
  geometry: {
    type: "Point";
    coordinates: LngLat;
  };
  properties: FoodPinProperties;
}

export interface FoodPinsMetadata {
  overlay: "food";
  /** Requested 6-char ADM2_PCODE, or null for national/bbox queries. */
  district_id: string | null;
  total_count: number;
  /** True when results hit the response cap (2,000 national / 5,000 scoped). */
  truncated: boolean;
  /** Monthly dataset version date (YYYY-MM-DD). */
  dataset_version: string;
  attribution_text: string;
}

export interface FoodPinsFeatureCollection {
  type: "FeatureCollection";
  metadata: FoodPinsMetadata;
  features: FoodPinFeature[];
}

/* -------------------------------------------------------------------------- */
/* 2. GET /api/v1/pins/food/:id                                               */
/* -------------------------------------------------------------------------- */

export interface FoodPhotoCredit {
  author: string;
  /** License short name (e.g. "CC BY-SA 4.0", "CC0 1.0"). */
  license: string;
  license_url: string;
  /** Canonical Wikimedia Commons file page URL (or UGC attribution page). */
  source_page_url: string;
}

export interface FoodPhoto {
  /** HMAC-signed imgproxy URL (~320px). */
  thumb_url: string;
  /** HMAC-signed imgproxy URL (~1280px). */
  url: string;
  /** Original image width in pixels. */
  width: number;
  /** Original image height in pixels. */
  height: number;
  /** "ugc" reserved for Phase 4 (community-ugc). */
  source: FoodPhotoSource;
  credit: FoodPhotoCredit;
}

export interface FoodVideo {
  /** YouTube 11-char video ID (embed via https://www.youtube-nocookie.com/embed/{video_id}). */
  video_id: string;
  title: string;
  channel_id: string;
  channel_title: string;
  /** ISO 8601 timestamp in Asia/Dhaka (+06:00). */
  published_at: string;
  duration_seconds: number;
  /** Chapter start offset in seconds when a food tour visits multiple places, else null. */
  start_seconds: number | null;
}

export interface OsmAttribution {
  text: string;
  url: string;
  license: string;
}

export interface FoodPinDetail {
  id: string;
  pin_type: "food_poi";
  district_id: string;
  district_name_en: string;
  district_name_bn: string;
  upazila_id: string | null;
  upazila_name_en: string | null;
  upazila_name_bn: string | null;
  coordinates: LngLat;
  name_en: string | null;
  name_bn: string | null;
  category: FoodCategory;
  cuisines: FoodCuisine[];
  description_en: string | null;
  description_bn: string | null;
  address_en: string | null;
  address_bn: string | null;
  /** Raw OSM opening_hours syntax (e.g. "Mo-Su 11:00-23:00"), or null. */
  opening_hours: string | null;
  phone: string | null;
  website: string | null;
  /** Empty array [] when no photos exist. */
  photos: FoodPhoto[];
  /** Ordered YouTube video IDs matching the `videos` array. */
  youtube_video_ids: string[];
  /** Proposed: enriched video metadata for the Rich Pin Card. */
  videos: FoodVideo[];
  source: PlaceSource;
  /** e.g. "node/123456", "way/789012", or Overture GERS ID. */
  source_id: string;
  /** Required for both OSM and Overture rows. */
  osm_attribution: OsmAttribution;
  /** Reserved for Phase 4 (community-ugc); null in Phase 3 MVP. */
  rating: number | null;
  /** Reserved for Phase 4 (community-ugc); null in Phase 3 MVP. */
  review_count: number | null;
  /** ISO 8601 timestamp in Asia/Dhaka (+06:00). */
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* 3. Standard Error Envelope                                                 */
/* -------------------------------------------------------------------------- */

export type FoodErrorCode =
  | "INVALID_ID"
  | "INVALID_DISTRICT"
  | "INVALID_BBOX"
  | "INVALID_CATEGORY"
  | "FOOD_PLACE_NOT_FOUND"
  | "INTERNAL_ERROR"
  | string;

export interface ApiErrorResponse {
  error: {
    code: FoodErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}
