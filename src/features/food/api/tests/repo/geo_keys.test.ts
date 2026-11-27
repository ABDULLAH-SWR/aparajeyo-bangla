/// <reference types="bun" />
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createTestDb, type TestDb } from "../support/db";
import { BOGURA, BOGURA_SADAR, DHAKA, DHANMONDI, insertPlace, seedGeo } from "../support/fixtures";

setDefaultTimeout(180_000);
const FOREIGN_KEY_VIOLATION = "23503";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
  await db.migrate();
  await seedGeo(db.sql);
});
afterAll(() => db?.drop());

test("an unknown district is rejected", async () => {
  await expect(insertPlace(db.sql, { district_id: "BD9999" })).rejects.toMatchObject({
    code: FOREIGN_KEY_VIOLATION,
    constraint_name: "places_district_fk",
  });
});

test("an upazila from another district is rejected", async () => {
  const insert = insertPlace(db.sql, { district_id: DHAKA, upazila_id: BOGURA_SADAR });

  await expect(insert).rejects.toMatchObject({
    code: FOREIGN_KEY_VIOLATION,
    constraint_name: "places_upazila_in_district_fk",
  });
});

test("geo IDs come back without padding", async () => {
  const id = await insertPlace(db.sql, { district_id: DHAKA, upazila_id: DHANMONDI });

  const [row] = await db.sql`SELECT district_id, upazila_id, pg_typeof(district_id)::text AS type
    FROM places WHERE id = ${id}`;

  expect(row).toEqual({ district_id: "BD3026", upazila_id: "BD30260014", type: "text" });
});

test("0004 clears cross-district upazilas left by the old importer", async () => {
  const legacy = await createTestDb();
  try {
    await legacy.migrate("0003");
    await seedGeo(legacy.sql);
    const bad = await insertPlace(legacy.sql, { district_id: DHAKA, upazila_id: BOGURA_SADAR });
    const good = await insertPlace(legacy.sql, { district_id: BOGURA, upazila_id: BOGURA_SADAR });

    await legacy.migrate();

    const rows = await legacy.sql`SELECT id, upazila_id FROM places`;
    expect(Object.fromEntries(rows.map((r) => [r.id, r.upazila_id]))).toEqual({
      [bad]: null,
      [good]: BOGURA_SADAR,
    });
  } finally {
    await legacy.drop();
  }
});
