/// <reference types="bun" />
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createTestDb, type TestDb } from "../support/db";
import { insertPhoto, insertPlace, seedGeo } from "../support/fixtures";

setDefaultTimeout(180_000);

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
  await db.migrate();
  await seedGeo(db.sql);
});
afterAll(() => db?.drop());

test("same sha256 on two places yields two place_photos rows", async () => {
  const a = await insertPlace(db.sql);
  const b = await insertPlace(db.sql);
  const sha256 = "1".repeat(64);

  await insertPhoto(db.sql, a, { sha256 });
  await insertPhoto(db.sql, b, { sha256 });

  const counts = await db.sql`SELECT place_id, count(*)::int AS n FROM place_photos
    WHERE sha256 = ${sha256} GROUP BY place_id`;
  expect(counts.map((c) => c.n)).toEqual([1, 1]);
  await expect(insertPhoto(db.sql, a, { sha256 })).rejects.toMatchObject({
    constraint_name: "place_photos_place_sha_uq",
  });
});

test("a non-allowlisted license is rejected by the database", async () => {
  const place = await insertPlace(db.sql);

  const insert = insertPhoto(db.sql, place, { sha256: "2".repeat(64), license: "CC BY-NC 4.0" });

  await expect(insert).rejects.toMatchObject({ constraint_name: "place_photos_license_chk" });
});

test("0002 refuses to apply while a non-free photo exists", async () => {
  const legacy = await createTestDb();
  try {
    await legacy.migrate("0001");
    await seedGeo(legacy.sql);
    const place = await insertPlace(legacy.sql);
    await insertPhoto(legacy.sql, place, { license: "CC BY-ND 4.0" });

    await expect(legacy.migrate()).rejects.toThrow("run food-photo-purge-nonfree first");
  } finally {
    await legacy.drop();
  }
});

test("ugc source is rejected", async () => {
  const place = await insertPlace(db.sql);

  const insert = insertPhoto(db.sql, place, { sha256: "3".repeat(64), source: "ugc" });

  // 23514 = check_violation
  await expect(insert).rejects.toMatchObject({ code: "23514", constraint_name: "place_photos_source_chk" });
});
