"""Slice 2.1: the mirrored photo is servable through the API's signed imgproxy URL."""

import httpx
import respx
from media import mock_commons, run_sync
from psycopg.types.json import Jsonb

from food_shared.config import FOOD_ROOT

# The API refuses the empty Bangla names of food_db.seed_geo().
API_GEO = FOOD_ROOT / "db" / "seeds" / "test_geo.sql"


def test_the_detail_thumbnail_is_served_as_webp(food_db, valkey_db, media_stack, start_api):
    food_db.migrate()
    food_db.conn.execute(API_GEO.read_text(encoding="utf-8"))
    place = food_db.insert_place(tags=Jsonb({"wikimedia_commons": "File:Example kacchi.jpg"}))
    with respx.mock(assert_all_mocked=True) as commons:
        mock_commons(commons)
        run_sync(food_db, media_stack, valkey_db)
    api = start_api()

    detail = httpx.get(f"{api}/api/v1/pins/food/{place}").raise_for_status().json()
    image = httpx.get(detail["photos"][0]["thumb_url"], headers={"Accept": "image/webp"})

    assert (image.status_code, image.headers["Content-Type"]) == (200, "image/webp")
