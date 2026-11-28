// contract/food_enums.json is generated; --check is what stops it drifting from the tuples in CI.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, expect, test } from "vitest";

const SCRIPT = fileURLToPath(new URL("../../../scripts/gen-enums.ts", import.meta.url));
const COMMITTED = fileURLToPath(new URL("../../../contract/food_enums.json", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "food-enums-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const genEnums = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

test("--check passes on the committed file", () => {
  const run = genEnums("--check");

  expect(run.status, run.stderr).toBe(0);
});

test("--check exits 1 on a stale file and leaves it alone", () => {
  const stale = join(dir, "food_enums.json");
  const content = readFileSync(COMMITTED, "utf8").replace('"tea_stall"', '"tea_shop"');
  writeFileSync(stale, content);

  const run = genEnums("--check", stale);

  expect(run.status).toBe(1);
  expect(run.stderr).toContain("gen:enums");
  expect(readFileSync(stale, "utf8")).toBe(content);
});

test("writing then checking a new file passes", () => {
  const fresh = join(dir, "fresh.json");

  expect(genEnums(fresh).status).toBe(0);

  expect(JSON.parse(readFileSync(fresh, "utf8")).categories).toContain("tea_stall");
  expect(genEnums("--check", fresh).status).toBe(0);
});
