import { afterAll, beforeAll, expect, test } from "vitest";
import { FoodPinsFeatureCollectionSchema } from "../../../contract/schemas";
import { createTestApp, type TestApp } from "../support/app";
import { insertMatch, insertPlace, seedGeo } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";
import { insertContractVideo, insertImportRun } from "../support/seed";

let db: FileDb;
let t: TestApp;
let featured: string;
let filmed: string;

beforeAll(async () => {
  db = await createFileDb();
  await seedGeo(db.sql);
  await insertImportRun(db.sql);
  // Names put the filmed place first alphabetically, so only the featured flag can order it second.
  filmed = await insertPlace(db.sql, { name_en: "A Filmed Cafe" });
  featured = await insertPlace(db.sql, { name_en: "Z Featured Hotel", is_featured: true });
  await insertPlace(db.sql, { name_en: "Plain Stall" });
  await insertContractVideo(db.sql, "aaaaaaaaaaa");
  await insertMatch(db.sql, "aaaaaaaaaaa", filmed);
  t = createTestApp({ databaseUrl: db.url });
});

afterAll(async () => {
  await t.close();
  await db.drop();
});

async function getNational() {
  const res = await t.app.request("/api/v1/pins?overlay=food");
  expect(res.status).toBe(200);
  return FoodPinsFeatureCollectionSchema.parse(await res.json());
}

test("c1 returns the featured and filmed places only, featured first", async () => {
  const collection = await getNational();

  expect(collection.features.map((f) => f.id)).toEqual([featured, filmed]);
  expect(collection.metadata.district_id).toBeNull();
});

test("c2 is empty when nothing is featured or filmed", async () => {
  await db.sql`DELETE FROM video_place_matches`;
  await db.sql`UPDATE places SET is_featured = false`;

  const collection = await getNational();

  expect(collection.features).toEqual([]);
  expect(collection.metadata.total_count).toBe(0);
});

test("c3 caps the set at 2,000 and says so", async () => {
  await db.sql`
    INSERT INTO places (overlay_type, source, source_id, district_id, geom, name_en, name_norm, category,
                        cuisines, source_license, is_featured)
    SELECT 'food', 'osm', 'node/cap-' || n, 'BD3026', ST_SetSRID(ST_MakePoint(90.4, 23.8), 4326),
           'Featured ' || n, 'featured ' || n, 'restaurant', '{bangladeshi}', 'ODbL-1.0', true
    FROM generate_series(1, 2001) AS n`;

  const collection = await getNational();

  expect(collection.features).toHaveLength(2000);
  expect(collection.metadata.truncated).toBe(true);
});
