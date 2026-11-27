"""food_photo_sync against the migrated schema. Only Wikimedia (HTTP) is substituted."""

import httpx
import pytest
from psycopg.types.json import Jsonb

from food_photo_sync.sync_photos import sync_photos


def commons(request: httpx.Request) -> httpx.Response:
    if request.url.host == "upload.wikimedia.org":
        return httpx.Response(200, content=b"jpeg-bytes")
    info = {
        "url": "https://upload.wikimedia.org/x/Example.jpg",
        "descriptionurl": "https://commons.wikimedia.org/wiki/File:Example.jpg",
        "width": 800,
        "height": 600,
        "mime": "image/jpeg",
        "extmetadata": {"LicenseShortName": {"value": "CC BY-SA 4.0"}},
    }
    page = {"title": "File:Example.jpg", "imageinfo": [info]}
    return httpx.Response(200, json={"query": {"pages": {"1": page}}})


@pytest.fixture
def fake_commons(monkeypatch):
    real_client = httpx.Client
    monkeypatch.setattr(
        httpx, "Client", lambda **kw: real_client(transport=httpx.MockTransport(commons), **kw)
    )
    monkeypatch.setenv("S3_ACCESS_KEY", "")  # no object store: rows are written, uploads skipped


def test_two_places_sharing_a_commons_file_each_get_a_photo(food_db, fake_commons):
    food_db.migrate()
    food_db.seed_geo()
    tags = Jsonb({"wikimedia_commons": "File:Example.jpg"})
    a = food_db.insert_place(tags=tags)
    b = food_db.insert_place(tags=tags)

    sync_photos()
    sync_photos()  # idempotent

    rows = food_db.conn.execute("SELECT place_id::text AS id FROM place_photos").fetchall()
    assert sorted(r["id"] for r in rows) == sorted([a, b])


def test_sync_leaves_the_derived_key_array_to_the_database(food_db, fake_commons):
    food_db.migrate()
    food_db.seed_geo()
    place = food_db.insert_place(tags=Jsonb({"wikimedia_commons": "File:Example.jpg"}))
    older = food_db.insert_photo(place, "CC BY 4.0", "1" * 64)

    sync_photos()

    keys = food_db.conn.execute("SELECT wikimedia_s3_keys AS keys FROM places").fetchone()["keys"]
    assert len(keys) == 2
    assert older in keys


def test_a_failed_wikimedia_call_is_logged_and_counted(food_db, fake_commons, monkeypatch, caplog):
    def broken(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    monkeypatch.setitem(globals(), "commons", broken)
    food_db.migrate()
    food_db.seed_geo()
    food_db.insert_place(tags=Jsonb({"wikimedia_commons": "File:Example.jpg"}))
    food_db.insert_place(tags=Jsonb({"wikidata": "Q1"}))

    result = sync_photos()

    assert result["skipped"] == 2
    assert result["errors"] == 2
    assert len([r for r in caplog.records if r.levelname == "WARNING" and r.exc_info]) == 2
