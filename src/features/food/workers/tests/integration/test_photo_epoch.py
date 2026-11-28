"""Slice 2.7: the cache epoch moves only when photo sync changed something (R12)."""

from media import FixedClock, mock_commons, run_sync
from psycopg.types.json import Jsonb

from food_shared.cache import EPOCH_KEY


def test_only_a_run_that_added_a_photo_bumps_the_epoch(food_db, valkey_db, media_stack, http_mock):
    food_db.migrate()
    food_db.seed_geo()
    for _ in range(2):  # two new photos in one run still bump once
        food_db.insert_place(tags=Jsonb({"wikimedia_commons": "File:Example kacchi.jpg"}))
    mock_commons(http_mock)
    clock = FixedClock()

    def epoch_after_a_run() -> int:
        run_sync(food_db, media_stack, valkey_db, clock=clock)
        return int(valkey_db.get(EPOCH_KEY) or 0)

    assert epoch_after_a_run() == 1
    assert epoch_after_a_run() == 1  # nothing is due
    clock.advance(days=31)
    assert epoch_after_a_run() == 1  # due again, and unchanged
