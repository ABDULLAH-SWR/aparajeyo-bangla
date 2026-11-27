"""Slice 0D.1: run_import loads fixture OSM and Overture data into places."""

from importing import import_sources, places

# source_id -> (district_id, category). Worked out by hand from the fixtures.
EXPECTED_ACTIVE = {
    "node/1": ("BD3026", "restaurant"),
    "node/2": ("BD3026", "tea_stall"),
    "node/3": ("BD3026", "sweets_bakery"),
    "node/4": ("BD3026", "fast_food"),
    "node/6": ("BD5010", "sweets_bakery"),
    "way/101": ("BD5010", "restaurant"),
    "way/102": ("BD3026", "food_court"),
    "ovt-coffee": ("BD3026", "cafe"),
    "ovt-pizza": ("BD3026", "fast_food"),
    "ovt-doi": ("BD5010", "sweets_bakery"),
    "ovt-kacchi": ("BD3026", "restaurant"),
}


def test_fixture_sources_produce_expected_places(import_db):
    import_sources(import_db)

    active = {sid: row for sid, row in places(import_db).items() if row["is_active"]}

    assert {s: (r["district_id"], r["category"]) for s, r in active.items()} == EXPECTED_ACTIVE
    assert all(row["name_norm"] for row in active.values())
