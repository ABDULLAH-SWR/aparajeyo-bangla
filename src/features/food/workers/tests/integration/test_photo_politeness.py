"""Guide §8.1 rules towards Wikimedia: identified, at most one request a second, maxlag honoured."""

import time

import httpx
from media import IMAGEINFO, JPEG, THUMB_URL, USER_AGENT, mock_commons, one_place, run_sync

from food_photo_sync.commons import COMMONS_API

MAXLAG = {"error": {"code": "maxlag", "info": "Waiting for a database server: 6 seconds lagged."}}


def test_a_lagged_answer_is_retried_after_the_requested_pause(
    food_db, valkey_db, media_stack, http_mock
):
    one_place(food_db)
    api = http_mock.get(url__startswith=COMMONS_API).mock(
        side_effect=[
            httpx.Response(200, json=MAXLAG, headers={"Retry-After": "1"}),
            httpx.Response(200, json=IMAGEINFO),
        ]
    )
    http_mock.get(THUMB_URL).respond(content=JPEG, headers={"Content-Type": "image/jpeg"})
    started = time.monotonic()

    result = run_sync(food_db, media_stack, valkey_db)

    assert (result["rows_inserted"], api.call_count) == (1, 2)
    assert time.monotonic() - started >= 1
    assert {call.request.headers["User-Agent"] for call in http_mock.calls} == {USER_AGENT}


def test_requests_are_spaced_by_the_minimum_interval(food_db, valkey_db, media_stack, http_mock):
    one_place(food_db)
    mock_commons(http_mock)  # one API request and one download
    started = time.monotonic()

    run_sync(food_db, media_stack, valkey_db, min_interval=1.0)

    assert time.monotonic() - started >= 1.0
