"""Slice 2.1: one Commons file becomes a stored, credited photo."""

from media import JPEG, JPEG_SHA256, mock_commons, run_sync, stored_objects
from psycopg.types.json import Jsonb


def test_one_commons_file_becomes_a_stored_photo(food_db, valkey_db, media_stack, http_mock):
    food_db.migrate()
    food_db.seed_geo()
    place = food_db.insert_place(tags=Jsonb({"wikimedia_commons": "File:Example kacchi.jpg"}))
    mock_commons(http_mock)

    run_sync(food_db, media_stack, valkey_db)

    key = f"photos/food/{place}/{JPEG_SHA256}.jpg"
    rows = food_db.conn.execute(
        "SELECT s3_key, sha256, source, commons_title, author, license, license_url,"
        " source_page_url, width, height, sort_order FROM place_photos"
    ).fetchall()
    assert rows == [
        {
            "s3_key": key,
            "sha256": JPEG_SHA256,
            "source": "wikimedia",
            "commons_title": "File:Example kacchi.jpg",
            "author": "Example Photographer",
            "license": "CC BY-SA 4.0",
            "license_url": "https://creativecommons.org/licenses/by-sa/4.0",
            "source_page_url": "https://commons.wikimedia.org/wiki/File:Example_kacchi.jpg",
            "width": 2048,
            "height": 1536,
            "sort_order": 0,
        }
    ]
    assert stored_objects(media_stack, f"photos/food/{place}/") == {key: JPEG}
    keys = food_db.conn.execute("SELECT wikimedia_s3_keys AS keys FROM places").fetchone()["keys"]
    assert keys == [key]
