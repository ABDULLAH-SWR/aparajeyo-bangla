import { afterAll, beforeAll, expect, test } from "vitest";
import { CLOSED_DATABASE_URL, createTestApp, type TestAppOptions } from "../support/app";
import { connectFileDb, type FileDb } from "../support/pg";
import { insertImportRun } from "../support/fixtures";
import { createFileValkey, type FileValkey } from "../support/valkey";

let db: FileDb;
let valkey: FileValkey;

beforeAll(async () => {
  db = connectFileDb();
  valkey = await createFileValkey(11);
  await insertImportRun(db.sql, "2026-11-30T19:00:00Z");
  await valkey.client.set("food:epoch", "7");
});

afterAll(async () => {
  await valkey.drop();
  await db.close();
});

async function getHealth(options: TestAppOptions) {
  const t = createTestApp(options);
  const res = await t.app.request("/api/v1/food/health");
  const text = await res.text();
  await t.close();
  return { status: res.status, cacheControl: res.headers.get("Cache-Control"), text, body: JSON.parse(text) };
}

test("c1 reports every dependency when all are up", async () => {
  const res = await getHealth({ databaseUrl: db.url, valkeyUrl: valkey.url });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok", db: "ok", cache: "ok", dataset_version: "2026-12-01", epoch: 7 });
  expect(res.cacheControl).toBe("no-store");
});

test("c2 stays up, degraded, without Valkey", async () => {
  const res = await getHealth({ databaseUrl: db.url });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok", db: "ok", cache: "degraded", dataset_version: "2026-12-01", epoch: null });
});

test("c3 is down without the database, and says no more than that", async () => {
  const res = await getHealth({ databaseUrl: CLOSED_DATABASE_URL, valkeyUrl: valkey.url });

  expect(res.status).toBe(503);
  expect(res.body).toEqual({ status: "down", db: "down", cache: "ok", dataset_version: null, epoch: 7 });
  expect(res.text).not.toMatch(/ECONNREFUSED|sync_runs/);
});
