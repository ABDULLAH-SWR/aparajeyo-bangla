import { afterAll, beforeAll, expect, test } from "vitest";
import { CLOSED_DATABASE_URL, createTestApp, type TestApp } from "../support/app";

const ALLOWED = "https://map.example.test"; // the test app's only listed origin
const PINS = "/api/v1/pins?overlay=food";

let t: TestApp;
beforeAll(() => {
  t = createTestApp({ databaseUrl: CLOSED_DATABASE_URL });
});
afterAll(() => t.close());

const preflight = (origin: string) =>
  t.app.request(PINS, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "if-none-match",
    },
  });

test("c1 a preflight from a listed origin allows GET with If-None-Match", async () => {
  const res = await preflight(ALLOWED);

  expect(res.status).toBe(204);
  expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED);
  expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET,OPTIONS");
  expect(res.headers.get("Access-Control-Allow-Headers")).toBe("If-None-Match");
  expect(res.headers.get("Access-Control-Max-Age")).toBe("600");
});

test("c2 an unlisted origin is granted nothing", async () => {
  const res = await preflight("https://evil.example.test");

  expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
});

test("c3 other methods are not routes", async () => {
  const res = await t.app.request(PINS, { method: "POST" });

  expect(res.status).toBe(404);
  expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
});
