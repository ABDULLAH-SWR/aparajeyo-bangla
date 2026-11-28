// File A of the isolation pair: runs in parallel with isolation_b.test.ts.
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";
import { insertPlace } from "../support/fixtures";
import { buildTestDeps } from "../support/deps";
import { meetPeer } from "./rendezvous";

const PLACE_A = "00000000-0000-4000-8000-00000000000a";
const sql = postgres(buildTestDeps().databaseUrl, { max: 1 });

afterAll(() => sql.end());

test("this file sees its own place and nothing a parallel file wrote", async () => {
  await insertPlace(sql, { id: PLACE_A });
  await meetPeer("a");

  expect(await sql`SELECT id FROM places`).toEqual([{ id: PLACE_A }]);
});
