// db/seeds/from_mocks.sql follows the vendored mocks: after a sync, regenerate it.
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { mocksToSeed } from "../../../scripts/mocks-to-seed";

test("the committed seed is what scripts/mocks-to-seed.ts writes from the mocks", () => {
  const committed = readFileSync(new URL("../../../db/seeds/from_mocks.sql", import.meta.url), "utf8");

  expect(committed).toBe(mocksToSeed());
});
