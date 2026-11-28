import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, test } from "vitest";
import { FoodPinsFeatureCollectionSchema } from "../../../contract/schemas";
import { createTestApp, type TestApp } from "../support/app";
import { insertPlace } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";
import { insertDistrict, insertImportRun } from "../support/seed";

const SEED = new URL("../../../db/seeds/dev_featured.sql", import.meta.url);
const DISTRICTS = ["BD2015", "BD3026", "BD5010", "BD6091"];

let db: FileDb;
let t: TestApp;

beforeAll(async () => {
  db = await createFileDb();
  await insertDistrict(db.sql, "BD2015", "Chattogram");
  await insertDistrict(db.sql, "BD6091", "Sylhet");
  await insertImportRun(db.sql);
  for (const district_id of DISTRICTS) {
    for (let n = 0; n < 5; n++) await insertPlace(db.sql, { district_id, name_en: `Place ${n}` });
    await insertPlace(db.sql, { district_id, name_en: "Closed", is_active: false });
  }
  t = createTestApp({ databaseUrl: db.url });
});

afterAll(async () => {
  await t.close();
  await db.drop();
});

test("the dev seed features 3 visible places per demo district, however often it runs", async () => {
  await db.sql.unsafe(readFileSync(SEED, "utf8"));
  await db.sql.unsafe(readFileSync(SEED, "utf8"));

  const res = await t.app.request("/api/v1/pins?overlay=food");
  const { features } = FoodPinsFeatureCollectionSchema.parse(await res.json());

  const perDistrict = DISTRICTS.map((d) => features.filter((f) => f.properties.district_id === d).length);
  expect(perDistrict).toEqual([3, 3, 3, 3]);
});
