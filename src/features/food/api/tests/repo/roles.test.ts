/// <reference types="bun" />
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import postgres from "postgres";
import { createTestDb, type TestDb, USE_COMPOSE } from "../support/db";
import { insertPhoto, insertPlace, seedGeo } from "../support/fixtures";
import { runScript } from "../support/scripts";

setDefaultTimeout(180_000);
const INSUFFICIENT_PRIVILEGE = "42501";

let db: TestDb;
let placeId: string;
beforeAll(async () => {
  db = await createTestDb();
  await db.migrate();
  await seedGeo(db.sql);
  placeId = await insertPlace(db.sql);
});
afterAll(() => db?.drop());

/** Runs `work` with the privileges of `role`, in its own transaction. */
function asRole<T>(role: "food_api" | "food_worker", work: (sql: postgres.Sql) => Promise<T>) {
  return db.sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE ${role}`);
    return work(tx as unknown as postgres.Sql);
  });
}

test("food_api cannot write places", async () => {
  const update = asRole("food_api", (sql) => sql`UPDATE places SET is_hidden = true`);

  await expect(update).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
});

test("food_api can read everything the API queries, including geography maths", async () => {
  await asRole("food_api", async (sql) => {
    const places = await sql`SELECT ST_Distance(eff_geom::geography, eff_geom::geography) AS d FROM places`;
    expect(places).toHaveLength(1);
    for (const table of ["place_photos", "youtube_channels", "youtube_videos", "video_place_matches",
      "geo_districts", "geo_upazilas", "sync_runs"]) {
      await sql`SELECT 1 FROM ${sql(table)} LIMIT 1`;
    }
  });
});

test("food_worker cannot create tables in public", async () => {
  const create = asRole("food_worker", (sql) => sql`CREATE TABLE x (id int)`);

  await expect(create).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
});

test("food_worker can write data, use sequences and stage imports", async () => {
  await asRole("food_worker", async (sql) => {
    await insertPhoto(sql, placeId);
    await sql`INSERT INTO sync_runs (source, dataset_version, imported_count, status)
      VALUES ('food_poi_import', '2026-11-28', 1, 'succeeded')`;
    await sql`CREATE TABLE osm_stage.staging (id int)`;
    await sql`CREATE TEMP TABLE scratch (id int)`;
  });

  // The rebuild trigger ran on the worker's insert.
  const [row] = await db.sql`SELECT jsonb_array_length(wikimedia_s3_keys) AS n FROM places`;
  expect(row!.n).toBe(1);
});

test("food_worker cannot change administrative boundaries", async () => {
  const update = asRole("food_worker", (sql) => sql`UPDATE geo_districts SET name_en = 'x'`);

  await expect(update).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
});

// Role passwords are cluster-wide, so this never runs against a developer's compose server.
test.skipIf(USE_COMPOSE)("bootstrap script lets both roles log in", async () => {
  const passwords = { food_api: `api-${crypto.randomUUID()}`, food_worker: `w-${crypto.randomUUID()}` };

  const run = await runScript("db-bootstrap-roles.sh", {
    DATABASE_URL_OWNER: db.url,
    FOOD_API_DB_PASSWORD: passwords.food_api,
    FOOD_WORKER_DB_PASSWORD: passwords.food_worker,
  });

  expect(run.exitCode).toBe(0);
  for (const [role, password] of Object.entries(passwords)) {
    const url = new URL(db.url);
    url.username = role;
    url.password = password;
    const sql = postgres(url.toString(), { max: 1 });
    try {
      const [me] = await sql`SELECT current_user AS name`;
      expect(me!.name).toBe(role);
    } finally {
      await sql.end();
    }
  }
});
