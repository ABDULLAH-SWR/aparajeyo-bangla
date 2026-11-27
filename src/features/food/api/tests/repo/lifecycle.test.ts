/// <reference types="bun" />
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createTestDb, type TestDb } from "../support/db";
import { insertPlace, seedGeo } from "../support/fixtures";

setDefaultTimeout(180_000);
const CHECK_VIOLATION = "23514";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
  await db.migrate();
  await seedGeo(db.sql);
});
afterAll(() => db?.drop());

test("a merged place cannot be active", async () => {
  const survivor = await insertPlace(db.sql);
  const loser = await insertPlace(db.sql, { source: "overture" });

  const merge = db.sql`UPDATE places SET merged_into = ${survivor}, is_active = true WHERE id = ${loser}`;

  await expect(merge.execute()).rejects.toMatchObject({
    code: CHECK_VIOLATION,
    constraint_name: "places_merged_inactive_chk",
  });
});

test("an import reject is recorded with a known reason only", async () => {
  const reject = (reason: string) => db.sql`INSERT INTO food_import_rejects (run_id, source, source_id, reason)
    VALUES (1, 'osm', 'node/1', ${reason})`;

  await reject("outside_admin_polygons");

  await expect(reject("bad_vibes").execute()).rejects.toMatchObject({ code: CHECK_VIOLATION });
});
