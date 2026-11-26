#!/usr/bin/env node
/**
 * Validates Food M0 mock fixtures against Aparajeyo README §5 and Food Guide §10.
 * Zero external dependencies — runs with `node` or `bun`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const FOOD_CATEGORIES = new Set([
  "restaurant",
  "street_food",
  "cafe",
  "tea_stall",
  "sweets_bakery",
  "fast_food",
  "food_court",
  "dessert",
  "other",
]);

const FOOD_CUISINES = new Set([
  "bangladeshi",
  "biryani_kacchi",
  "fish_seafood",
  "kebab_grill",
  "pitha",
  "mishti",
  "chinese_thai",
  "indian",
  "western",
  "other",
]);

const PLACE_SOURCES = new Set(["osm", "overture"]);
const PHOTO_SOURCES = new Set(["wikimedia", "ugc"]);
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BST_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+06:00$/;
const FORBIDDEN_PATTERNS = [
  "maps.googleapis.com",
  "places.googleapis.com",
  "upload.wikimedia.org",
  "search.list",
];

function parseCliArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

function readJson(filePath, errors) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    errors.push(`Invalid JSON in ${filePath}: ${err.message}`);
    return null;
  }
}

function assertCompliance(rawText, label, errors) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (rawText.includes(pattern)) {
      errors.push(`${label}: forbidden ToS/media string found: "${pattern}"`);
    }
  }
}

function assertCoordsInBangladesh(coords, label, errors) {
  if (!Array.isArray(coords) || coords.length !== 2) {
    errors.push(`${label}: coordinates must be [lng, lat]`);
    return;
  }
  const [lng, lat] = coords;
  if (typeof lng !== "number" || typeof lat !== "number") {
    errors.push(`${label}: coordinates must be numbers`);
    return;
  }
  if (lng < 88 || lng > 93 || lat < 20.5 || lat > 26.8) {
    errors.push(`${label}: coordinates [${lng}, ${lat}] outside Bangladesh bounds`);
  }
}

function validatePinsCollection(filePath, districtsById, upazilasById, errors) {
  const raw = fs.readFileSync(filePath, "utf8");
  assertCompliance(raw, filePath, errors);
  const data = readJson(filePath, errors);
  if (!data) return;

  if (data.type !== "FeatureCollection") {
    errors.push(`${filePath}: root.type must be "FeatureCollection"`);
  }
  if (!data.metadata || data.metadata.overlay !== "food") {
    errors.push(`${filePath}: metadata.overlay must be "food"`);
  }
  if (!Array.isArray(data.features)) {
    errors.push(`${filePath}: features must be an array`);
    return;
  }
  if (data.metadata?.total_count !== data.features.length) {
    errors.push(
      `${filePath}: metadata.total_count (${data.metadata?.total_count}) !== features.length (${data.features.length})`
    );
  }

  const seenCategories = new Set();
  const seenSources = new Set();
  const seenDistricts = new Set();
  let sawNullThumb = false;
  let sawSetThumb = false;
  let sawHasVideoTrue = false;
  let sawHasVideoFalse = false;

  for (const [idx, feature] of data.features.entries()) {
    const label = `${path.basename(filePath)}#features[${idx}]`;
    const p = feature?.properties;
    if (feature?.type !== "Feature") errors.push(`${label}: type must be "Feature"`);
    if (!UUID_V4_RE.test(feature?.id ?? "")) errors.push(`${label}: id must be UUID v4`);
    if (feature?.id !== p?.id) errors.push(`${label}: feature.id !== properties.id`);
    if (feature?.geometry?.type !== "Point") errors.push(`${label}: geometry.type must be "Point"`);
    assertCoordsInBangladesh(feature?.geometry?.coordinates, label, errors);

    if (!p) {
      errors.push(`${label}: missing properties`);
      continue;
    }
    if (p.pin_type !== "food_poi") errors.push(`${label}: pin_type must be "food_poi"`);

    const dist = districtsById.get(p.district_id);
    if (!dist) {
      errors.push(`${label}: unknown district_id "${p.district_id}"`);
    } else {
      seenDistricts.add(p.district_id);
    }

    if (p.upazila_id !== null) {
      const up = upazilasById.get(p.upazila_id);
      if (!up) {
        errors.push(`${label}: unknown upazila_id "${p.upazila_id}"`);
      } else if (up.district_id !== p.district_id) {
        errors.push(
          `${label}: upazila_id "${p.upazila_id}" belongs to ${up.district_id}, not ${p.district_id}`
        );
      }
    }

    if (p.name_en === null && p.name_bn === null) {
      errors.push(`${label}: at least one of name_en / name_bn must be non-null`);
    }

    if (!FOOD_CATEGORIES.has(p.category)) {
      errors.push(`${label}: invalid category "${p.category}"`);
    } else {
      seenCategories.add(p.category);
    }

    if (!PLACE_SOURCES.has(p.source)) {
      errors.push(`${label}: invalid source "${p.source}"`);
    } else {
      seenSources.add(p.source);
    }

    if (typeof p.has_video !== "boolean") {
      errors.push(`${label}: has_video must be boolean`);
    } else {
      if (p.has_video) sawHasVideoTrue = true;
      else sawHasVideoFalse = true;
    }

    if (p.thumbnail_url === null) {
      sawNullThumb = true;
    } else if (typeof p.thumbnail_url === "string") {
      sawSetThumb = true;
    } else {
      errors.push(`${label}: thumbnail_url must be string or null`);
    }
  }

  for (const cat of FOOD_CATEGORIES) {
    if (!seenCategories.has(cat)) {
      errors.push(`${filePath}: mock must cover FoodCategory "${cat}"`);
    }
  }
  for (const src of PLACE_SOURCES) {
    if (!seenSources.has(src)) {
      errors.push(`${filePath}: mock must cover PlaceSource "${src}"`);
    }
  }
  if (seenDistricts.size < 4) {
    errors.push(`${filePath}: mock must span at least 4 districts (found ${seenDistricts.size})`);
  }
  if (!sawNullThumb || !sawSetThumb) {
    errors.push(`${filePath}: mock must include both null and non-null thumbnail_url`);
  }
  if (!sawHasVideoTrue || !sawHasVideoFalse) {
    errors.push(`${filePath}: mock must include both has_video=true and has_video=false`);
  }
}

function validatePinDetail(filePath, districtsById, upazilasById, errors) {
  const raw = fs.readFileSync(filePath, "utf8");
  assertCompliance(raw, filePath, errors);
  const d = readJson(filePath, errors);
  if (!d) return;

  const label = path.basename(filePath);
  if (!UUID_V4_RE.test(d.id ?? "")) errors.push(`${label}: id must be UUID v4`);
  if (d.pin_type !== "food_poi") errors.push(`${label}: pin_type must be "food_poi"`);
  assertCoordsInBangladesh(d.coordinates, label, errors);

  const dist = districtsById.get(d.district_id);
  if (!dist) {
    errors.push(`${label}: unknown district_id "${d.district_id}"`);
  } else if (d.district_name_en !== dist.name_en) {
    errors.push(`${label}: district_name_en "${d.district_name_en}" !== "${dist.name_en}"`);
  }

  if (d.upazila_id !== null) {
    const up = upazilasById.get(d.upazila_id);
    if (!up) {
      errors.push(`${label}: unknown upazila_id "${d.upazila_id}"`);
    } else if (up.district_id !== d.district_id) {
      errors.push(`${label}: upazila_id "${d.upazila_id}" does not belong to ${d.district_id}`);
    }
  }

  if (d.name_en === null && d.name_bn === null) {
    errors.push(`${label}: at least one of name_en / name_bn must be non-null`);
  }
  if (!FOOD_CATEGORIES.has(d.category)) {
    errors.push(`${label}: invalid category "${d.category}"`);
  }
  if (!Array.isArray(d.cuisines) || d.cuisines.some((c) => !FOOD_CUISINES.has(c))) {
    errors.push(`${label}: invalid cuisines array`);
  }
  if (!PLACE_SOURCES.has(d.source) || typeof d.source_id !== "string" || !d.source_id) {
    errors.push(`${label}: invalid source / source_id`);
  }
  if (!d.osm_attribution?.text || !d.osm_attribution?.url || !d.osm_attribution?.license) {
    errors.push(`${label}: incomplete osm_attribution`);
  }

  if (!Array.isArray(d.photos)) {
    errors.push(`${label}: photos must be an array`);
  } else {
    for (const [i, photo] of d.photos.entries()) {
      if (!PHOTO_SOURCES.has(photo.source)) {
        errors.push(`${label}#photos[${i}]: invalid source "${photo.source}"`);
      }
      if (!photo.thumb_url || !photo.url || !photo.credit?.author || !photo.credit?.license) {
        errors.push(`${label}#photos[${i}]: missing URL or credit fields`);
      }
    }
  }

  if (!Array.isArray(d.youtube_video_ids) || !Array.isArray(d.videos)) {
    errors.push(`${label}: youtube_video_ids and videos must be arrays`);
  } else {
    const videoIds = d.videos.map((v) => v.video_id);
    if (JSON.stringify(d.youtube_video_ids) !== JSON.stringify(videoIds)) {
      errors.push(`${label}: youtube_video_ids must match videos[].video_id in order`);
    }
    for (const [i, v] of d.videos.entries()) {
      if (!BST_ISO_RE.test(v.published_at ?? "")) {
        errors.push(`${label}#videos[${i}]: published_at must be ISO 8601 +06:00`);
      }
    }
  }

  if (d.rating !== null || d.review_count !== null) {
    errors.push(`${label}: rating and review_count must be null in Phase 3 MVP`);
  }
  if (!BST_ISO_RE.test(d.updated_at ?? "")) {
    errors.push(`${label}: updated_at must be ISO 8601 +06:00`);
  }
}

function main() {
  const errors = [];
  const geoPath =
    parseCliArg("--geo-codes") ??
    process.env.GEO_CODES_PATH ??
    path.resolve(repoRoot, "../Aparajeyo_Doc/Documentaion/contracts/news_map/geo_codes.json");

  if (!fs.existsSync(geoPath)) {
    console.error(`geo_codes.json not found at ${geoPath}`);
    process.exit(1);
  }

  const geo = readJson(geoPath, errors);
  const districtsById = new Map((geo?.districts ?? []).map((d) => [d.id, d]));
  const upazilasById = new Map((geo?.upazilas ?? []).map((u) => [u.id, u]));

  const appMocksDir = path.join(repoRoot, "src/features/food/mocks");
  const docMocksDir = path.resolve(repoRoot, "../Aparajeyo_Doc/Documentaion/contracts/food_map/mocks");

  const dirsToCheck = [appMocksDir];
  if (fs.existsSync(docMocksDir)) dirsToCheck.push(docMocksDir);

  for (const dir of dirsToCheck) {
    validatePinsCollection(
      path.join(dir, "food_pins.geojson.json"),
      districtsById,
      upazilasById,
      errors
    );
    validatePinDetail(path.join(dir, "food_pin_detail.json"), districtsById, upazilasById, errors);
    validatePinDetail(
      path.join(dir, "food_pin_detail_minimal.json"),
      districtsById,
      upazilasById,
      errors
    );
  }

  // Verify app mocks stay byte-identical to contract mocks when Aparajeyo_Doc is present.
  if (fs.existsSync(docMocksDir)) {
    for (const file of [
      "food_pins.geojson.json",
      "food_pin_detail.json",
      "food_pin_detail_minimal.json",
    ]) {
      const a = fs.readFileSync(path.join(appMocksDir, file), "utf8").replace(/\r\n/g, "\n");
      const b = fs.readFileSync(path.join(docMocksDir, file), "utf8").replace(/\r\n/g, "\n");
      if (a !== b) {
        errors.push(`Mock drift detected between Aparajeyo_Bangla and Aparajeyo_Doc for ${file}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`Food mock validation FAILED (${errors.length} issue(s)):`);
    for (const err of errors) console.error(` - ${err}`);
    process.exit(1);
  }

  console.log("Food mock validation PASSED across all fixtures and contract rules.");
}

main();
