// Prepares a Directus instance for the Food editors, through its REST API. Safe to run repeatedly.
//   bun scripts/directus-bootstrap.ts register    before `directus schema apply`
//   bun scripts/directus-bootstrap.ts             after it: the Food Editor's access, which a schema
//                                                 snapshot does not carry
// The Food tables belong to dbmate, and `schema apply` cannot adopt them: it tries to create a table
// it does not track, and when it edits a field it re-issues ALTER TABLE for jsonb and array defaults,
// which directus_food rightly may not run. So `register` first writes the snapshot's metadata for
// every table and field (metadata only, no DDL), and apply then finds nothing left to alter.
// Environment: DIRECTUS_URL, DIRECTUS_ADMIN_EMAIL, DIRECTUS_ADMIN_PASSWORD, and the stack's
// FOOD_INTERNAL_PREFIX when it is not the one docker-compose.yml defaults to.
import { readFileSync } from "node:fs";
import { z } from "zod";

const SNAPSHOT = new URL("../directus/snapshot.yaml", import.meta.url);

const EnvSchema = z.object({
  DIRECTUS_URL: z.url(),
  DIRECTUS_ADMIN_EMAIL: z.string().min(1),
  DIRECTUS_ADMIN_PASSWORD: z.string().min(1),
  // The first three octets of the internal subnet. The default equals docker-compose.yml's.
  FOOD_INTERNAL_PREFIX: z.string().regex(/^\d{1,3}(\.\d{1,3}){2}$/).default("172.30.0"),
});

const Meta = z.record(z.string(), z.unknown());
const SnapshotSchema = z.object({
  collections: z.array(z.object({ collection: z.string(), meta: Meta })),
  fields: z.array(z.object({ collection: z.string(), field: z.string(), meta: Meta })),
});

