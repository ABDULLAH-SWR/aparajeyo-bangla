// Slice 2.15: approving a pending match surfaces the video on the card and on the pin.
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { FoodPinDetailSchema, FoodPinsFeatureCollectionSchema } from "../../../contract/schemas";
import { adminClient, createEditor, eventually, ownerDb, type DirectusClient } from "../support/directus-api";
import { DHAKA, insertMatch, insertPlace, insertVideo } from "../support/fixtures";

let owner: postgres.Sql;
let editor: DirectusClient;

beforeAll(async () => {
  owner = ownerDb();
  ({ client: editor } = await createEditor(await adminClient()));
});

afterAll(() => owner?.end());

async function read(path: string): Promise<unknown> {
  const response = await fetch(`${inject("directus").FOOD_API_URL}/api/v1${path}`);
  expect(response.status).toBe(200);
  return response.json();
}

/** What the Map shows for one place: the videos on its card, and the badge on its pin. */
async function shown(placeId: string) {
  const detail = FoodPinDetailSchema.parse(await read(`/pins/food/${placeId}`));
  const pins = FoodPinsFeatureCollectionSchema.parse(await read(`/pins?overlay=food&district_id=${DHAKA}`));
  const pin = pins.features.find((feature) => feature.properties.id === placeId);
  return { videos: detail.videos.map((video) => video.video_id), hasVideo: pin?.properties.has_video };
}

describe("the review queue", () => {
  test("an approved match appears on the card and the pin within 60 s", async () => {
    const placeId = await insertPlace(owner);
    const videoId = "queueVideo1";
    await insertVideo(owner, videoId);
    await insertMatch(owner, videoId, placeId, { status: "pending", confidence: 0.7 });
    const [match] = await owner`SELECT id FROM video_place_matches WHERE video_id = ${videoId}`;
    expect(await shown(placeId)).toEqual({ videos: [], hasVideo: false }); // now cached

    const approved = await editor.patch(`/items/video_place_matches/${match!.id}`, { status: "approved" });
    expect(approved.status).toBe(200);
    const { value } = await eventually(() => shown(placeId), (state) => state.hasVideo === true && state.videos.length > 0);

    expect(value).toEqual({ videos: [videoId], hasVideo: true });
  });
});
