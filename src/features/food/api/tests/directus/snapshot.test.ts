/// <reference types="bun" />
// Slice 2.11: what directus/snapshot.yaml declares, read back after `schema apply`.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, inject, test } from "vitest";
import { adminClient, type DirectusClient } from "../support/directus-api";
import { directusStack } from "../support/directus-stack";

const SNAPSHOT = new URL("../../../directus/snapshot.yaml", import.meta.url);

let admin: DirectusClient;

beforeAll(async () => {
  admin = await adminClient();
});

describe("the Directus snapshot", () => {
  test("c1 edits the position override on a map, as a point", async () => {
    const field = await admin.get("/fields/places/geom_override");

    expect(field.data).toMatchObject({ meta: { interface: "map", options: { geometryType: "Point" } } });
  });

  test("c2 keeps the effective position read-only and out of the form", async () => {
    const field = await admin.get("/fields/places/eff_geom");

    expect(field.data).toMatchObject({ meta: { readonly: true, hidden: true } });
  });

  test.each(["name_en", "name_bn", "geom", "category", "source", "source_id", "tags", "wikimedia_s3_keys",
    "youtube_video_ids"])("c3 keeps the importer-owned field %s read-only", async (name) => {
    const field = await admin.get(`/fields/places/${name}`);

    expect(field.data).toMatchObject({ meta: { readonly: true } });
  });

  test.each(["places", "video_place_matches", "conflation_review_queue", "youtube_channels", "youtube_videos",
    "place_photos"])("c4 declares the collection %s", async (name) => {
    const collection = await admin.get(`/collections/${name}`);

    expect(collection).toMatchObject({ status: 200, data: { meta: { collection: name, note: expect.any(String) } } });
  });

  // §8.3 review item.
  test("matches a fresh export", async () => {
    const exported = await directusStack(inject("directusProject")).run("export");

    expect(exported.replace(/\r/g, "")).toBe(readFileSync(SNAPSHOT, "utf8"));
  });
});
