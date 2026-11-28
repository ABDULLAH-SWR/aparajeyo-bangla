// File B of the isolation pair: runs in parallel with isolation.test.ts.
import { afterAll, expect, test } from "vitest";
import { insertPlace } from "../support/fixtures";
import { connectFileDb } from "../support/pg";
import { meetPeer } from "./rendezvous";

const PLACE_B = "00000000-0000-4000-8000-00000000000b";
const db = connectFileDb();

afterAll(() => db.close());

test("this file sees its own place and nothing a parallel file wrote", async () => {
  await insertPlace(db.sql, { id: PLACE_B });
  await meetPeer("b");

  expect(await db.sql`SELECT id FROM places`).toEqual([{ id: PLACE_B }]);
});
