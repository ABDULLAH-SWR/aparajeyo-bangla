import { afterAll, beforeAll, expect, test } from "vitest";
import { FoodPinDetailSchema } from "../../../contract/schemas";
import { createTestApp, type TestApp } from "../support/app";
import { DHAKA, DHANMONDI, insertMatch, insertPhoto, insertPlace, insertVideo } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";

let db: FileDb;
let t: TestApp;
let placeId: string;

beforeAll(async () => {
  db = await createFileDb();
  placeId = await insertPlace(db.sql, {
    district_id: DHAKA,
    upazila_id: DHANMONDI,
    cuisines: ["biryani_kacchi", "mishti"],
  });
  await insertPhoto(db.sql, placeId, { sha256: "a".repeat(64), sort_order: 1 });
  await insertPhoto(db.sql, placeId, { sha256: "b".repeat(64), sort_order: 0 });
  for (const id of ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"]) await insertVideo(db.sql, id);
  await insertMatch(db.sql, "aaaaaaaaaaa", placeId, { confidence: 0.85 });
  await insertMatch(db.sql, "bbbbbbbbbbb", placeId, { confidence: 0.95, start_seconds: 754 });
  await insertMatch(db.sql, "ccccccccccc", placeId, { confidence: 0.99, status: "pending" });
  // Last: the media triggers above set updated_at to now().
  await db.sql`UPDATE places SET updated_at = '2026-11-20T20:15:30Z' WHERE id = ${placeId}`;
  t = createTestApp({ databaseUrl: db.url });
});

afterAll(async () => {
  await t.close();
  await db.drop();
});

const getDetail = (id: string) => t.app.request(`/api/v1/pins/food/${id}`);

test("c1 returns a hydrated, contract-valid detail", async () => {
  const res = await getDetail(placeId);

  expect(res.status).toBe(200);
  const detail = FoodPinDetailSchema.parse(await res.json());
  expect(detail.photos.map((p) => p.thumb_url)).toEqual([
    `https://img.example.test/320/photos/food/${placeId}/${"b".repeat(64)}.jpg`,
    `https://img.example.test/320/photos/food/${placeId}/${"a".repeat(64)}.jpg`,
  ]);
  expect(detail.youtube_video_ids).toEqual(["bbbbbbbbbbb", "aaaaaaaaaaa"]);
  expect(detail.videos.map((v) => v.video_id)).toEqual(["bbbbbbbbbbb", "aaaaaaaaaaa"]);
  expect(detail.videos.map((v) => v.start_seconds)).toEqual([754, null]);
  expect(detail.videos[0]!.published_at).toBe("2026-10-06T02:30:00+06:00");
  expect(detail.updated_at).toBe("2026-11-21T02:15:30+06:00");
  expect(detail.district_name_en).toBe("Dhaka");
  expect(detail.upazila_name_en).toBe("Dhanmondi");
  expect(detail.rating).toBeNull();
  expect(detail.cuisines).toEqual(["biryani_kacchi", "mishti"]);
});

test.each([
  ["c3 unknown", async () => "22222222-2222-4222-8222-222222222222"],
  ["c4 inactive", () => insertPlace(db.sql, { is_active: false })],
  ["c5 hidden", () => insertPlace(db.sql, { is_hidden: true })],
])("%s place is not found", async (_name, makeId) => {
  const res = await getDetail(await makeId());

  expect(res.status).toBe(404);
  expect(await res.json()).toMatchObject({ error: { code: "FOOD_PLACE_NOT_FOUND" } });
});

test("c2 rejects a non-UUID ID", async () => {
  const res = await getDetail("not-a-uuid");

  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ error: { code: "INVALID_ID" } });
});
