// The SQL CHECK constraints accept exactly the values of the TypeScript enum tuples.
import { afterAll, expect, test } from "vitest";
import { FOOD_CATEGORIES, FOOD_CUISINES } from "../../../contract/enums";
import { createFileDb } from "../support/pg";

const db = await createFileDb();
afterAll(() => db.drop());

/** The string literals of the constraint's ARRAY[...] list, as Postgres reports it. */
async function allowedBy(constraint: string): Promise<string[]> {
  const [row] = await db.sql`SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conname = ${constraint} AND conrelid = 'places'::regclass`;
  const list = /ARRAY\[([^\]]*)\]/.exec(row!.definition)![1]!;
  return [...list.matchAll(/'([^']*)'/g)].map((match) => match[1]!).sort();
}

test.each([
  ["places_food_category_chk", FOOD_CATEGORIES],
  ["places_food_cuisines_chk", FOOD_CUISINES],
])("c1 %s contains exactly the enum members", async (constraint, members) => {
  expect(await allowedBy(constraint)).toEqual([...members].sort());
});
