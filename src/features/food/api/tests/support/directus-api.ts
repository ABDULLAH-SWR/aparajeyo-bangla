/// <reference types="bun" />
// Directus REST calls, as the tests make them.
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { inject } from "vitest";
import { z } from "zod";

const BodySchema = z.object({ data: z.unknown().optional() });

interface DirectusResponse {
  status: number;
  data: unknown;
}

/** A client that sends `token` with every request. */
function directusClient(baseUrl: string, token: string) {
  async function request(method: string, path: string, body?: unknown): Promise<DirectusResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text.startsWith("{") ? BodySchema.parse(JSON.parse(text)).data : undefined;
    return { status: response.status, data };
  }

  return {
    get: (path: string) => request("GET", path),
    post: (path: string, body?: unknown) => request("POST", path, body),
    patch: (path: string, body: unknown) => request("PATCH", path, body),
    delete: (path: string) => request("DELETE", path),
  };
}

export type DirectusClient = ReturnType<typeof directusClient>;

const LoginSchema = z.object({ data: z.object({ access_token: z.string() }) });

/** The first-boot administrator of the test stack. */
export async function adminClient(): Promise<DirectusClient> {
  const { DIRECTUS_URL, DIRECTUS_ADMIN_EMAIL, DIRECTUS_ADMIN_PASSWORD } = inject("directus");
  const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DIRECTUS_ADMIN_EMAIL, password: DIRECTUS_ADMIN_PASSWORD }),
  });
  const login = LoginSchema.parse(await response.json());
  return directusClient(DIRECTUS_URL, login.data.access_token);
}

const RoleListSchema = z.array(z.object({ id: z.string() })).length(1);
const IdSchema = z.object({ id: z.string() });

/** A new user holding the role "Food Editor", signed in by a static token. */
export async function createEditor(admin: DirectusClient) {
  const roles = await admin.get("/roles?filter[name][_eq]=Food%20Editor&fields=id");
  const [role] = RoleListSchema.parse(roles.data);
  const token = randomBytes(24).toString("hex");
  const created = await admin.post("/users", {
    email: `editor-${randomBytes(6).toString("hex")}@example.com`,
    role: role!.id,
    token,
  });
  const { id } = IdSchema.parse(created.data);
  return { id, client: directusClient(inject("directus").DIRECTUS_URL, token) };
}

/** The database owner, for arranging rows and reading back what Directus stored. */
export const ownerDb = () => postgres(inject("directus").DATABASE_URL_OWNER, { max: 2, onnotice: () => {} });

/**
 * Polls `read` every second until `done` accepts its result, for at most 60 s: the bound within which
 * an editor's change must be visible (Guide §8.3). Returns the last result and the time it took.
 */
export async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean) {
  const started = Date.now();
  for (;;) {
    const value = await read();
    const elapsedMs = Date.now() - started;
    if (done(value) || elapsedMs >= 60_000) return { value, elapsedMs };
    await Bun.sleep(1000);
  }
}
