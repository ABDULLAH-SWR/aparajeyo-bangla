import { afterAll, beforeAll, expect, test } from "vitest";
import { createTestApp, type TestApp } from "../support/app";
import { fixedClock } from "../support/clock";
import { insertPlace, seedGeo } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";
import { createFileValkey, type FileValkey } from "../support/valkey";

const clock = fixedClock();

let db: FileDb;
let valkey: FileValkey;
let t: TestApp;
let placeId: string;

beforeAll(async () => {
  db = await createFileDb();
  valkey = await createFileValkey(14);
  await seedGeo(db.sql);
  placeId = await insertPlace(db.sql);
  t = createTestApp({ databaseUrl: db.url, valkeyUrl: valkey.url, clock });
});

afterAll(async () => {
  await t.close();
  await valkey.drop();
  await db.drop();
});

async function getDetail() {
  const res = await t.app.request(`/api/v1/pins/food/${placeId}`);
  await res.arrayBuffer();
  return { status: res.status, xCache: res.headers.get("X-Cache"), etag: res.headers.get("ETag") };
}

test("a hidden place disappears after an epoch bump, and the 404 is not cached", async () => {
  const miss = await getDetail();
  await db.sql`UPDATE places SET is_hidden = true WHERE id = ${placeId}`;
  const hit = await getDetail();

  expect(miss).toMatchObject({ status: 200, xCache: "MISS" });
  expect(hit).toEqual({ status: 200, xCache: "HIT", etag: miss.etag });

  await t.cache.bumpEpoch("test");
  clock.advance(6_000);

  expect((await getDetail()).status).toBe(404);
  expect(await valkey.client.keys("food:v2:detail:1:*")).toEqual([]);

  // Visible again without another bump: a cached 404 would hide it.
  await db.sql`UPDATE places SET is_hidden = false WHERE id = ${placeId}`;
  expect((await getDetail()).status).toBe(200);
});
