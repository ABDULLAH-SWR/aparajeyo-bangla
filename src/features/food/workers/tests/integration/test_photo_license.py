"""Slice 2.3: a photo without a complete credit is never mirrored (contract §2.2)."""

import logging

import pytest
from media import imageinfo_with, mock_commons, one_place, run_sync


def photos(db) -> list[dict]:
    return db.conn.execute("SELECT author, license FROM place_photos").fetchall()


def test_c1_a_missing_license_name_is_skipped_and_logged(
    food_db, valkey_db, media_stack, http_mock, caplog
):
    one_place(food_db)
    _, download = mock_commons(http_mock, imageinfo_with(LicenseShortName=None))
    caplog.set_level(logging.INFO)

    result = run_sync(food_db, media_stack, valkey_db)

    assert (result["skipped"], result["failed"], download.call_count) == (1, 0, 0)
    assert photos(food_db) == []
    assert "reason=license_missing" in caplog.text


@pytest.mark.parametrize("missing", ["Artist", "LicenseUrl"])
def test_c2_a_photo_with_an_incomplete_credit_is_skipped(
    food_db, valkey_db, media_stack, http_mock, missing
):
    one_place(food_db)
    mock_commons(http_mock, imageinfo_with(**{missing: None}))

    result = run_sync(food_db, media_stack, valkey_db)

    assert (result["skipped"], photos(food_db)) == (1, [])


def test_c3_an_artist_in_html_is_stored_as_plain_text(food_db, valkey_db, media_stack, http_mock):
    one_place(food_db)
    artist = (
        '<style>.u{color:red}</style><a href="//commons.wikimedia.org/wiki/User:J" title="J > K">'
        "Jahan &amp; Karim</a>\n<span>(Dhaka)</span>"
    )
    mock_commons(http_mock, imageinfo_with(Artist=artist))

    run_sync(food_db, media_stack, valkey_db)

    assert [row["author"] for row in photos(food_db)] == ["Jahan & Karim (Dhaka)"]
