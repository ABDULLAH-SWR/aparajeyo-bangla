"""food_poi_import against the migrated schema."""

import json
import sys

import pyarrow as pa
import pyarrow.parquet as pq
from conftest import DHAKA
from psycopg.types.json import Jsonb
from shapely.geometry import Point

from food_poi_import import import_pois
from food_poi_import.import_pois import ingest_osm_from_staging, load_category_map, main
from shared.db import get_pg_connection


def stage_osm(db, osm_id: int, lng: float, lat: float) -> None:
    db.conn.execute(
        "CREATE TABLE IF NOT EXISTS osm_food_staging"
        " (osm_type char(1), osm_id bigint, tags jsonb, geom geometry(Point, 4326))"
    )
    db.conn.execute(
        "INSERT INTO osm_food_staging VALUES ('N', %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))",
        (osm_id, Jsonb({"amenity": "restaurant", "name": "Test Kitchen"}), lng, lat),
    )


def run_osm_ingest() -> None:
    with get_pg_connection() as conn:
        ingest_osm_from_staging(conn, load_category_map())


def test_osm_import_never_assigns_an_upazila_from_another_district(food_db):
    food_db.migrate()
    food_db.seed_geo()
    # A district with no upazila polygon at the point, next to another district's upazila.
    food_db.conn.execute("DELETE FROM geo_upazilas WHERE district_id = %s", (DHAKA,))
    food_db.conn.execute(
        "UPDATE geo_upazilas SET geom = (SELECT geom FROM geo_districts WHERE id = %s)", (DHAKA,)
    )
    stage_osm(food_db, 1, 90.4, 23.8)

    run_osm_ingest()

    row = food_db.conn.execute("SELECT district_id, upazila_id FROM places").fetchone()
    assert row == {"district_id": DHAKA, "upazila_id": None}


def test_backfill_links_each_merged_loser_to_its_survivor(food_db, monkeypatch, capsys):
    food_db.migrate()
    food_db.seed_geo()
    survivor = food_db.insert_place(merged_source_ids=Jsonb(["ovt-merged", "ovt-resurrected"]))
    merged = food_db.insert_place(source="overture", source_id="ovt-merged", is_active=False)
    resurrected = food_db.insert_place(source="overture", source_id="ovt-resurrected")
    unrelated = food_db.insert_place(source="overture", source_id="ovt-closed", is_active=False)
    monkeypatch.setattr(sys, "argv", ["food-poi-import", "--backfill-merged-into"])

    main()
    first = json.loads(capsys.readouterr().out)
    main()
    second = json.loads(capsys.readouterr().out)

    assert (first, second) == ({"merged_into_backfilled": 2}, {"merged_into_backfilled": 0})
    rows = food_db.conn.execute(
        "SELECT id::text AS id, merged_into::text AS into, is_active FROM places"
        " WHERE source = 'overture'"
    )
    assert {r["id"]: (r["into"], r["is_active"]) for r in rows} == {
        merged: (survivor, False),
        resurrected: (survivor, False),
        unrelated: (None, False),
    }


def test_overture_reimport_keeps_a_merged_place_inactive(food_db, monkeypatch, tmp_path):
    food_db.migrate()
    food_db.seed_geo()
    survivor = food_db.insert_place()
    food_db.insert_place(
        source="overture", source_id="ovt-merged", is_active=False, merged_into=survivor
    )
    cache = tmp_path / "overture.parquet"
    row = {
        "id": "ovt-merged",
        "geometry": Point(90.4, 23.8).wkb,
        "confidence": 0.9,
        "names": {"primary": "Test Kitchen"},
        "basic_category": "restaurant",
    }
    pq.write_table(pa.Table.from_pylist([row]), cache)
    monkeypatch.setattr(import_pois, "OVERTURE_CACHE_PATH", cache)

    with get_pg_connection() as conn:
        assert import_pois.ingest_overture(conn, load_category_map()) == 1

    state = food_db.conn.execute(
        "SELECT is_active FROM places WHERE source_id = 'ovt-merged'"
    ).fetchone()
    assert state == {"is_active": False}
