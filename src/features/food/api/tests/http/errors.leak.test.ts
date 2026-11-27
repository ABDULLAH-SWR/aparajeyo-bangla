import { expect, test } from "vitest";
import { CLOSED_DATABASE_URL, createTestApp } from "../support/app";

test("DB failure returns generic INTERNAL_ERROR", async () => {
  const t = createTestApp({ databaseUrl: CLOSED_DATABASE_URL });

  const res = await t.app.request("/api/v1/pins/food/11111111-1111-4111-8111-111111111111");
  const text = await res.text();
  await t.close();

  expect(res.status).toBe(500);
  expect(JSON.parse(text)).toEqual({
    error: { code: "INTERNAL_ERROR", message: "Internal server error." },
  });
  expect(text).not.toMatch(/ECONNREFUSED|SELECT|FROM places/i);
  expect(t.logs.filter((entry) => entry.level === "error")).toHaveLength(1);
});
