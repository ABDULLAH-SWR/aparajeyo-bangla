"""Warms the API's cache by requesting the pins it serves: the featured set and every district.

The API builds and stores each response itself, so a warmed entry is identical to a computed one.
`food-cache-warm` reads FOOD_API_BASE_URL and GEO_CODES_PATH.
"""

from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor

import httpx

from food_shared.config import load_env_files, load_geo_codes, require

PINS_PATH = "/api/v1/pins"
CONCURRENCY = 4


def warm(api_base_url: str, district_ids: list[str]) -> dict:
    """Every request is attempted; a failed one then raises."""
    queries = [{"overlay": "food"}] + [
        {"overlay": "food", "district_id": district_id} for district_id in district_ids
    ]
    with httpx.Client(base_url=api_base_url, timeout=30.0) as client:

        def request(query: dict) -> None:
            client.get(PINS_PATH, params=query).raise_for_status()

        with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
            list(pool.map(request, queries))
    return {"status": "warmed", "districts_warmed": len(district_ids)}


def main() -> None:
    load_env_files()
    (api_base_url,) = require(os.environ, "FOOD_API_BASE_URL")
    district_ids = [district["id"] for district in load_geo_codes(os.environ)["districts"]]
    print(json.dumps(warm(api_base_url, district_ids)))


if __name__ == "__main__":
    main()
