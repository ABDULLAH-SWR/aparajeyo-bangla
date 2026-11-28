"""Slice 2.5: downloads use the 2,048 px thumbnail and are size-capped."""

import logging
from collections.abc import Iterator

import httpx
from media import THUMB_URL, mock_commons, run_sync, stored_objects
from psycopg.types.json import Jsonb

MIB = 1024 * 1024
CAP = 10 * MIB


def one_place(db) -> str:
    db.migrate()
    db.seed_geo()
    return db.insert_place(tags=Jsonb({"wikimedia_commons": "File:Example kacchi.jpg"}))


def test_c1_the_2048_px_thumbnail_is_requested_and_downloaded(
    food_db, valkey_db, media_stack, http_mock
):
    one_place(food_db)
    api, download = mock_commons(http_mock)

    run_sync(food_db, media_stack, valkey_db)

    assert api.calls.last.request.url.params["iiurlwidth"] == "2048"
    # Strict mode: a request for the original `url` would have failed the sync.
    assert str(download.calls.last.request.url) == THUMB_URL


def test_c2_an_oversize_download_is_aborted_and_writes_nothing(
    food_db, valkey_db, media_stack, http_mock, caplog
):
    place = one_place(food_db)
    _, download = mock_commons(http_mock)
    sent: list[int] = []

    def twelve_mib() -> Iterator[bytes]:
        for _ in range(12):
            sent.append(MIB)
            yield b"\0" * MIB

    download.mock(
        side_effect=lambda request: httpx.Response(
            200, headers={"Content-Type": "image/jpeg"}, content=twelve_mib()
        )
    )
    caplog.set_level(logging.INFO)

    result = run_sync(food_db, media_stack, valkey_db, max_bytes=CAP)

    assert (result["skipped"], result["failed"], result["rows_inserted"]) == (1, 0, 0)
    assert len(sent) == 11  # stopped at the first chunk over the cap
    assert "reason=too_large" in caplog.text
    assert stored_objects(media_stack, f"photos/food/{place}/") == {}


def test_c3_a_download_that_is_not_a_photo_type_is_skipped(
    food_db, valkey_db, media_stack, http_mock, caplog
):
    one_place(food_db)
    _, download = mock_commons(http_mock)
    download.respond(content=b"<svg/>", headers={"Content-Type": "image/svg+xml"})
    caplog.set_level(logging.INFO)

    result = run_sync(food_db, media_stack, valkey_db)

    assert (result["skipped"], result["failed"], result["rows_inserted"]) == (1, 0, 0)
    assert "reason=unsupported_type" in caplog.text
