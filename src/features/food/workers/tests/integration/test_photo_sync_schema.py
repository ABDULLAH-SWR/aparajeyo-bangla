"""food_photo_sync against the migrated schema."""

from media import JPEG_SHA256, KACCHI_TAGS, mock_commons, run_sync
from psycopg.types.json import Jsonb

from food_photo_sync.commons import COMMONS_API, WIKIDATA_API


def test_two_places_sharing_a_commons_file_each_get_a_photo(
    food_db, valkey_db, media_stack, http_mock
):
    food_db.migrate()
    food_db.seed_geo()
    a = food_db.insert_place(tags=KACCHI_TAGS)
    b = food_db.insert_place(tags=KACCHI_TAGS)
    mock_commons(http_mock)

    run_sync(food_db, media_stack, valkey_db)

    rows = food_db.conn.execute("SELECT place_id::text AS id FROM place_photos").fetchall()
    assert sorted(r["id"] for r in rows) == sorted([a, b])


def test_sync_leaves_the_derived_key_array_to_the_database(
    food_db, valkey_db, media_stack, http_mock
):
    food_db.migrate()
    food_db.seed_geo()
    place = food_db.insert_place(tags=KACCHI_TAGS)
    older = food_db.insert_photo(place, "CC BY 4.0", "1" * 64)
    mock_commons(http_mock)

    run_sync(food_db, media_stack, valkey_db)

    keys = food_db.conn.execute("SELECT wikimedia_s3_keys AS keys FROM places").fetchone()["keys"]
    assert sorted(keys) == sorted([older, f"photos/food/{place}/{JPEG_SHA256}.jpg"])


def test_a_failed_wikimedia_call_is_logged_and_counted(
    food_db, valkey_db, media_stack, http_mock, caplog
):
    food_db.migrate()
    food_db.seed_geo()
    food_db.insert_place(tags=KACCHI_TAGS)
    food_db.insert_place(tags=Jsonb({"wikidata": "Q1"}))
    for api in (COMMONS_API, WIKIDATA_API):
        http_mock.get(url__startswith=api).respond(500)

    result = run_sync(food_db, media_stack, valkey_db)

    assert (result["failed"], result["rows_inserted"]) == (2, 0)
    assert len([r for r in caplog.records if r.levelname == "WARNING" and r.exc_info]) == 2
    synced = food_db.conn.execute("SELECT photos_synced_at AS at FROM places").fetchall()
    assert [row["at"] for row in synced] == [None, None]
