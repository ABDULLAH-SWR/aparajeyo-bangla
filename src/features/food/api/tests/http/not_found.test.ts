import { afterAll, beforeAll, expect, test } from "vitest";
import { CLOSED_DATABASE_URL, createTestApp, type TestApp } from "../support/app";

let t: TestApp;
beforeAll(() => {
  t = createTestApp({ databaseUrl: CLOSED_DATABASE_URL });
});
afterAll(() => t.close());

test("an unknown route returns NOT_FOUND", async () => {
  const res = await t.app.request("/api/v1/nope");

  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Route not found." } });
});
