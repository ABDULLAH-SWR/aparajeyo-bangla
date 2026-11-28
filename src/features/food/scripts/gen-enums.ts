// Writes contract/food_enums.json, the form of contract/enums.ts that SQL parity and Python tests read.
//   bun run gen:enums            (from api/) write the file
//   bun run gen:enums --check    exit 1 if the file is stale
// An optional path replaces contract/food_enums.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FOOD_CATEGORIES, FOOD_CUISINES, FOOD_ERROR_CODES, FOOD_PHOTO_SOURCES, PLACE_SOURCES } from "../contract/enums";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"))
  ?? fileURLToPath(new URL("../contract/food_enums.json", import.meta.url));
const enums = {
  categories: FOOD_CATEGORIES,
  cuisines: FOOD_CUISINES,
  place_sources: PLACE_SOURCES,
  photo_sources: FOOD_PHOTO_SOURCES,
  error_codes: FOOD_ERROR_CODES,
};
const generated = `${JSON.stringify(enums, null, 2)}\n`;

if (!args.includes("--check")) {
  writeFileSync(file, generated);
} else if (!existsSync(file) || readFileSync(file, "utf8") !== generated) {
  console.error(`${file} is stale: run bun run gen:enums`);
  process.exit(1);
}
