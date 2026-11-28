// Mock validity (README §5). Every rule is shown to catch a deliberately broken copy of the real mocks.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { validateMocks } from "../../../scripts/validate-mocks";

const MOCKS = fileURLToPath(new URL("../../../testdata/contract_mocks", import.meta.url));
const PINS = "food_pins.geojson.json";
const DETAIL = "food_pin_detail.json";

const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A copy of the real mocks with one file rewritten. */
function broken(file: string, rewrite: (text: string) => string): string {
  const dir = mkdtempSync(join(tmpdir(), "food-mocks-"));
  temporary.push(dir);
  cpSync(MOCKS, dir, { recursive: true });
  const path = join(dir, file);
  writeFileSync(path, rewrite(readFileSync(path, "utf8")));
  return dir;
}

/** The mocks are untyped here on purpose: the point is to give them shapes they must not have. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mock = any;
const edit = (change: (mock: Mock) => void) => (text: string) => {
  const mock = JSON.parse(text);
  change(mock);
  return JSON.stringify(mock);
};

const violation = (rule: string, file: string) => expect.objectContaining({ rule, file });

test("the vendored mocks break no rule", () => {
  expect(validateMocks(MOCKS)).toEqual([]);
});

test.each([PINS, DETAIL])("c1 %s must be valid JSON", (file) => {
  const dir = broken(file, (text) => text.slice(0, -20));

  expect(validateMocks(dir)).toContainEqual(violation("c1", file));
});

test.each([PINS, DETAIL])("c1 %s must parse with its schema", (file) => {
  const dir = broken(file, edit((mock) => delete (mock.features?.[0].properties ?? mock).category));

  expect(validateMocks(dir)).toContainEqual(violation("c1", file));
});

test("c1 a directory without mocks does not pass by default", () => {
  const dir = mkdtempSync(join(tmpdir(), "food-mocks-"));
  temporary.push(dir);

  expect(validateMocks(dir).map((v) => v.rule)).toContain("c1");
});

const OTHER_ID = "00000000-0000-4000-8000-000000000000";

test("c2 feature.id must equal properties.id", () => {
  const dir = broken(PINS, edit((mock) => (mock.features[0].properties.id = OTHER_ID)));

  expect(validateMocks(dir)).toContainEqual(violation("c2", PINS));
});

test.each([
  ["west", [87.9, 23.8]],
  ["east", [93.1, 23.8]],
  ["south", [90.4, 20.4]],
  ["north", [90.4, 26.9]],
])("c3 coordinates %s of Bangladesh are rejected", (_side, outside) => {
  const pins = broken(PINS, edit((mock) => (mock.features[0].geometry.coordinates = outside)));
  const detail = broken(DETAIL, edit((mock) => (mock.coordinates = outside)));

  expect(validateMocks(pins)).toContainEqual(violation("c3", PINS));
  expect(validateMocks(detail)).toContainEqual(violation("c3", DETAIL));
});

test.each([
  [PINS, "a pin", (mock: Mock) => (mock.features[0].properties.district_id = "BD9999")],
  [PINS, "the metadata", (mock: Mock) => (mock.metadata.district_id = "BD9999")],
  [DETAIL, "the detail", (mock: Mock) => (mock.district_id = "BD9999")],
])("c4 %s: an unknown district_id on %s is rejected", (file, _where, change) => {
  const dir = broken(file, edit(change));

  expect(validateMocks(dir)).toContainEqual(violation("c4", file));
});

/** The first record that names an upazila. */
const withUpazila = (mock: Mock) => mock.features?.map((f: Mock) => f.properties).find((p: Mock) => p.upazila_id) ?? mock;

test.each([PINS, DETAIL])("c5 %s: an unknown upazila_id is rejected", (file) => {
  const dir = broken(file, edit((mock) => (withUpazila(mock).upazila_id = "BD99999999")));

  expect(validateMocks(dir)).toContainEqual(violation("c5", file));
});

test.each([PINS, DETAIL])("c5 %s: an upazila outside the record's district is rejected", (file) => {
  const dir = broken(file, edit((mock) => {
    const place = withUpazila(mock);
    place.district_id = place.district_id === "BD3026" ? "BD2015" : "BD3026";
  }));

  expect(validateMocks(dir)).toContainEqual(violation("c5", file));
});

test.each([PINS, DETAIL])("c6 %s: pin_type must be food_poi everywhere", (file) => {
  const dir = broken(file, edit((mock) => ((mock.features?.at(-1).properties ?? mock).pin_type = "news_event")));

  expect(validateMocks(dir)).toContainEqual(violation("c6", file));
});

test.each([
  ["category", "tea_stall", "cafe"],
  ["source", "overture", "osm"],
])("c7 the pins mock must cover every %s", (key, missing, replacement) => {
  const dir = broken(PINS, edit((mock) => {
    for (const { properties } of mock.features) {
      if (properties[key] === missing) properties[key] = replacement;
    }
  }));

  expect(validateMocks(dir)).toContainEqual(
    expect.objectContaining({ rule: "c7", file: PINS, message: expect.stringContaining(missing) }),
  );
});

const WIKIMEDIA = "https://upload.wikimedia.org/wikipedia/commons/a/a0/Example.jpg";

test.each([
  [PINS, "thumbnail_url", (mock: Mock) => (mock.features[0].properties.thumbnail_url = WIKIMEDIA)],
  [DETAIL, "photos[].url", (mock: Mock) => (mock.photos[0].url = WIKIMEDIA)],
  [DETAIL, "photos[].thumb_url", (mock: Mock) => (mock.photos[0].thumb_url = WIKIMEDIA)],
])("c8 %s: %s must not hotlink upload.wikimedia.org", (file, _field, change) => {
  const dir = broken(file, edit(change));

  expect(validateMocks(dir)).toContainEqual(violation("c8", file));
});
