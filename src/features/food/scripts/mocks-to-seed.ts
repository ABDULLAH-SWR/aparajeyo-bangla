// Writes db/seeds/from_mocks.sql: rows from which the API serves the contract mocks (Guide §7.3
// Slice 1.8).
//   bun ../scripts/mocks-to-seed.ts      (from api/) write the file
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FoodPinDetailSchema, FoodPinsFeatureCollectionSchema } from "../contract/schemas";
import type { FoodPhoto, FoodPinDetail, FoodPinFeature, FoodVideo } from "../types";

const MOCKS = fileURLToPath(new URL("../testdata/contract_mocks", import.meta.url));
const SEED = fileURLToPath(new URL("../db/seeds/from_mocks.sql", import.meta.url));

const literal = (value: string | null) => (value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`);
const textArray = (values: string[]) => `ARRAY[${values.map(literal).join(", ")}]::text[]`;
const point = ([lng, lat]: [number, number]) => `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
/** The boundary columns are required, but no query behind these responses reads them. */
const around = (at: [number, number]) => `ST_Multi(ST_Expand(${point(at)}, 0.01))`;

/** The OSM tags the API's mappers read the optional detail fields from. */
function tagsOf(d: FoodPinDetail): string {
  const tags = {
    "description:en": d.description_en,
    "description:bn": d.description_bn,
    "addr:full": d.address_en,
    "addr:full:bn": d.address_bn,
    opening_hours: d.opening_hours,
    phone: d.phone,
    website: d.website,
  };
  return literal(JSON.stringify(Object.fromEntries(Object.entries(tags).filter(([, value]) => value !== null))));
}

/** The object key of a signed URL: `.../plain/s3://{bucket}/{key}`. */
function s3KeyOf(url: string): string {
  const key = /\/plain\/s3:\/\/[^/]+\/(.+)$/.exec(url)?.[1];
  if (key === undefined) throw new Error(`not a signed image URL: ${url}`);
  return key;
}

function insertPhoto(placeId: string, order: number, photo: FoodPhoto): string {
  const key = s3KeyOf(photo.thumb_url);
  const { credit } = photo;
  return (
    "INSERT INTO place_photos (place_id, s3_key, sha256, source, author, license, license_url," +
    " source_page_url, width, height, sort_order) VALUES" +
    ` (${literal(placeId)}, ${literal(key)}, ${literal(createHash("sha256").update(key).digest("hex"))},` +
    ` ${literal(photo.source)}, ${literal(credit.author)}, ${literal(credit.license)},` +
    ` ${literal(credit.license_url)}, ${literal(credit.source_page_url)}, ${photo.width}, ${photo.height}, ${order});`
  );
}

/** Videos are served by descending match confidence, so `order` becomes the confidence. */
function insertVideo(placeId: string, order: number, video: FoodVideo): string[] {
  const confidence = (0.99 - order / 100).toFixed(2);
  return [
    "INSERT INTO youtube_channels (channel_id, uploads_playlist_id, title, overlay_type) VALUES" +
      ` (${literal(video.channel_id)}, ${literal(`UU${video.channel_id.slice(2)}`)},` +
      ` ${literal(video.channel_title)}, 'food') ON CONFLICT (channel_id) DO NOTHING;`,
    "INSERT INTO youtube_videos (video_id, channel_id, title, published_at, duration_seconds," +
      " last_verified_at) VALUES" +
      ` (${literal(video.video_id)}, ${literal(video.channel_id)}, ${literal(video.title)},` +
      ` ${literal(video.published_at)}, ${video.duration_seconds}, ${literal(video.published_at)})` +
      " ON CONFLICT (video_id) DO NOTHING;",
    "INSERT INTO video_place_matches (video_id, place_id, confidence, method, start_seconds, status) VALUES" +
      ` (${literal(video.video_id)}, ${literal(placeId)}, ${confidence}, 'manual',` +
      ` ${video.start_seconds ?? "NULL"}, 'approved');`,
  ];
}

/**
 * What a pin without a detail mock needs in the database. Only the fields its pin shows come from the
 * mock. The rest are placeholders that no mocked response contains.
 */
function placeOfPin({ geometry, properties: pin }: FoodPinFeature): FoodPinDetail {
  const placeholder = "https://example.invalid/";
  const video: FoodVideo = {
    video_id: `mockvid${pin.id.slice(-4)}`,
    title: "Placeholder video",
    channel_id: `UC${"x".repeat(22)}`,
    channel_title: "Placeholder channel",
    published_at: "2026-01-01T00:00:00+06:00",
    duration_seconds: 60,
    start_seconds: null,
  };
  const photo = (thumbUrl: string): FoodPhoto => ({
    thumb_url: thumbUrl,
    url: thumbUrl,
    width: 320,
    height: 240,
    source: "wikimedia",
    credit: { author: "Placeholder", license: "CC0 1.0", license_url: placeholder, source_page_url: placeholder },
  });
  const license = pin.source === "osm" ? "ODbL-1.0" : "CDLA-Permissive-2.0";
  return {
    ...pin,
    district_name_en: pin.district_id,
    district_name_bn: pin.district_id,
    upazila_name_en: pin.upazila_id,
    upazila_name_bn: pin.upazila_id,
    coordinates: geometry.coordinates,
    cuisines: ["other"],
    description_en: null,
    description_bn: null,
    address_en: null,
    address_bn: null,
    opening_hours: null,
    phone: null,
    website: null,
    photos: pin.thumbnail_url === null ? [] : [photo(pin.thumbnail_url)],
    youtube_video_ids: pin.has_video ? [video.video_id] : [],
    videos: pin.has_video ? [video] : [],
    source_id: `mock/${pin.id}`,
    osm_attribution: { text: license, url: placeholder, license },
    rating: null,
    review_count: null,
    updated_at: "2026-01-01T00:00:00+06:00",
  };
}

/** One record per mocked place. A detail mock wins over its pin, and comes last so its names do too. */
function placesIn(mocksDir: string): FoodPinDetail[] {
  const read = (file: string): unknown => JSON.parse(readFileSync(join(mocksDir, file), "utf8"));
  const files = readdirSync(mocksDir).filter((file) => file.endsWith(".json")).sort();
  const isPins = (file: string) => file.endsWith(".geojson.json");
  const details = files.filter((file) => !isPins(file)).map((file) => FoodPinDetailSchema.parse(read(file)));
  const detailed = new Set(details.map((d) => d.id));
  const others = files
    .filter(isPins)
    .flatMap((file) => FoodPinsFeatureCollectionSchema.parse(read(file)).features)
    .filter((feature) => !detailed.has(feature.id))
    .map(placeOfPin);
  return [...others, ...details];
}

export function mocksToSeed(mocksDir = MOCKS): string {
  const places = placesIn(mocksDir);

  const lines = [
    "-- Generated by scripts/mocks-to-seed.ts from testdata/contract_mocks. Do not edit.",
    "-- Loads on top of the migrations; test databases only.",
  ];

  for (const d of places) {
    lines.push(
      "INSERT INTO geo_districts (id, name_en, name_bn, geom) VALUES" +
        ` (${literal(d.district_id)}, ${literal(d.district_name_en)}, ${literal(d.district_name_bn)}, ${around(d.coordinates)})` +
        " ON CONFLICT (id) DO UPDATE SET name_en = EXCLUDED.name_en, name_bn = EXCLUDED.name_bn;",
    );
    if (d.upazila_id !== null) {
      lines.push(
        "INSERT INTO geo_upazilas (id, district_id, name_en, name_bn, geom) VALUES" +
          ` (${literal(d.upazila_id)}, ${literal(d.district_id)}, ${literal(d.upazila_name_en)}, ${literal(d.upazila_name_bn)}, ${around(d.coordinates)})` +
          " ON CONFLICT (id) DO UPDATE SET name_en = EXCLUDED.name_en, name_bn = EXCLUDED.name_bn;",
      );
    }
  }

  // Featured, so the national set holds every mocked place, with or without a video.
  for (const d of places) {
    lines.push(
      "INSERT INTO places (id, overlay_type, source, source_id, district_id, upazila_id, geom," +
        " name_en, name_bn, name_norm, category, cuisines, tags, source_license, is_featured) VALUES" +
        ` (${literal(d.id)}, 'food', ${literal(d.source)}, ${literal(d.source_id)}, ${literal(d.district_id)},` +
        ` ${literal(d.upazila_id)}, ${point(d.coordinates)}, ${literal(d.name_en)}, ${literal(d.name_bn)},` +
        ` ${literal((d.name_en ?? d.name_bn!).toLowerCase())}, ${literal(d.category)}, ${textArray(d.cuisines)},` +
        ` ${tagsOf(d)}, ${literal(d.osm_attribution.license)}, true);`,
    );
  }

  for (const d of places) {
    d.photos.forEach((photo, order) => lines.push(insertPhoto(d.id, order, photo)));
    d.videos.forEach((video, order) => lines.push(...insertVideo(d.id, order, video)));
  }

  // Last: adding media advances updated_at.
  for (const d of places) {
    lines.push(`UPDATE places SET updated_at = ${literal(d.updated_at)} WHERE id = ${literal(d.id)};`);
  }

  return `${lines.join("\n")}\n`;
}

if (import.meta.main) writeFileSync(SEED, mocksToSeed());
