"""Slice 0D.3: rows missing from their source are deactivated after two imports."""

import pytest
from importing import import_sources, osm_variant, overture_variant, places

from food_poi_import.run import ImportSanityError


def state(db, source_id: str) -> tuple[bool, int]:
    row = places(db)[source_id]
    return row["is_active"], row["missed_imports"]


def test_c1_an_overture_row_is_deactivated_after_two_misses(import_db, tmp_path):
    import_sources(import_db)
    without_coffee = overture_variant(tmp_path, drop=("ovt-coffee",))

    import_sources(import_db, overture=without_coffee)
    assert state(import_db, "ovt-coffee") == (True, 1)

    import_sources(import_db, overture=without_coffee)
    assert state(import_db, "ovt-coffee") == (False, 2)
    assert state(import_db, "ovt-pizza") == (True, 0)


def test_c2_an_osm_row_is_deactivated_after_two_misses(import_db, tmp_path):
    import_sources(import_db)
    without_burger = osm_variant(tmp_path, drop=("node/4",))

    import_sources(import_db, osm=without_burger)
    assert state(import_db, "node/4") == (True, 1)

    import_sources(import_db, osm=without_burger)
    assert state(import_db, "node/4") == (False, 2)
    assert state(import_db, "node/2") == (True, 0)


def test_c3_a_truncated_source_aborts_the_run_and_changes_nothing(import_db, tmp_path):
    import_sources(import_db)
    before = snapshot(import_db)
    # 4 Overture rows are active; 3 candidates is 75 % of that. The OSM file also changes.
    truncated = overture_variant(tmp_path, drop=("ovt-star", "ovt-akboria", "ovt-kacchi"))
    changed_osm = osm_variant(
        tmp_path, drop=("node/4",), add=({"id": 60, "lng": 90.36, "lat": 23.78},)
    )

    with pytest.raises(ImportSanityError, match="overture"):
        import_sources(import_db, osm=changed_osm, overture=truncated)

    assert snapshot(import_db) == before


def snapshot(db) -> dict:
    tables = ("places", "sync_runs", "food_import_rejects", "conflation_review_queue")
    return {
        t: db.conn.execute(f"SELECT t::text AS row FROM {t} t ORDER BY 1").fetchall()
        for t in tables
    }
