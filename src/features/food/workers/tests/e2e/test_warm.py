"""Slice 0D.8: the warmer against a running stack.

Needs FOOD_API_BASE_URL (a running Food API with an import) and the VALKEY_URL that API uses.
"""

import os
import time

import httpx
import pytest
from valkey import from_url

from food_cache_warm.warm import warm
from food_shared.cache import bump_epoch

# The API memoizes the cache epoch for up to 5 s.
EPOCH_MEMO_SECONDS = 5.5


@pytest.mark.e2e
def test_a_warmed_district_is_served_from_the_cache():
    api_base_url, valkey_url = os.environ.get("FOOD_API_BASE_URL"), os.environ.get("VALKEY_URL")
    if not (api_base_url and valkey_url):
        pytest.skip("FOOD_API_BASE_URL and VALKEY_URL are not set")
    with from_url(valkey_url) as valkey:
        bump_epoch(valkey, "test: make every cached response stale")
    time.sleep(EPOCH_MEMO_SECONDS)

    warm(api_base_url, ["BD3026"])

    response = httpx.get(
        f"{api_base_url}/api/v1/pins", params={"overlay": "food", "district_id": "BD3026"}
    )
    assert (response.status_code, response.headers["X-Cache"]) == (200, "HIT")
