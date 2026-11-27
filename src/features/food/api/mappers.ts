// Pure row-to-DTO mapping.
import type { FoodPhoto, FoodPinDetail, FoodPinFeature, FoodPinsFeatureCollection } from "../types";
import type { ImgproxySigner } from "./imgproxy";
import { pinCap, type PhotoRow, type PinRow, type PinScope, type PlaceRow, type VideoRow } from "./repository";

const ATTRIBUTION_TEXT = "© OpenStreetMap contributors, Overture Maps Foundation";

function formatOsmAddress(tags: Record<string, unknown>): string | null {
  if (typeof tags["addr:full"] === "string" && tags["addr:full"].trim()) {
    return tags["addr:full"].trim();
  }
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** The first of `keys` that holds a string tag. */
function firstTag(tags: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = tags[key];
    if (typeof value === "string") return value;
  }
  return null;
}

function toPhoto(row: PhotoRow, signer: ImgproxySigner): FoodPhoto {
  return {
    thumb_url: signer.sign(row.s3_key, 320),
    url: signer.sign(row.s3_key, 1280),
    width: row.width,
    height: row.height,
    source: row.source,
    credit: {
      author: row.author,
      license: row.license,
      license_url: row.license_url,
      source_page_url: row.source_page_url,
    },
  };
}

export function toPinDetail(
  row: PlaceRow,
  photos: PhotoRow[],
  videos: VideoRow[],
  signer: ImgproxySigner,
): FoodPinDetail {
  const osm = row.source === "osm";
  return {
    id: row.id,
    pin_type: "food_poi",
    district_id: row.district_id,
    district_name_en: row.district_name_en,
    district_name_bn: row.district_name_bn,
    upazila_id: row.upazila_id,
    upazila_name_en: row.upazila_name_en,
    upazila_name_bn: row.upazila_name_bn,
    coordinates: [row.lng, row.lat],
    name_en: row.name_en,
    name_bn: row.name_bn,
    category: row.category,
    cuisines: row.cuisines,
    description_en: null,
    description_bn: null,
    address_en: formatOsmAddress(row.tags),
    address_bn: null,
    opening_hours: firstTag(row.tags, "opening_hours"),
    phone: firstTag(row.tags, "phone", "contact:phone"),
    website: firstTag(row.tags, "website", "contact:website"),
    photos: photos.map((photo) => toPhoto(photo, signer)),
    // Taken from the hydrated rows, so a match changed between the two queries cannot split them.
    youtube_video_ids: videos.map((v) => v.video_id),
    videos,
    source: row.source,
    source_id: row.source_id,
    osm_attribution: {
      text: osm ? "© OpenStreetMap contributors" : "© Overture Maps Foundation",
      url: osm ? "https://www.openstreetmap.org/copyright" : "https://overturemaps.org/",
      license: row.source_license,
    },
    rating: null,
    review_count: null,
    updated_at: row.updated_at,
  };
}

function toPinFeature(row: PinRow, signer: ImgproxySigner): FoodPinFeature {
  return {
    type: "Feature",
    id: row.id,
    geometry: { type: "Point", coordinates: [row.lng, row.lat] },
    properties: {
      id: row.id,
      pin_type: "food_poi",
      district_id: row.district_id,
      upazila_id: row.upazila_id,
      name_en: row.name_en,
      name_bn: row.name_bn,
      category: row.category,
      has_video: row.has_video,
      thumbnail_url: row.thumb_s3_key === null ? null : signer.sign(row.thumb_s3_key, 320),
      source: row.source,
    },
  };
}

export function toCollection(
  rows: PinRow[],
  context: { scope: PinScope; datasetVersion: string; signer: ImgproxySigner },
): FoodPinsFeatureCollection {
  const cap = pinCap(context.scope);
  const truncated = rows.length > cap;
  const features = rows.slice(0, cap).map((row) => toPinFeature(row, context.signer));
  return {
    type: "FeatureCollection",
    metadata: {
      overlay: "food",
      district_id: context.scope.kind === "district" ? context.scope.id : null,
      total_count: features.length,
      truncated,
      dataset_version: context.datasetVersion,
      attribution_text: ATTRIBUTION_TEXT,
    },
    features,
  };
}
