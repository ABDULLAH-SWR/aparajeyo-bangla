// Slice 2.14: Directus caches in the same Valkey as the API, and must not reach Food keys.
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { adminClient, type DirectusClient } from "../support/directus-api";

let admin: DirectusClient;
let food: Redis;

beforeAll(async () => {
  admin = await adminClient();
  food = new Redis(inject("directus").VALKEY_URL); // DB 0, the Food database
});

afterAll(() => food?.quit());

describe("the Directus cache", () => {
  test("clearing it leaves the Food keys in place", async () => {
    await food.set("food:epoch", "7", "KEEPTTL");
    await food.set("food:v2:detail:isolation-probe", "{}", "EX", 600);

    const cleared = await admin.post("/utils/cache/clear");

    expect(cleared.status).toBe(200);
    expect(await food.exists("food:epoch", "food:v2:detail:isolation-probe")).toBe(2);
  });

  test("lives in its own database, under its own namespace", async () => {
    await admin.get("/items/places?limit=1"); // fills the cache

    expect((await food.keys("*")).filter((key) => !key.startsWith("food:"))).toEqual([]);
    const url = new URL(inject("directus").VALKEY_URL);
    url.pathname = "/1";
    const directus = new Redis(url.toString());
    const keys = await directus.keys("*");
    await directus.quit();
    expect(keys.some((key) => key.includes("directus"))).toBe(true);
  });
});
