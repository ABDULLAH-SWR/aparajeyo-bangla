"""Slice 2.6 through the API: the pin shows the first photo, the detail lists them all."""

import httpx
import respx
from media import mock_commons_files, run_sync
from psycopg.types.json import Jsonb

from food_shared.config import FOOD_ROOT

API_GEO = FOOD_ROOT / "db" / "seeds" / "test_geo.sql"


def test_the_pin_uses_the_first_photo_and_the_detail_has_both(
    food_db, valkey_db, media_stack, start_api
):
    food_db.migrate()
    food_db.conn.execute(API_GEO.read_text(encoding="utf-8"))
    food_db.conn.execute(  # the pins carry the version of the last successful import
        "INSERT INTO sync_runs (id, source, dataset_version, imported_count, status)"
        " VALUES (1, 'osm', '2026-11-28', 1, 'succeeded')"
    )
    place = food_db.insert_place(
        tags=Jsonb(
            {
                "wikimedia_commons": "File:First photo.jpg",
                "image": "https://commons.wikimedia.org/wiki/File:Second_photo.jpg",
            }
        )
    )
    with respx.mock(assert_all_mocked=True) as commons:
        sha = mock_commons_files(commons, "File:First photo.jpg", "File:Second photo.jpg")
        run_sync(food_db, media_stack, valkey_db)
    api = start_api()

    pins = httpx.get(
        f"{api}/api/v1/pins", params={"overlay": "food", "district_id": "BD3026"}
    ).raise_for_status()
    detail = httpx.get(f"{api}/api/v1/pins/food/{place}").raise_for_status().json()

    thumbnail = pins.json()["features"][0]["properties"]["thumbnail_url"]
    assert thumbnail == detail["photos"][0]["thumb_url"]
    assert thumbnail.endswith(f"/{place}/{sha['File:First photo.jpg']}.jpg")
    assert len(detail["photos"]) == 2
    # §8.3 exit gate: no photo URL in a response is unsigned or points at upload.wikimedia.org.
    urls = [feature["properties"]["thumbnail_url"] for feature in pins.json()["features"]]
    urls += [photo[name] for photo in detail["photos"] for name in ("thumb_url", "url")]
    for url in urls:
        assert url.startswith(f"{media_stack['IMGPROXY_BASE_URL']}/")
        assert "upload.wikimedia.org" not in url
        assert httpx.get(url).status_code == 200  # imgproxy answers 403 to a bad signature
