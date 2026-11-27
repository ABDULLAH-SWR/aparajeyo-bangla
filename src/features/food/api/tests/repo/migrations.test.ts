/// <reference types="bun" />
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createTestDb, type TestDb, upSection } from "../support/db";
import { runScript } from "../support/scripts";

setDefaultTimeout(180_000);

const BASELINE_TABLES = [
  "conflation_review_queue",
  "geo_districts",
  "geo_upazilas",
  "place_photos",
  "places",
  "sync_runs",
  "video_place_matches",
  "youtube_channels",
  "youtube_videos",
];

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(() => db?.drop());

test("fresh PostGIS reaches head with all baseline tables", async () => {
  await db.migrate();

  const tables = await db.sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  expect(tables.map((t) => t.tablename)).toEqual(expect.arrayContaining(BASELINE_TABLES));
  const extensions = await db.sql`SELECT extname FROM pg_extension`;
  expect(extensions.map((e) => e.extname)).toEqual(expect.arrayContaining(["postgis", "pg_trgm"]));
});

test("adopt script records the baseline without re-running it, then reaches head", async () => {
  const existing = await createTestDb();
  try {
    // A database that predates dbmate: it has the baseline objects but no schema_migrations.
    await existing.sql.unsafe(upSection("0001_baseline.sql"));

    const run = await runScript("db-adopt-baseline.sh", { DATABASE_URL_OWNER: existing.url });

    expect(run.output).not.toContain("already exists");
    expect(run.exitCode).toBe(0);
    const applied = await existing.sql`SELECT version FROM schema_migrations ORDER BY version`;
    expect(applied[0]!.version).toBe("0001");
    // Re-running is harmless.
    const again = await runScript("db-adopt-baseline.sh", { DATABASE_URL_OWNER: existing.url });
    expect(again.exitCode).toBe(0);
  } finally {
    await existing.drop();
  }
});
