// Checks the vendored contract mocks against README §5 (Guide §7.3 Slice 1.5).
// Run: bun run contract:check (from api/). Exits 1 and lists every violation.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { FOOD_CATEGORIES, PLACE_SOURCES } from "../contract/enums";
import { FoodPinDetailSchema, FoodPinsFeatureCollectionSchema } from "../contract/schemas";

export interface MockViolation {
  rule: string;
  file: string;
  message: string;
}

/** A value of unknown shape: a broken mock must still reach every rule. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

/** The place records of a pins collection (one per feature) or of a detail (itself). */
function placesOf(mock: Loose): { place: Loose; coordinates: Loose; featureId?: Loose }[] {
  if (!Array.isArray(mock?.features)) return [{ place: mock ?? {}, coordinates: mock?.coordinates }];
  return mock.features.map((feature: Loose) => ({
    place: feature?.properties ?? {},
    coordinates: feature?.geometry?.coordinates,
    featureId: feature?.id ?? null,
  }));
}

const GeoCodesSchema = z.object({
  districts: z.array(z.object({ id: z.string() })).min(1),
  upazilas: z.array(z.object({ id: z.string(), district_id: z.string() })).min(1),
});

const GEO_CODES = fileURLToPath(new URL("../data/geo_codes.v03.json", import.meta.url));

export function validateMocks(mocksDir: string, geoCodesFile = GEO_CODES): MockViolation[] {
  const geo = GeoCodesSchema.parse(JSON.parse(readFileSync(geoCodesFile, "utf8")));
  const districts = new Set(geo.districts.map((d) => d.id));
  const parentOf = new Map(geo.upazilas.map((u) => [u.id, u.district_id]));
  const violations: MockViolation[] = [];
  const files = readdirSync(mocksDir).filter((file) => file.endsWith(".json"));
  if (files.length === 0) violations.push({ rule: "c1", file: mocksDir, message: "no mocks found" });

  for (const file of files) {
    const report = (rule: string, message: string) => void violations.push({ rule, file, message });
    let mock: unknown;
    try {
      mock = JSON.parse(readFileSync(join(mocksDir, file), "utf8"));
    } catch (error) {
      report("c1", `invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const isPins = file.endsWith(".geojson.json");
    const schema = isPins ? FoodPinsFeatureCollectionSchema : FoodPinDetailSchema;
    for (const issue of schema.safeParse(mock).error?.issues ?? []) {
      report("c1", `${issue.path.join(".")}: ${issue.message}`);
    }

    const metadataDistrict = (mock as Loose)?.metadata?.district_id ?? null;
    if (metadataDistrict !== null && !districts.has(metadataDistrict)) {
      report("c4", `unknown metadata.district_id ${metadataDistrict}`);
    }
    for (const { place, coordinates, featureId } of placesOf(mock)) {
      if (featureId !== undefined && featureId !== place.id) {
        report("c2", `feature.id ${featureId} differs from properties.id ${place.id}`);
      }
      const [lng, lat] = coordinates ?? [];
      if (!(lng >= 88 && lng <= 93 && lat >= 20.5 && lat <= 26.8)) {
        report("c3", `coordinates [${lng}, ${lat}] are outside lng 88-93, lat 20.5-26.8`);
      }
      if (!districts.has(place.district_id)) report("c4", `unknown district_id ${place.district_id}`);
      const parent = parentOf.get(place.upazila_id);
      if (place.upazila_id !== null && parent === undefined) {
        report("c5", `unknown upazila_id ${place.upazila_id}`);
      } else if (place.upazila_id !== null && parent !== place.district_id) {
        report("c5", `upazila_id ${place.upazila_id} belongs to ${parent}, not ${place.district_id}`);
      }
      if (place.pin_type !== "food_poi") report("c6", `pin_type is ${place.pin_type}, not food_poi`);
      const photos: Loose[] = Array.isArray(place.photos) ? place.photos : [];
      for (const url of [place.thumbnail_url, ...photos.flatMap((p) => [p?.url, p?.thumb_url])]) {
        if (URL.parse(url ?? "")?.hostname === "upload.wikimedia.org") report("c8", `hotlinked photo ${url}`);
      }
    }
    if (isPins) {
      const places = placesOf(mock).map((p) => p.place);
      for (const [key, members] of [["category", FOOD_CATEGORIES], ["source", PLACE_SOURCES]] as const) {
        const seen = new Set(places.map((p) => p[key]));
        for (const member of members.filter((m) => !seen.has(m))) report("c7", `no pin has ${key} ${member}`);
      }
    }
  }
  return violations;
}

if (import.meta.main) {
  const violations = validateMocks(fileURLToPath(new URL("../testdata/contract_mocks", import.meta.url)));
  for (const v of violations) console.error(`${v.rule} ${v.file}: ${v.message}`);
  if (violations.length === 0) console.log("contract mocks: ok");
  process.exit(violations.length > 0 ? 1 : 0);
}
