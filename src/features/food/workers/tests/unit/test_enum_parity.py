"""contract/food_enums.json (generated from the TypeScript tuples) bounds what the importer
emits."""

from __future__ import annotations

import json

import yaml

from food_poi_import.classify import classify_osm_tags, classify_overture_row
from food_poi_import.run import CATEGORY_MAP_PATH
from food_shared.config import FOOD_ROOT

ENUMS = json.loads((FOOD_ROOT / "contract" / "food_enums.json").read_text(encoding="utf-8"))
CMAP = yaml.safe_load(CATEGORY_MAP_PATH.read_text(encoding="utf-8"))
TAGS_FILE = FOOD_ROOT / "workers" / "tests" / "fixtures" / "osm" / "classify_tags.json"
OSM_TAGS = json.loads(TAGS_FILE.read_text(encoding="utf-8"))


def test_c2_category_map_targets_are_exactly_the_categories():
    targets = {
        t for name, section in CMAP.items() if name.endswith("_map") for t in section.values()
    }

    assert targets - set(ENUMS["categories"]) == set(), "targets that are not categories"
    assert set(ENUMS["categories"]) - targets == set(), "categories nothing maps to"


def assert_only_members(results: list[tuple[str | None, list[str]]]) -> None:
    categories = {category for category, _ in results} - {None}
    cuisines = {cuisine for _, found in results for cuisine in found}

    assert categories - set(ENUMS["categories"]) == set()
    assert cuisines - set(ENUMS["cuisines"]) == set()
    assert all(found for category, found in results if category), "a food place without a cuisine"


def test_c3_the_tag_fixture_reaches_every_mapped_tag_and_cuisine():
    for section, key in (("osm_amenity_map", "amenity"), ("osm_shop_map", "shop")):
        assert set(CMAP[section]) - {tags.get(key) for tags in OSM_TAGS} == set()

    reached = {cuisine for tags in OSM_TAGS for cuisine in classify_osm_tags(tags, CMAP)[1]}

    assert (set(CMAP["cuisine_keywords"]) | {"other"}) - reached == set()


def test_c3_classify_osm_tags_returns_only_enum_members():
    assert_only_members([classify_osm_tags(tags, CMAP) for tags in OSM_TAGS])


def test_c3_classify_overture_row_returns_only_enum_members():
    rows = [{"taxonomy": {"primary": primary}} for primary in CMAP["overture_category_map"]]
    unmapped = {"taxonomy": {"primary": "diner", "hierarchy": ["eat_and_drink", "diner"]}}

    results = [classify_overture_row(row, CMAP) for row in [*rows, unmapped]]

    assert_only_members(results)
    assert results[-1] == ("other", ["other"])
