// The z12 tile around Old Dhaka that holds both bboxes below is x=3076 (lng 90.3516 to 90.4395),
// y=1769..1770.
import { afterAll, beforeAll, expect, test } from "vitest";
import { FoodPinsFeatureCollectionSchema } from "../../../contract/schemas";
import { createTestApp, type TestApp } from "../support/app";
import { insertPlace, seedGeo } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";
import { insertImportRun } from "../support/seed";
import { createFileValkey, type FileValkey } from "../support/valkey";

const OLD_DHAKA = "90.39,23.70,90.41,23.73";
const NEARBY = "90.38,23.69,90.42,23.74"; // a different bbox over the same tiles

let db: FileDb;
let valkey: FileValkey;
let t: TestApp;
let inside: string;
let sameTile: string;

beforeAll(async () => {
  db = await createFileDb();
  valkey = await createFileValkey(13);
  await seedGeo(db.sql);
  await insertImportRun(db.sql);
  const at = (name_en: string, lng: number) =>
    insertPlace(db.sql, { name_en, geom: `SRID=4326;POINT(${lng} 23.715)` });
  inside = await at("A Inside", 90.4);
  sameTile = await at("B Same Tile", 90.36); // west of the bbox, inside the snapped envelope
  await at("C Next Tile", 90.45); // east of the snapped envelope
  t = createTestApp({ databaseUrl: db.url, valkeyUrl: valkey.url });
});

afterAll(async () => {
  await t.close();
  await valkey.drop();
  await db.drop();
});

async function getPins(bbox: string) {
  const res = await t.app.request(`/api/v1/pins?overlay=food&bbox=${bbox}`);
  expect(res.status).toBe(200);
  const collection = FoodPinsFeatureCollectionSchema.parse(await res.json());
  return {
    ids: collection.features.map((f) => f.id),
    districtId: collection.metadata.district_id,
    xCache: res.headers.get("X-Cache"),
    etag: res.headers.get("ETag"),
  };
}

test("c1 returns the places in an Old Dhaka bbox without a district", async () => {
  const pins = await getPins(OLD_DHAKA);

  expect(pins.ids).toContain(inside);
  expect(pins.districtId).toBeNull();
});

test("c2 bboxes over the same z12 tiles share one cache entry", async () => {
  const first = await getPins(OLD_DHAKA);
  const second = await getPins(NEARBY);

  expect(second.xCache).toBe("HIT");
  expect(second.etag).toBe(first.etag);
  expect(await valkey.client.keys("food:v2:pins:*")).toEqual([
    expect.stringContaining(":t:12:3076-3076:1769-1770:"),
  ]);
});

test("c3 includes a place outside the bbox but inside the snapped tiles", async () => {
  expect((await getPins(OLD_DHAKA)).ids).toEqual([inside, sameTile]);
});
