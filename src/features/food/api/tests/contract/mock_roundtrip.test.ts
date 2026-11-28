// Seeding the database from the contract mocks reproduces them through the API (Guide §7.3 Slice 1.8).
// Only two things are normalized: (a) the signature and host of signed image URLs, and
// (b) metadata.dataset_version.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createImgproxySigner } from "../../imgproxy";
import { createTestApp, type TestApp } from "../support/app";
import { connectFileDb, type FileDb } from "../support/pg";

const SEED = new URL("../../../db/seeds/from_mocks.sql", import.meta.url);
const mock = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../testdata/contract_mocks/${name}`, import.meta.url), "utf8"));

/** The real signer, so only the signature and host of a URL can differ from the mocks. */
const signer = createImgproxySigner({
  baseUrl: "https://img.example.test",
  keyHex: "01".repeat(32),
  saltHex: "02".repeat(32),
  bucket: "food-media",
});

const SIGNED_PREFIX = /^https:\/\/[^/]+\/[^/]+(?=\/rs:fit:)/;
const unsigned = (value: unknown) =>
  JSON.parse(JSON.stringify(value), (_key, v) => (typeof v === "string" ? v.replace(SIGNED_PREFIX, "signed:") : v));

let db: FileDb;
let t: TestApp;

beforeAll(async () => {
  db = connectFileDb();
  await db.sql.unsafe(readFileSync(SEED, "utf8"));
  t = createTestApp({ databaseUrl: db.url, signer });
});

afterAll(async () => {
  await t?.close();
  await db?.close();
});

async function get(path: string) {
  const res = await t.app.request(path);
  expect(res.status).toBe(200);
  return res.json();
}

test("food_pins.geojson.json comes back from the pins route", async () => {
  const expected = mock("food_pins.geojson.json");
  const comparable = (collection: typeof expected) =>
    unsigned({ ...collection, metadata: { ...collection.metadata, dataset_version: "normalized" } });

  // The mock's district_id is null: the national featured set, in the featured order of Guide A.12.
  const actual = await get("/api/v1/pins?overlay=food");

  expect(comparable(actual)).toEqual(comparable(expected));
});

test.each(["food_pin_detail_minimal.json", "food_pin_detail.json"])("%s comes back from the detail route", async (name) => {
  const expected = mock(name);

  expect(unsigned(await get(`/api/v1/pins/food/${expected.id}`))).toEqual(unsigned(expected));
});
