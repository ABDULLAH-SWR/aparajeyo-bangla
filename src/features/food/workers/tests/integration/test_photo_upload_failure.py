"""Slice 2.2: a failed upload writes nothing to the database."""

from media import mock_commons, one_place, run_sync, store


def test_a_refused_upload_leaves_the_place_to_be_retried(
    food_db, valkey_db, media_stack, http_mock
):
    one_place(food_db)
    mock_commons(http_mock)
    read_only = store(media_stack, "S3_IMGPROXY")  # Garage itself answers AccessDenied

    result = run_sync(food_db, media_stack, valkey_db, s3=read_only)

    assert result["failed"] == 1
    assert food_db.conn.execute("SELECT count(*) AS n FROM place_photos").fetchone()["n"] == 0
    place = food_db.conn.execute(
        "SELECT wikimedia_s3_keys AS keys, photos_synced_at AS synced FROM places"
    ).fetchone()
    assert place == {"keys": [], "synced": None}
