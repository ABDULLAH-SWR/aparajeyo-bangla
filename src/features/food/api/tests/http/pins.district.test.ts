import { afterAll, beforeAll, expect, test } from "vitest";
import { FoodPinsFeatureCollectionSchema } from "../../../contract/schemas";
import { createTestApp, type TestApp } from "../support/app";
import { DHAKA, insertDistrict, insertImportRun, insertPlace } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";

const CHATTOGRAM = "BD2015";

let db: FileDb;
let t: TestApp;
let expectedIds: string[];

beforeAll(async () => {
  db = await createFileDb();
  await insertDistrict(db.sql, CHATTOGRAM, "Chattogram");
  const zinda = await insertPlace(db.sql, { district_id: DHAKA, name_en: "Zinda Kebab" });
  const anna = await insertPlace(db.sql, { district_id: DHAKA, name_en: "Anna Sweets" });
  await insertPlace(db.sql, { district_id: CHATTOGRAM, name_en: "Port Cafe" });
  await insertPlace(db.sql, { district_id: DHAKA, name_en: "Hidden Hotel", is_hidden: true });
  await insertImportRun(db.sql);
  expectedIds = [anna, zinda];
  t = createTestApp({ databaseUrl: db.url });
});

afterAll(async () => {
  await t.close();
  await db.drop();
});

test("returns a contract-valid FeatureCollection for BD3026", async () => {
  const res = await t.app.request("/api/v1/pins?overlay=food&district_id=BD3026");
  const body = await res.json();

  expect(res.status).toBe(200);
  const collection = FoodPinsFeatureCollectionSchema.parse(body);
  expect(collection.features.map((f) => f.id)).toEqual(expectedIds);
  expect(collection.metadata.district_id).toBe("BD3026");
  expect(collection.metadata.total_count).toBe(2);
  expect(collection.metadata.truncated).toBe(false);
});
