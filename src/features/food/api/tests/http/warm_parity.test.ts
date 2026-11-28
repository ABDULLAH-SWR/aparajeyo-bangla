// Slice 0D.8: the warmer fills the cache by calling the API, so a warmed entry must be
// indistinguishable from a computed one.
import { afterAll, beforeAll, expect, test } from "vitest";
import { createTestApp, type TestApp } from "../support/app";
import { insertImportRun, insertPlace } from "../support/fixtures";
import { connectFileDb, type FileDb } from "../support/pg";
import { createFileValkey, type FileValkey } from "../support/valkey";

let db: FileDb;
let valkey: FileValkey;
let t: TestApp;

beforeAll(async () => {
  db = connectFileDb();
  valkey = await createFileValkey(9);
  await insertPlace(db.sql);
  await insertImportRun(db.sql);
  t = createTestApp({ databaseUrl: db.url, valkeyUrl: valkey.url });
});

afterAll(async () => {
  await t.close();
  await valkey.drop();
  await db.close();
});

async function getPins() {
  const res = await t.app.request("/api/v1/pins?overlay=food&district_id=BD3026");
  await res.arrayBuffer();
  return { status: res.status, xCache: res.headers.get("X-Cache"), etag: res.headers.get("ETag") };
}

test("a cold miss, a second cold miss and a warm hit all carry the same ETag", async () => {
  const first = await getPins();
  await valkey.client.flushdb();
  const second = await getPins();
  const third = await getPins();

  expect(first.etag).toMatch(/^W\/".+"$/);
  expect([first, second, third]).toEqual([
    { status: 200, xCache: "MISS", etag: first.etag },
    { status: 200, xCache: "MISS", etag: first.etag },
    { status: 200, xCache: "HIT", etag: first.etag },
  ]);
});