async function connect(env: z.infer<typeof EnvSchema>) {
  const base = env.DIRECTUS_URL.replace(/\/+$/, "");
  let token = "";

  /** The `data` of a successful response. Anything else throws, naming the request. */
  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text}`);
    return text ? z.object({ data: z.unknown() }).parse(JSON.parse(text)).data : undefined;
  }

  const login = await request("POST", "/auth/login", {
    email: env.DIRECTUS_ADMIN_EMAIL,
    password: env.DIRECTUS_ADMIN_PASSWORD,
  });
  token = z.object({ access_token: z.string() }).parse(login).access_token;
  return request;
}

type Request = Awaited<ReturnType<typeof connect>>;

async function register(request: Request): Promise<void> {
  const snapshot = SnapshotSchema.parse(Bun.YAML.parse(readFileSync(SNAPSHOT, "utf8")));
  // Collections first: a field belongs to a tracked collection.
  for (const { collection, meta } of snapshot.collections) {
    await request("PATCH", `/collections/${collection}`, { meta });
  }
  for (const { collection, field, meta } of snapshot.fields) {
    await request("PATCH", `/fields/${collection}/${field}`, { meta });
  }
  console.log(
    `directus-bootstrap: registered ${snapshot.collections.length} collections, ${snapshot.fields.length} fields`,
  );
}

const RecordSchema = z.object({ id: z.union([z.string(), z.number()]) });
const RecordsSchema = z.array(RecordSchema);

const matching = (filter: Record<string, string>) =>
  Object.entries(filter)
    .map(([field, value]) => `filter[${field}][_eq]=${encodeURIComponent(value)}`)
    .join("&");

/** Updates the one record that matches `filter`, or creates it. Returns its ID. */
async function upsert(
  request: Request,
  path: string,
  filter: Record<string, string>,
  record: Record<string, unknown>,
): Promise<string | number> {
  const [found] = RecordsSchema.parse(await request("GET", `${path}?${matching(filter)}&fields=id`));
  if (found) {
    await request("PATCH", `${path}/${found.id}`, record);
    return found.id;
  }
  return RecordSchema.parse(await request("POST", path, record)).id;
}

interface Permission {
  collection: string;
  action: "create" | "read" | "update";
  fields: string[];
  /** Rows the action may touch. */
  permissions?: Record<string, unknown>;
  /** What a written item must satisfy. */
  validation?: Record<string, unknown>;
  /** Values Directus sets itself. */
  presets?: Record<string, string>;
}

const FOOD_ONLY = { overlay_type: { _eq: "food" } };
const REVIEW_DECISION = { status: { _in: ["approved", "rejected"] } };

// Guide §8 Slice 2.12. Nothing grants delete.
const PERMISSIONS: Permission[] = [
  { collection: "places", action: "read", fields: ["*"], permissions: FOOD_ONLY },
  {
    collection: "places",
    action: "update",
    fields: ["name_en_override", "name_bn_override", "geom_override", "is_hidden", "is_featured"],
    permissions: FOOD_ONLY,
  },
  { collection: "video_place_matches", action: "read", fields: ["*"] },
  {
    collection: "video_place_matches",
    action: "update",
    fields: ["status"],
    validation: REVIEW_DECISION,
    presets: { reviewed_by: "$CURRENT_USER", reviewed_at: "$NOW" },
  },
  { collection: "conflation_review_queue", action: "read", fields: ["*"] },
  { collection: "conflation_review_queue", action: "update", fields: ["status"], validation: REVIEW_DECISION },
  { collection: "youtube_channels", action: "read", fields: ["*"] },
  {
    collection: "youtube_channels",
    action: "create",
    fields: ["channel_id", "title", "overlay_type", "is_active"],
    validation: { channel_id: { _regex: "^UC[0-9A-Za-z_-]{22}$" } },
  },
  { collection: "youtube_channels", action: "update", fields: ["title", "is_active"] },
  ...["youtube_videos", "place_photos", "geo_districts", "geo_upazilas"].map(
    (collection): Permission => ({ collection, action: "read", fields: ["*"] }),
  ),
];

// Guide §8 Slice 2.11, "Layout / display": how each collection first opens. An editor can change it.
const PENDING = { status: { _eq: "pending" } };
const table = (fields: string[], sort: string[]) => ({
  layout: "tabular",
  layout_query: { tabular: { fields, sort } },
});
const PRESETS = [
  { collection: "places", layout: "map", filter: FOOD_ONLY, layout_options: { map: { geometryField: "eff_geom" } } },
  {
    collection: "video_place_matches",
    filter: PENDING,
    ...table(
      ["video_id.title", "place_id.eff_name_en", "place_id.eff_name_bn", "confidence", "method", "start_seconds", "status"],
      ["-confidence"],
    ),
  },
  {
    collection: "conflation_review_queue",
    filter: PENDING,
    ...table(
      ["primary_place_id.eff_name_en", "candidate_place_id.eff_name_en", "distance_m", "name_similarity", "status"],
      ["-name_similarity"],
    ),
  },
  { collection: "youtube_channels", ...table(["title", "channel_id", "overlay_type", "is_active"], ["title"]) },
];

async function grantEditorAccess(request: Request): Promise<void> {
  const policy = String(
    await upsert(request, "/policies", { name: "food-editor" }, {
      name: "food-editor",
      icon: "restaurant",
      app_access: true,
      admin_access: false,
    }),
  );
  const role = String(await upsert(request, "/roles", { name: "Food Editor" }, { name: "Food Editor" }));
  await upsert(request, "/access", { role, policy }, { role, policy });

  const declared = new Set<string | number>();
  for (const { collection, action, ...rules } of PERMISSIONS) {
    const id = await upsert(request, "/permissions", { policy, collection, action }, {
      policy,
      collection,
      action,
      // Every rule is written, so a rule removed here is removed there too.
      permissions: null,
      validation: null,
      presets: null,
      ...rules,
    });
    declared.add(id);
  }
  // Whatever else the policy holds was not declared here, so the editor must not have it.
  const held = RecordsSchema.parse(await request("GET", `/permissions?${matching({ policy })}&fields=id&limit=-1`));
  for (const { id } of held.filter((permission) => !declared.has(permission.id))) {
    await request("DELETE", `/permissions/${id}`);
    console.log(`directus-bootstrap: removed undeclared permission ${id}`);
  }

  for (const preset of PRESETS) {
    await upsert(request, "/presets", { collection: preset.collection, role }, { ...preset, role, user: null });
  }
  console.log(`directus-bootstrap: role "Food Editor" holds ${PERMISSIONS.length} permissions`);
}

// Guide §8 Slice 2.13: every editor write on these collections invalidates the API's cache.
async function installInvalidationFlow(request: Request, url: string): Promise<void> {
  const flow = String(
    await upsert(request, "/flows", { name: "food-invalidate" }, {
      name: "food-invalidate",
      icon: "refresh",
      status: "active",
      trigger: "event",
      accountability: "all",
      options: {
        type: "action", // runs after the write, and never blocks it
        scope: ["items.create", "items.update", "items.delete"],
        collections: ["places", "video_place_matches", "conflation_review_queue", "youtube_channels"],
      },
    }),
  );
  const operation = await upsert(request, "/operations", { flow, key: "invalidate" }, {
    flow,
    key: "invalidate",
    name: "Invalidate the Food API cache",
    type: "request",
    position_x: 19,
    position_y: 1,
    options: {
      method: "POST",
      url,
      headers: [
        // Directus fills this in when the Flow runs (FLOWS_ENV_ALLOW_LIST): no token is stored.
        { header: "Authorization", value: "Bearer {{$env.FOOD_INVALIDATE_TOKEN}}" },
        { header: "Content-Type", value: "application/json" },
      ],
      body: "{{$trigger}}",
    },
  });
  await request("PATCH", `/flows/${flow}`, { operation });
  console.log("directus-bootstrap: Flow food-invalidate is active");
}

const [command] = process.argv.slice(2);
if (command !== undefined && command !== "register") {
  throw new Error("usage: directus-bootstrap.ts [register]");
}
const env = EnvSchema.parse(process.env);
const request = await connect(env);
if (command === "register") {
  await register(request);
} else {
  await grantEditorAccess(request);
  // docker-compose.yml gives the API's internal listener the address .10 of the internal subnet.
  await installInvalidationFlow(request, `http://${env.FOOD_INTERNAL_PREFIX}.10:8003/internal/v1/cache/invalidate`);
}
