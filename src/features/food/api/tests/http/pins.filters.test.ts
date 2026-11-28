// The tests run in order: c3 relies on the entry c1 cached.
import { afterAll, beforeAll, expect, test } from "vitest";
import { FoodPinsFeatureCollectionSchema } from "../../../contract/schemas";
import { createTestApp, type TestApp } from "../support/app";
import { insertMatch, insertPlace } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";
import { insertContractVideo, insertImportRun } from "../support/seed";
import { createFileValkey, type FileValkey } from "../support/valkey";

const DISTRICT = "overlay=food&district_id=BD3026";

let db: FileDb;
let valkey: FileValkey;
let t: TestApp;
let cafe: string;
let teaStall: string;

beforeAll(async () => {
  db = await createFileDb();
  valkey = await createFileValkey(12);
  await insertImportRun(db.sql);
  cafe = await insertPlace(db.sql, { name_en: "A Cafe", category: "cafe" });
  teaStall = await insertPlace(db.sql, { name_en: "B Tea", category: "tea_stall" });
  await insertPlace(db.sql, { name_en: "C Restaurant" });
  await insertContractVideo(db.sql, "aaaaaaaaaaa");
  await insertMatch(db.sql, "aaaaaaaaaaa", teaStall);
  t = createTestApp({ databaseUrl: db.url, valkeyUrl: valkey.url });
});

afterAll(async () => {
  await t.close();
  await valkey.drop();
  await db.drop();
});

async function getPins(query: string) {
  const res = await t.app.request(`/api/v1/pins?${query}`);
  expect(res.status).toBe(200);
  const { features } = FoodPinsFeatureCollectionSchema.parse(await res.json());
  return { features, xCache: res.headers.get("X-Cache"), etag: res.headers.get("ETag") };
}

test("c1 returns only the requested categories", async () => {
  const pins = await getPins(`${DISTRICT}&category=tea_stall,cafe`);

  expect(pins.features.map((f) => f.id)).toEqual([cafe, teaStall]);
});

test("c3 category order and repeats do not change the cache entry", async () => {
  expect((await getPins(`${DISTRICT}&category=cafe,tea_stall`)).xCache).toBe("HIT");
  expect((await getPins(`${DISTRICT}&category=cafe,tea_stall,cafe`)).xCache).toBe("HIT");
});

test("c2 has_video=true returns only places with a video", async () => {
  const pins = await getPins(`${DISTRICT}&has_video=true`);

  expect(pins.features.map((f) => f.id)).toEqual([teaStall]);
  expect(pins.features.every((f) => f.properties.has_video)).toBe(true);
});

test("c4 unknown parameters are accepted and ignored", async () => {
  const plain = await getPins(DISTRICT);
  const extra = await getPins(`${DISTRICT}&date=2026-11-27&mode=live`);

  expect(extra.etag).toBe(plain.etag);
  expect(extra.xCache).toBe("HIT");
});
