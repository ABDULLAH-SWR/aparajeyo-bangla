/// <reference types="bun" />
// Slice 2.10: what the Directus database role may do, connected as that role.
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { ownerDb } from "../support/directus-api";
import { insertMatch, insertPlace, insertVideo } from "../support/fixtures";

const INSUFFICIENT_PRIVILEGE = "42501";

let owner: postgres.Sql;
let directus: postgres.Sql;
let placeId: string;

beforeAll(async () => {
  const settings = inject("directus");
  owner = ownerDb();
  const url = new URL(settings.DATABASE_URL_OWNER);
  url.username = "directus_food";
  url.password = settings.DIRECTUS_DB_PASSWORD;
  directus = postgres(url.toString(), { max: 1, onnotice: () => {} });
  placeId = await insertPlace(owner);
});

afterAll(async () => {
  await directus?.end();
  await owner?.end();
});

describe("the directus_food role", () => {
  test("c1 can hide a place, which advances updated_at", async () => {
    await owner`UPDATE places SET updated_at = '2026-01-01T00:00:00Z' WHERE id = ${placeId}`;

    await directus`UPDATE places SET is_hidden = true WHERE id = ${placeId}`;

    const [place] = await owner`SELECT is_hidden, updated_at > '2026-01-01T00:00:00Z' AS advanced
      FROM places WHERE id = ${placeId}`;
    expect(place).toMatchObject({ is_hidden: true, advanced: true });
  });

  test("c2 cannot change an imported name", async () => {
    const update = directus`UPDATE places SET name_en = 'x' WHERE id = ${placeId}`;

    await expect(update).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
  });

  test("c3 cannot alter a Food table", async () => {
    const alter = directus`ALTER TABLE places ADD COLUMN x int`;

    await expect(alter).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
  });

  test("c4 can approve a match, which puts the video on the place", async () => {
    const videoId = "dirRoleVid1";
    await insertVideo(owner, videoId);
    await insertMatch(owner, videoId, placeId, { status: "pending" });

    await directus`UPDATE video_place_matches SET status = 'approved' WHERE video_id = ${videoId}`;

    const [place] = await owner`SELECT youtube_video_ids FROM places WHERE id = ${placeId}`;
    expect(place!.youtube_video_ids).toEqual([videoId]);
  });

  test("c5 owns the directus schema", async () => {
    await directus`CREATE TABLE directus.test_t (id int)`;

    const [table] = await owner`SELECT to_regclass('directus.test_t')::text AS name`;
    expect(table!.name).toBe("directus.test_t");
    await directus`DROP TABLE directus.test_t`;
  });
});
