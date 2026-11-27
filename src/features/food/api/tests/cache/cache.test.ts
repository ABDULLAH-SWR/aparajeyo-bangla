// The tests run in order and share one place whose name changes behind the cache's back.
import { afterAll, beforeAll, expect, test } from "vitest";
import { FoodPinsFeatureCollectionSchema } from "../../../contract/schemas";
import { createTestApp, type TestApp } from "../support/app";
import { fixedClock } from "../support/clock";
import { insertPlace, seedGeo } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";
import { insertImportRun } from "../support/seed";
import { createFileValkey, type FileValkey } from "../support/valkey";

const PINS = "/api/v1/pins?overlay=food&district_id=BD3026";
const clock = fixedClock();

let db: FileDb;
let valkey: FileValkey;
let t: TestApp;
let placeId: string;

beforeAll(async () => {
  db = await createFileDb();
  valkey = await createFileValkey(15);
  await seedGeo(db.sql);
  placeId = await insertPlace(db.sql, { name_en: "Old Name" });
  await insertImportRun(db.sql);
  t = createTestApp({ databaseUrl: db.url, valkeyUrl: valkey.url, clock });
});

afterAll(async () => {
  await t.close();
  await valkey.drop();
  await db.drop();
});

async function getPins(app: TestApp = t) {
  const res = await app.app.request(PINS);
  expect(res.status).toBe(200);
  const { features } = FoodPinsFeatureCollectionSchema.parse(await res.json());
  return {
    xCache: res.headers.get("X-Cache"),
    etag: res.headers.get("ETag"),
    name: features[0]!.properties.name_en,
  };
}

test("c1 a repeat request is served from the cache", async () => {
  const first = await getPins();
  await db.sql`UPDATE places SET name_en = 'New Name' WHERE id = ${placeId}`;
  const second = await getPins();

  expect(first).toMatchObject({ xCache: "MISS", name: "Old Name" });
  expect(second).toMatchObject({ xCache: "HIT", name: "Old Name" });
  expect(second.etag).toBe(first.etag);
});

test("c2 an epoch bump invalidates once the 5 s epoch memo expires", async () => {
  await t.cache.bumpEpoch("test");

  clock.advance(4_000);
  expect(await getPins()).toMatchObject({ xCache: "HIT", name: "Old Name" });

  clock.advance(2_000);
  expect(await getPins()).toMatchObject({ xCache: "MISS", name: "New Name" });
});

test("c3 a corrupt entry is a miss and is overwritten", async () => {
  const [key] = await valkey.client.keys("food:v2:pins:*:1:*"); // the current epoch is 1
  await valkey.client.set(key!, "{not json");

  expect(await getPins()).toMatchObject({ xCache: "MISS", name: "New Name" });
  expect(JSON.parse((await valkey.client.get(key!))!)).toMatchObject({ type: "FeatureCollection" });
  expect(t.metrics.read("food_api_valkey_errors_total", { op: "parse" })).toBe(1);
});

test("c4 with Valkey down, the database serves and every error is logged and counted", async () => {
  const down = createTestApp({ databaseUrl: db.url });

  const pins = await getPins(down);
  await down.close();

  expect(pins).toMatchObject({ xCache: "MISS", name: "New Name" });
  const count = (op: string) => down.metrics.read("food_api_valkey_errors_total", { op });
  expect(count("get")).toBeGreaterThanOrEqual(1);
  const warnings = down.logs.filter((entry) => entry.level === "warn");
  expect(warnings).toHaveLength(count("connect") + count("get") + count("set"));
});
