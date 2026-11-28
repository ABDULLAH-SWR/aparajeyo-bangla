// Vitest setupFiles hook: runs before each test file and clones the template into that file's own
// database, so files never see each other's rows, however many run at once.
import { createHash } from "node:crypto";
import { afterAll, expect } from "vitest";
import { cloneTemplate, dropDatabase } from "./pg";

const file = createHash("sha1").update(expect.getState().testPath!).digest("hex").slice(0, 12);
const name = `food_t_${process.env.VITEST_POOL_ID}_${file}`;

process.env.DATABASE_URL = await cloneTemplate(name);

afterAll(() => dropDatabase(name));
