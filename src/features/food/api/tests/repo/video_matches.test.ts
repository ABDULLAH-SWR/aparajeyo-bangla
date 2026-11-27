/// <reference types="bun" />
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createTestDb, type TestDb } from "../support/db";
import { insertMatch, insertPlace, insertVideo, seedGeo } from "../support/fixtures";

setDefaultTimeout(180_000);
const CHECK_VIOLATION = "23514";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
  await db.migrate();
  await seedGeo(db.sql);
});
afterAll(() => db?.drop());

test("an auto-approved match cannot claim to be reviewed", async () => {
  const place = await insertPlace(db.sql);
  await insertVideo(db.sql, "vid-auto");

  const insert = insertMatch(db.sql, "vid-auto", place, {
    status: "auto_approved",
    reviewed_at: new Date(),
  });

  await expect(insert).rejects.toMatchObject({
    code: CHECK_VIOLATION,
    constraint_name: "vpm_unreviewed_machine_rows_chk",
  });
});

test("0007 clears review stamps from machine rows and keeps editors' stamps", async () => {
  const legacy = await createTestDb();
  try {
    await legacy.migrate("0006");
    await seedGeo(legacy.sql);
    const place = await insertPlace(legacy.sql);
    for (const status of ["auto_approved", "pending", "approved"]) {
      await insertVideo(legacy.sql, status);
      await insertMatch(legacy.sql, status, place, {
        status,
        reviewed_at: new Date(),
        reviewed_by: "someone",
      });
    }

    await legacy.migrate();

    const rows = await legacy.sql`SELECT status, reviewed_by, reviewed_at IS NOT NULL AS stamped
      FROM video_place_matches ORDER BY status`;
    expect([...rows]).toEqual([
      { status: "approved", reviewed_by: "someone", stamped: true },
      { status: "auto_approved", reviewed_by: null, stamped: false },
      { status: "pending", reviewed_by: null, stamped: false },
    ]);
  } finally {
    await legacy.drop();
  }
});
