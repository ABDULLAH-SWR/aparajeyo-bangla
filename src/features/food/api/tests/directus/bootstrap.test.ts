/// <reference types="bun" />
// directus-bootstrap.ts: it converges on the declared access and can be run any number of times.
import { beforeAll, describe, expect, inject, test } from "vitest";
import { z } from "zod";
import { adminClient, type DirectusClient } from "../support/directus-api";
import { runBootstrap } from "../support/directus-stack";

const ListSchema = z.array(z.record(z.string(), z.unknown()));
let admin: DirectusClient;

beforeAll(async () => {
  admin = await adminClient();
});

async function list(path: string) {
  const response = await admin.get(`${path}${path.includes("?") ? "&" : "?"}limit=-1&sort=id`);
  return ListSchema.parse(response.data);
}

/** Everything the script writes, as Directus reports it. */
async function editorAccess() {
  return {
    policies: await list("/policies?fields=id,name,admin_access,app_access"),
    roles: await list("/roles?fields=id,name"),
    access: await list("/access?fields=id,role,policy"),
    permissions: await list("/permissions?fields=id,policy,collection,action,fields,permissions,validation,presets"),
    presets: await list("/presets?fields=id,role,user,collection,layout,layout_query,layout_options,filter"),
    flows: await list("/flows?fields=id,name,status,trigger,options,operation"),
    operations: await list("/operations?fields=id,flow,key,type,options"),
  };
}

describe("directus-bootstrap", () => {
  test("changes nothing when run again", async () => {
    const before = await editorAccess();

    await runBootstrap(inject("directus"));

    expect(await editorAccess()).toEqual(before);
  });

  test("withdraws a permission that was added by hand to the editor policy", async () => {
    const [policy] = await list("/policies?filter[name][_eq]=food-editor&fields=id");
    await admin.post("/permissions", { policy: policy!.id, collection: "places", action: "delete", fields: ["*"] });

    await runBootstrap(inject("directus"));

    expect(await list(`/permissions?filter[policy][_eq]=${policy!.id}&filter[action][_eq]=delete`)).toEqual([]);
  });

  // Guide §8 Slice 2.11, "Layout / display". A schema snapshot does not carry presets.
  test.each([
    ["places", { layout: "map", filter: { overlay_type: { _eq: "food" } },
      layout_options: { map: { geometryField: "eff_geom" } } }],
    ["video_place_matches", { layout: "tabular", filter: { status: { _eq: "pending" } },
      layout_query: { tabular: { sort: ["-confidence"] } } }],
    ["conflation_review_queue", { layout: "tabular", filter: { status: { _eq: "pending" } } }],
    ["youtube_channels", { layout: "tabular" }],
  ])("opens %s for editors in the intended layout", async (collection, preset) => {
    const presets = await list(`/presets?filter[collection][_eq]=${collection}`);

    expect(presets).toEqual([expect.objectContaining({ user: null })]);
    expect(presets[0]).toMatchObject(preset);
  });
});
