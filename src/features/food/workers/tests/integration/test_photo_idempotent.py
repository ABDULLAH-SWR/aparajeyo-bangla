"""Slice 2.4: sync is idempotent and ordered by the photos_synced_at watermark."""

from datetime import timedelta

from media import FixedClock, mock_commons, run_sync
from psycopg.types.json import Jsonb

TAGS = Jsonb({"wikimedia_commons": "File:Example kacchi.jpg"})


def one_place(db) -> str:
    db.migrate()
    db.seed_geo()
    return db.insert_place(tags=TAGS)


def test_c1_a_synced_place_is_left_alone_for_30_days(food_db, valkey_db, media_stack, http_mock):
    one_place(food_db)
    api, download = mock_commons(http_mock)
    clock = FixedClock()
    run_sync(food_db, media_stack, valkey_db, clock=clock)
    calls = (api.call_count, download.call_count)

    second = run_sync(food_db, media_stack, valkey_db, clock=clock)

    assert (api.call_count, download.call_count) == calls == (1, 1)
    assert second["rows_inserted"] == 0

    clock.advance(days=31)
    third = run_sync(food_db, media_stack, valkey_db, clock=clock)

    assert (third["places"], api.call_count) == (1, 2)
    assert third["rows_inserted"] == 0  # the same bytes: ON CONFLICT DO NOTHING


def test_c2_the_longest_waiting_place_goes_first(food_db, valkey_db, media_stack, http_mock):
    food_db.migrate()
    food_db.seed_geo()
    clock = FixedClock()
    food_db.insert_place(  # synced 40 days ago, and first by id
        id="00000000-0000-4000-8000-000000000001",
        tags=TAGS,
        photos_synced_at=clock.now() - timedelta(days=40),
    )
    never = food_db.insert_place(id="00000000-0000-4000-8000-000000000002", tags=TAGS)
    mock_commons(http_mock)

    run_sync(food_db, media_stack, valkey_db, clock=clock, limit=1)

    rows = food_db.conn.execute("SELECT place_id::text AS id FROM place_photos").fetchall()
    assert [row["id"] for row in rows] == [never]


def test_c3_a_place_whose_tags_name_no_commons_file_is_stamped(
    food_db, valkey_db, media_stack, http_mock
):
    food_db.migrate()
    food_db.seed_geo()
    food_db.insert_place(tags=Jsonb({"wikimedia_commons": "Category:Restaurants in Dhaka"}))

    first = run_sync(food_db, media_stack, valkey_db)
    second = run_sync(food_db, media_stack, valkey_db)

    assert (first["places"], second["places"]) == (1, 0)
