// Behaviour that predates the rebuild and must survive it. Slices 0C.10-0C.12 and 0C.15 replace these.
import { afterAll, beforeAll, expect, test } from "vitest";
import { FoodPinsFeatureCollectionSchema } from "../../../contract/schemas";
import { createTestApp, type TestApp } from "../support/app";
import { BOGURA, insertMatch, insertPlace, seedGeo } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";
import { insertContractVideo, insertImportRun } from "../support/seed";

let db: FileDb;
let t: TestApp;
let filmedCafe: string;
let dhakaRestaurant: string;
let boguraStall: string;

beforeAll(async () => {
  db = await createFileDb();
  await seedGeo(db.sql);
  dhakaRestaurant = await insertPlace(db.sql);
  filmedCafe = await insertPlace(db.sql, { category: "cafe", geom: "SRID=4326;POINT(90.45 23.85)" });
  boguraStall = await insertPlace(db.sql, {
    category: "tea_stall",
    district_id: BOGURA,
    geom: "SRID=4326;POINT(89.37 24.85)",
  });
  await insertContractVideo(db.sql, "aaaaaaaaaaa");
  await insertMatch(db.sql, "aaaaaaaaaaa", filmedCafe);
  await insertImportRun(db.sql, "2026-11-20T20:00:00Z");
  t = createTestApp({ databaseUrl: db.url });
});

afterAll(async () => {
  await t.close();
  await db.drop();
});

async function getPins(query: string) {
  const res = await t.app.request(`/api/v1/pins?overlay=food${query}`);
  expect(res.status).toBe(200);
  const collection = FoodPinsFeatureCollectionSchema.parse(await res.json());
  return { ...collection, ids: collection.features.map((f) => f.id) };
}

test("the national view returns every visible place, filmed places first", async () => {
  const pins = await getPins("");

  expect(pins.ids[0]).toBe(filmedCafe);
  expect(pins.ids.toSorted()).toEqual([filmedCafe, dhakaRestaurant, boguraStall].toSorted());
  expect(pins.metadata.district_id).toBeNull();
  expect(pins.metadata.dataset_version).toBe("2026-11-21");
});

test("a bbox returns only the places inside it", async () => {
  const pins = await getPins("&bbox=89.3,24.8,89.5,24.9");

  expect(pins.ids).toEqual([boguraStall]);
  expect(pins.metadata.district_id).toBeNull();
});

test("category narrows the result", async () => {
  const pins = await getPins("&category=tea_stall,cafe");

  expect(pins.ids.toSorted()).toEqual([filmedCafe, boguraStall].toSorted());
});

test("has_video=true keeps only filmed places", async () => {
  const pins = await getPins("&district_id=BD3026&has_video=true");

  expect(pins.ids).toEqual([filmedCafe]);
});

test("health reports totals", async () => {
  const res = await t.app.request("/api/v1/food/health");

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    status: "ok",
    service: "aparajeyo-food-api",
    total_places: 3,
    active_places: 3,
    districts_covered: 2,
    total_photos: 0,
    total_videos: 1,
    imgproxy_enabled: true,
  });
});
