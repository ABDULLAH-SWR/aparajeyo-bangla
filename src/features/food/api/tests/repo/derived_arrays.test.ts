/// <reference types="bun" />
import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createTestDb, type TestDb } from "../support/db";
import { insertMatch, insertPhoto, insertPlace, insertVideo, seedGeo } from "../support/fixtures";

setDefaultTimeout(180_000);

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
  await db.migrate();
  await seedGeo(db.sql);
});
afterAll(() => db?.drop());

async function media(id: string) {
  const [row] = await db.sql`SELECT wikimedia_s3_keys AS photos, youtube_video_ids AS videos, updated_at
    FROM places WHERE id = ${id}`;
  return row as unknown as { photos: string[]; videos: string[]; updated_at: Date };
}

test("photo keys follow sort_order", async () => {
  const place = await insertPlace(db.sql);

  await insertPhoto(db.sql, place, { sha256: "1".repeat(64), s3_key: "second", sort_order: 1 });
  await insertPhoto(db.sql, place, { sha256: "2".repeat(64), s3_key: "first", sort_order: 0 });

  expect((await media(place)).photos).toEqual(["first", "second"]);
});

test("reordering and deleting photos rebuilds the keys", async () => {
  const place = await insertPlace(db.sql);
  await insertPhoto(db.sql, place, { sha256: "3".repeat(64), s3_key: "a", sort_order: 0 });
  await insertPhoto(db.sql, place, { sha256: "4".repeat(64), s3_key: "b", sort_order: 1 });

  await db.sql`UPDATE place_photos SET sort_order = 2 WHERE place_id = ${place} AND s3_key = 'a'`;
  expect((await media(place)).photos).toEqual(["b", "a"]);

  await db.sql`DELETE FROM place_photos WHERE place_id = ${place}`;
  expect((await media(place)).photos).toEqual([]);
});

test("an approved match for an available video appears on the place", async () => {
  const place = await insertPlace(db.sql);
  await insertVideo(db.sql, "approved-vid");

  await insertMatch(db.sql, "approved-vid", place, { status: "approved" });

  expect((await media(place)).videos).toEqual(["approved-vid"]);
});

test("an unavailable video is removed from the place", async () => {
  const place = await insertPlace(db.sql);
  await insertVideo(db.sql, "gone-vid");
  await insertMatch(db.sql, "gone-vid", place);

  await db.sql`UPDATE youtube_videos SET is_available = false WHERE video_id = 'gone-vid'`;

  expect((await media(place)).videos).toEqual([]);
});

test("rejecting or deleting a match removes the video", async () => {
  const place = await insertPlace(db.sql);
  await insertVideo(db.sql, "rejected-vid");
  await insertVideo(db.sql, "deleted-vid");
  await insertMatch(db.sql, "rejected-vid", place, { confidence: 0.95 });
  await insertMatch(db.sql, "deleted-vid", place, { confidence: 0.85 });
  expect((await media(place)).videos).toEqual(["rejected-vid", "deleted-vid"]);

  await db.sql`UPDATE video_place_matches SET status = 'rejected' WHERE video_id = 'rejected-vid'`;
  await db.sql`DELETE FROM video_place_matches WHERE video_id = 'deleted-vid'`;

  expect((await media(place)).videos).toEqual([]);
});

test("a pending match changes nothing", async () => {
  const place = await insertPlace(db.sql);
  await insertVideo(db.sql, "pending-vid");
  const before = await media(place);

  await insertMatch(db.sql, "pending-vid", place, { status: "pending" });

  expect(await media(place)).toEqual(before);
});

test("an editor override advances updated_at, and a no-op write does not", async () => {
  const place = await insertPlace(db.sql);
  await db.sql`UPDATE places SET updated_at = '2000-01-01Z' WHERE id = ${place}`;

  await db.sql`UPDATE places SET is_hidden = false WHERE id = ${place}`;
  expect((await media(place)).updated_at).toEqual(new Date("2000-01-01Z"));

  await db.sql`UPDATE places SET name_en_override = 'Edited' WHERE id = ${place}`;
  expect((await media(place)).updated_at.getFullYear()).toBeGreaterThan(2000);
});

test("0009 reconciles arrays that had diverged", async () => {
  const legacy = await createTestDb();
  try {
    await legacy.migrate("0008");
    await seedGeo(legacy.sql);
    const place = await insertPlace(legacy.sql, { youtube_video_ids: ["stale-vid"] });
    await insertPhoto(legacy.sql, place, { s3_key: "real-key" });

    await legacy.migrate();

    const [row] = await legacy.sql`SELECT wikimedia_s3_keys, youtube_video_ids FROM places`;
    expect(row).toEqual({ wikimedia_s3_keys: ["real-key"], youtube_video_ids: [] });
  } finally {
    await legacy.drop();
  }
});
