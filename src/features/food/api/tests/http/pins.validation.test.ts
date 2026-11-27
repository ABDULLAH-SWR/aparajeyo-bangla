// The repository points at a closed port, so a 400 also proves no query ran.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestApp, CLOSED_DATABASE_URL, type TestApp } from "../support/app";

let t: TestApp;
beforeAll(() => {
  t = createTestApp({ databaseUrl: CLOSED_DATABASE_URL });
});
afterAll(() => t.close());

describe("invalid pins queries", () => {
  test.each([
    ["c1 unknown district", "overlay=food&district_id=BD9999", "INVALID_DISTRICT"],
    ["c2 three-part bbox", "overlay=food&bbox=90,23,91", "INVALID_BBOX"],
    ["c3 min greater than max", "overlay=food&bbox=91,23,90,24", "INVALID_BBOX"],
    ["c4 bbox outside Bangladesh", "overlay=food&bbox=80,10,81,11", "INVALID_BBOX"],
    ["c5 span over 2 degrees", "overlay=food&bbox=88,21,91,24", "INVALID_BBOX"],
    ["c6 unknown category", "overlay=food&category=pizza", "INVALID_CATEGORY"],
    ["c7 empty category", "overlay=food&category=", "INVALID_CATEGORY"],
    ["c8 wrong overlay", "overlay=news", "INVALID_QUERY"],
    ["c9 non-boolean has_video", "overlay=food&has_video=maybe", "INVALID_QUERY"],
    ["c10 district and bbox together", "overlay=food&district_id=BD3026&bbox=90.3,23.7,90.5,23.9", "INVALID_QUERY"],
  ])("%s", async (_name, query, code) => {
    const res = await t.app.request(`/api/v1/pins?${query}`);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code } });
  });
});
