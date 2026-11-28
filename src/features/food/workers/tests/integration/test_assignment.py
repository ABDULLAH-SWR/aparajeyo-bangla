"""Slice 0D.2: district and upazila assignment is the same for both sources."""

from importing import import_sources, osm_variant, overture_variant, places

# Inside Dhaka district and inside Gazipur's upazila, 220 m from that upazila's southern edge.
BORDER = {"lng": 90.35, "lat": 23.897}


def test_c1_an_upazila_always_belongs_to_the_chosen_district(import_db, tmp_path):
    osm = osm_variant(tmp_path, add=({"id": 50, **BORDER},))

    import_sources(import_db, osm=osm, overture=None)

    row = places(import_db)["node/50"]
    assert (row["district_id"], row["upazila_id"]) == ("BD3026", "BD30260014")


def test_c2_the_same_point_from_overture_gets_the_same_assignment(import_db, tmp_path):
    osm = osm_variant(tmp_path, add=({"id": 50, **BORDER},))
    overture = overture_variant(tmp_path, add=({"id": "ovt-border", **BORDER},))

    import_sources(import_db, osm=osm, overture=overture)

    rows = places(import_db)
    assert (rows["ovt-border"]["district_id"], rows["ovt-border"]["upazila_id"]) == (
        rows["node/50"]["district_id"],
        rows["node/50"]["upazila_id"],
    )


def test_c3_a_point_just_offshore_snaps_to_the_coastal_district(import_db, tmp_path):
    # 1.2 km west of Cox's Bazar's coastline, level with its southern upazila.
    osm = osm_variant(tmp_path, add=({"id": 51, "lng": 91.888426, "lat": 21.35},))

    import_sources(import_db, osm=osm, overture=None)

    row = places(import_db)["node/51"]
    assert (row["district_id"], row["upazila_id"]) == ("BD2022", "BD20220024")


def test_c4_a_point_far_offshore_is_rejected_and_recorded(import_db, tmp_path):
    osm = osm_variant(tmp_path, add=({"id": 52, "lng": 91.8517, "lat": 21.35},))  # 5 km out

    import_sources(import_db, osm=osm, overture=None)

    assert "node/52" not in places(import_db)
    rejects = import_db.conn.execute(
        "SELECT r.source, r.source_id, r.reason, s.status FROM food_import_rejects r"
        " JOIN sync_runs s ON s.id = r.run_id"
    ).fetchall()
    assert rejects == [
        {"source": "osm", "source_id": "node/52", "reason": "outside_admin_polygons", "status": "succeeded"}
    ]
