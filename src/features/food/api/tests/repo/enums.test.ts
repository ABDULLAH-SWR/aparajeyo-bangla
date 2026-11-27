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

test("an unknown food category is rejected", async () => {
  await expect(insertPlace(db.sql, { category: "pizza" })).rejects.toMatchObject({
    code: CHECK_VIOLATION,
    constraint_name: "places_food_category_chk",
  });
});

test("an unknown cuisine is rejected", async () => {
  await expect(insertPlace(db.sql, { cuisines: ["sushi"] })).rejects.toMatchObject({
    code: CHECK_VIOLATION,
    constraint_name: "places_food_cuisines_chk",
  });
});

test("a food place without a cuisine is rejected", async () => {
  await expect(insertPlace(db.sql, { cuisines: [] })).rejects.toMatchObject({
    code: CHECK_VIOLATION,
    constraint_name: "places_food_cuisines_chk",
  });
});

test("travel places are not bound by the food enums", async () => {
  await insertPlace(db.sql, { overlay_type: "travel", category: "museum", cuisines: [] });
});

test("0005 backfills empty cuisine lists with 'other'", async () => {
  const legacy = await createTestDb();
  try {
    await legacy.migrate("0004");
    await seedGeo(legacy.sql);
    const id = await insertPlace(legacy.sql, { cuisines: [] });

    await legacy.migrate();

    const [row] = await legacy.sql`SELECT cuisines FROM places WHERE id = ${id}`;
    expect(row!.cuisines).toEqual(["other"]);
  } finally {
    await legacy.drop();
  }
});
