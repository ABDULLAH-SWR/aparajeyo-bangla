// One test per row of testdata/contract_matrix.ts, against the real app and database.
import { afterAll, beforeAll, expect, test } from "vitest";
import { FOOD_ERROR_CODES } from "../../../contract/enums";
import { ApiErrorResponseSchema } from "../../../contract/schemas";
import { CONTRACT_MATRIX, PLACE_ID, type MatrixRow } from "../../../testdata/contract_matrix";
import { CLOSED_DATABASE_URL, createTestApp, type TestApp } from "../support/app";
import { insertMatch, insertPhoto, insertPlace } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";
import { insertContractVideo } from "../support/seed";

let db: FileDb;
let up: TestApp;
let down: TestApp;

beforeAll(async () => {
  db = await createFileDb();
  await insertPlace(db.sql, { id: PLACE_ID, category: "tea_stall", geom: "SRID=4326;POINT(90.4 23.72)" });
  await insertPhoto(db.sql, PLACE_ID);
  await insertContractVideo(db.sql, "dQw4w9WgXcQ");
  await insertMatch(db.sql, "dQw4w9WgXcQ", PLACE_ID);
  up = createTestApp({ databaseUrl: db.url });
  down = createTestApp({ databaseUrl: CLOSED_DATABASE_URL });
});

afterAll(async () => {
  await up.close();
  await down.close();
  await db.drop();
});

const label = (row: MatrixRow) =>
  `${row.route} ${row.path}${row.revalidate ? " (If-None-Match)" : ""}${row.databaseDown ? " (database down)" : ""}` +
  ` -> ${row.status}${"code" in row ? ` ${row.code}` : ""}`;

test.each(CONTRACT_MATRIX.map((row) => [label(row), row] as const))("%s", async (_label, row) => {
  const { app } = row.databaseDown ? down : up;
  let res = await app.request(row.path);
  if (row.revalidate) {
    expect(res.status).toBe(200);
    res = await app.request(row.path, { headers: { "If-None-Match": res.headers.get("ETag")! } });
  }

  expect(res.status).toBe(row.status);
  if (row.status === 304) {
    expect(await res.text()).toBe("");
    return;
  }
  const json: unknown = await res.json();
  if (row.status === 200) {
    const body = row.body.parse(json);
    // An empty collection would satisfy the schema without exercising it.
    if ("features" in body) expect(body.features).not.toHaveLength(0);
    return;
  }
  expect(ApiErrorResponseSchema.parse(json).error.code).toBe(row.code);
});

test("every food error code appears in at least one row", () => {
  const covered = new Set(CONTRACT_MATRIX.flatMap((row) => ("code" in row ? [row.code] : [])));

  expect(FOOD_ERROR_CODES.filter((code) => !covered.has(code))).toEqual([]);
});
