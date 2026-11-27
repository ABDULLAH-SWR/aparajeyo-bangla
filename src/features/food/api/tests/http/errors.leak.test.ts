/// <reference types="bun" />
import { expect, test } from "bun:test";

test("DB failure returns generic INTERNAL_ERROR", async () => {
  // Port 1 is closed, so the first query fails. Must be set before the app is imported.
  process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/nowhere";
  const { default: app } = await import("../../app");

  const res = await app.request("/api/v1/pins/food/11111111-1111-4111-8111-111111111111");
  const text = await res.text();

  expect(res.status).toBe(500);
  expect(JSON.parse(text)).toEqual({
    error: { code: "INTERNAL_ERROR", message: "Internal server error." },
  });
  expect(text).not.toMatch(/ECONNREFUSED|SELECT|FROM places/i);
});
