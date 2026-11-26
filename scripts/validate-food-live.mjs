#!/usr/bin/env bun
/**
 * Comprehensive live API contract, caching, spatial, error-envelope, and media validator.
 * Tests the live Hono Food API (`:8002`), Valkey cache, PostGIS data, imgproxy+Garage S3,
 * Directus health, and `src/features/food/foodService.ts` against README §3/§5 & Guide §6/§10.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearFoodApiCache,
  FoodApiError,
  getFoodApiHealth,
  getFoodPinDetail,
  getFoodPins,
} from "../src/features/food/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const baseUrl = (process.env.FOOD_API_BASE_URL || "http://localhost:8002").replace(/\/+$/, "");

const VALID_CATEGORIES = new Set([
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
const VALID_CUISINES = new Set([
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
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BST_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+06:00$/;
const FORBIDDEN = ["maps.googleapis.com", "places.googleapis.com", "upload.wikimedia.org", "search.list"];

function assert(cond, msg, errors) {
  if (!cond) errors.push(msg);
}

async function safeJsonFetch(url, init = undefined) {
  const res = await fetch(url, init);
  const raw = await res.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  return { res, raw, json };
}

function validateFeatureList(features, label, districts, upazilas, errors) {
  for (const f of features) {
    const p = f?.properties;
    assert(f?.type === "Feature", `${label}: feature.type must be Feature`, errors);
    assert(UUID_V4_RE.test(f?.id ?? ""), `${label}: invalid UUID v4 ${f?.id}`, errors);
    assert(f?.id === p?.id, `${label}: feature.id !== properties.id for ${f?.id}`, errors);
    assert(p?.pin_type === "food_poi", `${label}: invalid pin_type ${p?.pin_type}`, errors);
    assert(districts.has(p?.district_id), `${label}: unknown district_id ${p?.district_id}`, errors);
    if (p?.upazila_id !== null) {
      const up = upazilas.get(p?.upazila_id);
      assert(Boolean(up) && up.district_id === p.district_id, `${label}: invalid upazila_id ${p?.upazila_id}`, errors);
    }
    const coords = f?.geometry?.coordinates;
    assert(Array.isArray(coords) && coords.length === 2, `${label}: invalid coordinates`, errors);
    if (Array.isArray(coords) && coords.length === 2) {
      const [lng, lat] = coords;
      assert(lng >= 88 && lng <= 93 && lat >= 20.5 && lat <= 26.8, `${label}: out of BD bounds ${lng},${lat}`, errors);
    }
    assert(VALID_CATEGORIES.has(p?.category), `${label}: invalid category ${p?.category}`, errors);
    assert(p?.name_en !== null || p?.name_bn !== null, `${label}: unnamed POI`, errors);
    assert(p?.source === "osm" || p?.source === "overture", `${label}: invalid source ${p?.source}`, errors);
  }
}

async function main() {
  const errors = [];
  const passed = [];
  const geoPath =
    process.env.GEO_CODES_PATH ||
    path.resolve(repoRoot, "../Aparajeyo_Doc/Documentaion/contracts/news_map/geo_codes.json");
  const geo = JSON.parse(fs.readFileSync(geoPath, "utf8"));
  const districts = new Map(geo.districts.map((d) => [d.id, d]));
  const upazilas = new Map(geo.upazilas.map((u) => [u.id, u]));

  // 1. Connectivity + Health check
  let healthFetch;
  try {
    healthFetch = await safeJsonFetch(`${baseUrl}/api/v1/food/health`);
  } catch (err) {
    console.error(`Cannot reach Food API at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`);
    console.error("Start it first with: bun --env-file=src/features/food/.env run src/features/food/api/server.ts");
    process.exit(1);
  }

  assert(healthFetch.res.status === 200, `Health returned ${healthFetch.res.status}: ${healthFetch.raw}`, errors);
  const health = healthFetch.json;
  if (healthFetch.res.status === 200 && health) {
    assert(health.status === "ok" && health.service === "aparajeyo-food-api", "Invalid health body", errors);
    assert(health.active_places > 0, `Expected >0 active places, got ${health.active_places}`, errors);
    assert(health.districts_covered === 64, `Expected 64 districts covered, got ${health.districts_covered}`, errors);
    passed.push(`Health (${health.active_places} POIs / ${health.districts_covered} districts)`);
  }

  // 2. National featured pins + ETag / 304
  const pinsFetch = await safeJsonFetch(`${baseUrl}/api/v1/pins?overlay=food`);
  assert(pinsFetch.res.status === 200, `GET national pins returned ${pinsFetch.res.status}: ${pinsFetch.raw}`, errors);
  for (const pat of FORBIDDEN) assert(!pinsFetch.raw.includes(pat), `Forbidden string ${pat} in pins`, errors);

  const pins = pinsFetch.json;
  const pinsFeatures = Array.isArray(pins?.features) ? pins.features : [];
  assert(pins?.type === "FeatureCollection", "National pins root type must be FeatureCollection", errors);
  assert(pins?.metadata?.overlay === "food", "National pins metadata.overlay must be food", errors);
  assert(Array.isArray(pins?.features), "National pins missing features array", errors);
  assert(pinsFeatures.length > 0 && pinsFeatures.length <= 2000, `National count ${pinsFeatures.length} out of 1..2000`, errors);
  if (pinsFeatures.length > 0) {
    validateFeatureList(pinsFeatures.slice(0, 100), "national", districts, upazilas, errors);
  }

  const etag = pinsFetch.res.headers.get("ETag");
  assert(Boolean(etag), "Missing ETag on GET /api/v1/pins", errors);
  if (etag) {
    const res304 = await fetch(`${baseUrl}/api/v1/pins?overlay=food`, {
      headers: { "If-None-Match": etag },
    });
    assert(res304.status === 304, `Expected 304 Not Modified, got ${res304.status}`, errors);
  }
  passed.push(`National pins (${pinsFeatures.length} features, ETag/304)`);

  // 3. Multi-district checks + Valkey cache HIT
  const testDistricts = ["BD3026", "BD2015", "BD6091", "BD5010"];
  let dhakaFeatures = [];
  for (const did of testDistricts) {
    const dFetch = await safeJsonFetch(`${baseUrl}/api/v1/pins?overlay=food&district_id=${did}`);
    assert(dFetch.res.status === 200, `District ${did} returned ${dFetch.res.status}: ${dFetch.raw}`, errors);
    const feats = Array.isArray(dFetch.json?.features) ? dFetch.json.features : [];
    assert(feats.length > 0, `Expected >0 POIs in district ${did}`, errors);
    if (feats.length > 0) {
      validateFeatureList(feats.slice(0, 50), `district:${did}`, districts, upazilas, errors);
    }
    if (did === "BD3026") {
      dhakaFeatures = feats;
      const dFetch2 = await safeJsonFetch(`${baseUrl}/api/v1/pins?overlay=food&district_id=BD3026`);
      assert(dFetch2.res.headers.get("X-Cache") === "HIT", `Expected Valkey X-Cache=HIT for BD3026, got ${dFetch2.res.headers.get("X-Cache")}`, errors);
    }
  }
  passed.push(`Multi-district (${testDistricts.join(", ")}, Dhaka=${dhakaFeatures.length}, Valkey HIT)`);

  // 4. BBox viewport filter
  const bboxFetch = await safeJsonFetch(`${baseUrl}/api/v1/pins?overlay=food&bbox=90.35,23.70,90.45,23.82`);
  assert(bboxFetch.res.status === 200, `BBox query returned ${bboxFetch.res.status}: ${bboxFetch.raw}`, errors);
  const bboxFeats = Array.isArray(bboxFetch.json?.features) ? bboxFetch.json.features : [];
  assert(bboxFeats.length > 0, "Expected >0 POIs in central Dhaka bbox", errors);
  for (const f of bboxFeats.slice(0, 50)) {
    const [lng, lat] = f.geometry.coordinates;
    assert(lng >= 90.35 && lng <= 90.45 && lat >= 23.70 && lat <= 23.82, `BBox pin out of requested box: ${lng},${lat}`, errors);
  }
  passed.push(`BBox query (${bboxFeats.length} features in Central Dhaka)`);

  // 5. Multi-category comma-separated filter + has_video filter
  const catFetch = await safeJsonFetch(
    `${baseUrl}/api/v1/pins?overlay=food&district_id=BD3026&category=tea_stall,sweets_bakery`
  );
  assert(catFetch.res.status === 200, `Category query returned ${catFetch.res.status}`, errors);
  const catFeats = Array.isArray(catFetch.json?.features) ? catFetch.json.features : [];
  assert(catFeats.length > 0, "Expected tea_stall/sweets_bakery POIs in Dhaka", errors);
  for (const f of catFeats.slice(0, 50)) {
    assert(
      f.properties?.category === "tea_stall" || f.properties?.category === "sweets_bakery",
      `Category filter leaked ${f.properties?.category}`,
      errors
    );
  }
  const vidFetch = await safeJsonFetch(`${baseUrl}/api/v1/pins?overlay=food&has_video=true`);
  assert(vidFetch.res.status === 200 && Array.isArray(vidFetch.json?.features), "has_video=true must return 200 FeatureCollection", errors);
  passed.push(`Category & has_video filters (${catFeats.length} tea/sweets in Dhaka)`);

  // 6. Detail endpoint for OSM + Overture + signed imgproxy photo
  const osmSample = dhakaFeatures.find((f) => f.properties?.source === "osm") ?? pinsFeatures.find((f) => f.properties?.source === "osm");
  const ovtSample = dhakaFeatures.find((f) => f.properties?.source === "overture") ?? pinsFeatures.find((f) => f.properties?.source === "overture");
  assert(Boolean(osmSample), "Expected at least one OSM sample feature", errors);
  assert(Boolean(ovtSample), "Expected at least one Overture sample feature", errors);

  for (const sample of [osmSample, ovtSample].filter(Boolean)) {
    const detFetch = await safeJsonFetch(`${baseUrl}/api/v1/pins/food/${sample.id}`);
    assert(detFetch.res.status === 200, `Detail for ${sample.id} returned ${detFetch.res.status}: ${detFetch.raw}`, errors);
    for (const pat of FORBIDDEN) assert(!detFetch.raw.includes(pat), `Forbidden string ${pat} in detail`, errors);
    const d = detFetch.json;
    if (d) {
      assert(d.id === sample.id && d.pin_type === "food_poi", "Detail id/pin_type mismatch", errors);
      assert(Array.isArray(d.cuisines) && d.cuisines.every((c) => VALID_CUISINES.has(c)), "Invalid detail cuisines", errors);
      assert(d.rating === null && d.review_count === null, "Phase 4 rating/review_count must be null", errors);
      assert(BST_ISO_RE.test(d.updated_at ?? ""), `Invalid BST updated_at: ${d.updated_at}`, errors);
      assert(Boolean(d.osm_attribution?.text && d.osm_attribution?.url && d.osm_attribution?.license), "Incomplete osm_attribution", errors);
      const detEtag = detFetch.res.headers.get("ETag");
      assert(Boolean(detEtag), "Missing ETag on detail", errors);
      if (detEtag) {
        const det304 = await fetch(`${baseUrl}/api/v1/pins/food/${sample.id}`, {
          headers: { "If-None-Match": detEtag },
        });
        assert(det304.status === 304, `Expected 304 on detail, got ${det304.status}`, errors);
      }
    }
  }

  const photoSample = pinsFeatures.find((f) => Boolean(f.properties?.thumbnail_url));
  assert(Boolean(photoSample), "Expected at least one featured pin with signed imgproxy thumbnail_url", errors);
  if (photoSample) {
    const detPhoto = await safeJsonFetch(`${baseUrl}/api/v1/pins/food/${photoSample.id}`);
    const thumbUrl = detPhoto.json?.photos?.[0]?.thumb_url;
    assert(Boolean(thumbUrl), "Expected photos[0].thumb_url on photo sample detail", errors);
    if (thumbUrl) {
      const imgRes = await fetch(thumbUrl);
      assert(imgRes.status === 200, `imgproxy returned ${imgRes.status} for ${thumbUrl}`, errors);
      assert((imgRes.headers.get("content-type") || "").startsWith("image/"), `Unexpected imgproxy content-type ${imgRes.headers.get("content-type")}`, errors);
    }
    passed.push(`Detail (OSM + Overture + signed imgproxy photo for "${detPhoto.json?.name_en || detPhoto.json?.name_bn}")`);
  }

  // 7. Error envelopes & empty result rule
  const badOverlay = await safeJsonFetch(`${baseUrl}/api/v1/pins?overlay=invalid`);
  assert(badOverlay.res.status === 400 && Boolean(badOverlay.json?.error?.code), "Expected 400 for invalid overlay", errors);

  const badDist = await safeJsonFetch(`${baseUrl}/api/v1/pins?overlay=food&district_id=BD9999`);
  assert(badDist.res.status === 400 && badDist.json?.error?.code === "INVALID_DISTRICT", "Expected 400 INVALID_DISTRICT", errors);

  const badBbox1 = await safeJsonFetch(`${baseUrl}/api/v1/pins?overlay=food&bbox=not,a,box`);
  assert(badBbox1.res.status === 400 && badBbox1.json?.error?.code === "INVALID_BBOX", "Expected 400 INVALID_BBOX (format)", errors);

  const badBbox2 = await safeJsonFetch(`${baseUrl}/api/v1/pins?overlay=food&bbox=91,24,90,23`);
  assert(badBbox2.res.status === 400 && badBbox2.json?.error?.code === "INVALID_BBOX", "Expected 400 INVALID_BBOX (min>=max)", errors);

  const badCat = await safeJsonFetch(`${baseUrl}/api/v1/pins?overlay=food&category=nonexistent_cat`);
  assert(badCat.res.status === 400 && badCat.json?.error?.code === "INVALID_CATEGORY", "Expected 400 INVALID_CATEGORY", errors);

  const badId = await safeJsonFetch(`${baseUrl}/api/v1/pins/food/not-a-uuid`);
  assert(badId.res.status === 400 && badId.json?.error?.code === "INVALID_ID", "Expected 400 INVALID_ID", errors);

  const notFound = await safeJsonFetch(`${baseUrl}/api/v1/pins/food/00000000-0000-4000-8000-000000000000`);
  assert(notFound.res.status === 404 && notFound.json?.error?.code === "FOOD_PLACE_NOT_FOUND", "Expected 404 FOOD_PLACE_NOT_FOUND", errors);

  const emptyBbox = await safeJsonFetch(`${baseUrl}/api/v1/pins?overlay=food&bbox=88.0,20.5,88.01,20.51`);
  assert(emptyBbox.res.status === 200 && Array.isArray(emptyBbox.json?.features) && emptyBbox.json.features.length === 0, "Expected 200 features: []", errors);
  passed.push("Error envelopes (400/404) & empty 200 []");

  // 8. Client module `foodService.ts` live integration
  clearFoodApiCache();
  const svcHealth = await getFoodApiHealth({ baseUrl });
  assert(svcHealth.active_places > 0, "foodService.getFoodApiHealth returned 0 active places", errors);
  const svcPins = await getFoodPins({ district_id: "BD2015", category: "restaurant" }, { baseUrl });
  assert(svcPins.features.length > 0 && svcPins.features.every((f) => f.properties.category === "restaurant"), "foodService.getFoodPins filter failed", errors);
  const svcDetail = await getFoodPinDetail(svcPins.features[0].id, { baseUrl });
  assert(svcDetail?.id === svcPins.features[0].id, "foodService.getFoodPinDetail failed", errors);
  const svcMissing = await getFoodPinDetail("00000000-0000-4000-8000-000000000000", { baseUrl });
  assert(svcMissing === null, "foodService.getFoodPinDetail should return null on 404", errors);
  let threwInvalid = false;
  try {
    await getFoodPinDetail("not-a-uuid", { baseUrl });
  } catch (err) {
    threwInvalid = err instanceof FoodApiError && err.status === 400 && err.code === "INVALID_ID";
  }
  assert(threwInvalid, "foodService.getFoodPinDetail should throw FoodApiError 400 INVALID_ID", errors);
  passed.push("foodService.ts live client (pins, detail, 404->null, 400->FoodApiError)");

  if (errors.length > 0) {
    console.error(`Live Food API validation FAILED (${errors.length} issue(s)):`);
    for (const e of errors) console.error(` - ${e}`);
    process.exit(1);
  }

  console.log(`Live Food API validation PASSED (${passed.length} test suites):`);
  for (const p of passed) console.log(` - [PASS] ${p}`);
}

main();
