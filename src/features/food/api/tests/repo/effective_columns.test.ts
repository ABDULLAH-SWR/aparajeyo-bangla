/// <reference types="bun" />
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createTestDb, type TestDb } from "../support/db";
import { insertPlace, seedGeo } from "../support/fixtures";

setDefaultTimeout(180_000);

const BASE = "SRID=4326;POINT(90.4 23.8)";
const MOVED = "SRID=4326;POINT(90.4 23.827)"; // 3 km north

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
  await db.migrate();
  await seedGeo(db.sql);
});
afterAll(() => db?.drop());

async function effective(id: string) {
  const [row] = await db.sql`SELECT ST_AsEWKT(eff_geom) AS geom, eff_name_en, eff_name_bn
    FROM places WHERE id = ${id}`;
  return row!;
}

test("a geometry override wins", async () => {
  const id = await insertPlace(db.sql, { geom: BASE, geom_override: MOVED });

  expect((await effective(id)).geom).toBe(MOVED);
});

test("clearing the geometry override restores the imported point", async () => {
  const id = await insertPlace(db.sql, { geom: BASE, geom_override: MOVED });

  await db.sql`UPDATE places SET geom_override = NULL WHERE id = ${id}`;

  expect((await effective(id)).geom).toBe(BASE);
});

test("name overrides win, otherwise the imported name is used", async () => {
  const id = await insertPlace(db.sql, { name_en: "Imported", name_bn_override: "সম্পাদিত" });

  expect(await effective(id)).toMatchObject({ eff_name_en: "Imported", eff_name_bn: "সম্পাদিত" });
});
