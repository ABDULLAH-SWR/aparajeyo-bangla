"""food-poi-import --backfill-merged-into against the migrated schema (Slice 0B.8)."""

import json
import sys

from psycopg.types.json import Jsonb

from food_poi_import.run import main


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
