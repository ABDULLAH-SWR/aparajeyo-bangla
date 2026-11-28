import { afterAll, beforeAll, expect, test } from "vitest";
import { createTestApp, type TestApp } from "../support/app";
import { insertPlace } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";
import { insertImportRun } from "../support/seed";

const PINS = "/api/v1/pins?overlay=food&district_id=BD3026";
const ORIGIN = "https://map.example.test";

let db: FileDb;
let t: TestApp;

beforeAll(async () => {
  db = await createFileDb();
  await insertPlace(db.sql);
  await insertImportRun(db.sql);
  t = createTestApp({ databaseUrl: db.url });
});

afterAll(async () => {
  await t.close();
  await db.drop();
});

test("c1 a repeat request with If-None-Match returns an empty 304", async () => {
  const first = await t.app.request(PINS);
  const etag = first.headers.get("ETag");

  expect(first.status).toBe(200);
  expect(etag).toMatch(/^W\/".+"$/);

  const repeat = await t.app.request(PINS, { headers: { "If-None-Match": etag! } });

  expect(repeat.status).toBe(304);
  expect(await repeat.text()).toBe("");
});

test("c2 an allowed origin may read the ETag header", async () => {
  const res = await t.app.request(PINS, { headers: { Origin: ORIGIN } });

  expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  expect(res.headers.get("Access-Control-Expose-Headers")).toContain("ETag");

  const revalidated = await t.app.request(PINS, {
    headers: { Origin: ORIGIN, "If-None-Match": res.headers.get("ETag")! },
  });

  expect(revalidated.status).toBe(304);
  expect(revalidated.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
});
