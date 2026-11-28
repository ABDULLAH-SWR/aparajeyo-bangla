import { afterAll, beforeAll, expect, test } from "vitest";
import { createTestApp } from "../support/app";
import { fixedClock } from "../support/clock";
import { insertImportRun, insertPlace } from "../support/fixtures";
import { connectFileDb, type FileDb } from "../support/pg";

const PINS = "/api/v1/pins?overlay=food&district_id=BD3026";
// Already 1 December in Dhaka; the clock still says 30 November everywhere.
const FINISHED_AT = "2026-11-30T19:00:00Z";
const NOW = Date.parse("2026-11-30T12:00:00Z");

let db: FileDb;

beforeAll(async () => {
  db = connectFileDb();
  await db.sql`DELETE FROM sync_runs`; // the template carries one succeeded import; c2 needs none
  await insertPlace(db.sql);
});

afterAll(() => db.close());

async function getPins() {
  const t = createTestApp({ databaseUrl: db.url, clock: fixedClock(NOW) });
  const res = await t.app.request(PINS);
  const body = await res.json();
  await t.close();
  return { status: res.status, body, errors: t.logs.filter((l) => l.level === "error").map((l) => l.message) };
}

test("c2 without a succeeded import the request fails: the clock is not a fallback", async () => {
  await db.sql`INSERT INTO sync_runs (source, dataset_version, imported_count, status, finished_at)
    VALUES ('food_poi_import', '2026-11-30', 0, 'failed', ${FINISHED_AT})`;

  const res = await getPins();

  expect(res.status).toBe(500);
  expect(res.body).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  expect(res.errors).toEqual(["no successful food_poi_import in sync_runs"]);
});

test("c1 dataset_version is the Dhaka date of the last succeeded import", async () => {
  await insertImportRun(db.sql, FINISHED_AT);

  const res = await getPins();

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ metadata: { dataset_version: "2026-12-01" } });
});
