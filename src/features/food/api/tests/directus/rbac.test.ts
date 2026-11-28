/// <reference types="bun" />
// Slice 2.12: what a user with the role "Food Editor" may do over the Directus REST API.
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { adminClient, createEditor, ownerDb, type DirectusClient } from "../support/directus-api";
import { insertMatch, insertPlace, insertVideo } from "../support/fixtures";

let owner: postgres.Sql;
let editor: DirectusClient;
let editorId: string;
let foodId: string;
let travelId: string;

beforeAll(async () => {
  owner = ownerDb();
  foodId = await insertPlace(owner);
  travelId = await insertPlace(owner, { overlay_type: "travel" });
  ({ client: editor, id: editorId } = await createEditor(await adminClient()));
});

afterAll(() => owner?.end());

describe("the Food Editor", () => {
  test("c1 hides a food place", async () => {
    const response = await editor.patch(`/items/places/${foodId}`, { is_hidden: true });

    expect(response.status).toBe(200);
    const [place] = await owner`SELECT is_hidden FROM places WHERE id = ${foodId}`;
    expect(place!.is_hidden).toBe(true);
  });


  test("c2 cannot change an imported name", async () => {
    const response = await editor.patch(`/items/places/${foodId}`, { name_en: "x" });

    expect(response.status).toBe(403);
  });

  test("c3 cannot touch a travel place", async () => {
    const response = await editor.patch(`/items/places/${travelId}`, { is_hidden: true });

    expect(response.status).toBe(403);
  });

  test("c4 cannot delete a place", async () => {
    const response = await editor.delete(`/items/places/${foodId}`);

    expect(response.status).toBe(403);
  });

  test("c5 approves a match, and Directus records who and when", async () => {
    const videoId = "rbacVideo01";
    await insertVideo(owner, videoId);
    await insertMatch(owner, videoId, foodId, { status: "pending" });
    const [match] = await owner`SELECT id FROM video_place_matches WHERE video_id = ${videoId}`;

    const response = await editor.patch(`/items/video_place_matches/${match!.id}`, { status: "approved" });

    expect(response.status).toBe(200);
    const [stored] = await owner`SELECT status, reviewed_by,
        reviewed_at BETWEEN now() - interval '5 minutes' AND now() + interval '5 minutes' AS just_now
      FROM video_place_matches WHERE video_id = ${videoId}`;
    expect(stored).toEqual({ status: "approved", reviewed_by: editorId, just_now: true });
  });


  test("c6 cannot mark a match as machine-approved", async () => {
    const videoId = "rbacVideo02";
    await insertVideo(owner, videoId);
    await insertMatch(owner, videoId, foodId, { status: "pending" });
    const [match] = await owner`SELECT id FROM video_place_matches WHERE video_id = ${videoId}`;

    const response = await editor.patch(`/items/video_place_matches/${match!.id}`, { status: "auto_approved" });

    expect(response.status).toBe(400);
  });

  test("c7 adds a channel by its ID, and cannot delete it", async () => {
    const channelId = `UC${"r".repeat(22)}`;

    const created = await editor.post("/items/youtube_channels", {
      channel_id: channelId,
      title: "Puran Dhaka Food",
      overlay_type: "food",
      is_active: true,
    });
    const deleted = await editor.delete(`/items/youtube_channels/${channelId}`);

    expect(created.status).toBe(200);
    expect(deleted.status).toBe(403);
    const [channel] = await owner`SELECT uploads_playlist_id FROM youtube_channels WHERE channel_id = ${channelId}`;
    expect(channel!.uploads_playlist_id).toBe(`UU${"r".repeat(22)}`);
  });


  test("c8 sees no user but their own", async () => {
    const response = await editor.get("/users");

    expect(response.status).toBe(200);
    expect(response.data).toEqual([expect.objectContaining({ id: editorId })]);
  });

  test("approves an uncertain merge", async () => {
    const candidateId = await insertPlace(owner);
    const [queued] = await owner`INSERT INTO conflation_review_queue
        (primary_place_id, candidate_place_id, distance_m, name_similarity)
      VALUES (${foodId}, ${candidateId}, 12.5, 0.55) RETURNING id`;

    const response = await editor.patch(`/items/conflation_review_queue/${queued!.id}`, { status: "approved" });

    expect(response.status).toBe(200);
  });


  test.each(["youtube_videos", "place_photos", "geo_districts", "geo_upazilas"])(
    "reads %s as context",
    async (collection) => {
      const response = await editor.get(`/items/${collection}?limit=1`);

      expect(response.status).toBe(200);
    },
  );
});
