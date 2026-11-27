"""Slice 0D.4: reimport never resurrects merged rows and never churns updated_at."""

from importing import import_sources, places


def test_c1_a_merged_overture_row_stays_inactive_after_reimport(import_db):
    import_sources(import_db)
    merged = places(import_db)["ovt-star"]
    survivor = places(import_db)["node/1"]
    assert (merged["merged_into"], merged["is_active"]) == (survivor["id"], False)

    import_sources(import_db)

    merged = places(import_db)["ovt-star"]
    assert (merged["merged_into"], merged["is_active"]) == (survivor["id"], False)


def test_c2_an_identical_reimport_changes_no_updated_at_and_no_id(import_db):
    import_sources(import_db)
    before = stable_columns(import_db)

    import_sources(import_db)

    assert stable_columns(import_db) == before


def stable_columns(db) -> dict:
    return {
        sid: (r["id"], r["updated_at"], r["name_en"], r["name_bn"], r["tags"], r["is_active"])
        for sid, r in places(db).items()
    }
