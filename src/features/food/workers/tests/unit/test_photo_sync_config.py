"""Slice 2.2: photo sync refuses to start without its object store."""

import pytest

from food_shared.config import ConfigError, load_photo_sync_config

ENV = {
    "DATABASE_URL": "postgresql://worker@db/food",
    "VALKEY_URL": "redis://cache:6379/0",
    "WIKIMEDIA_USER_AGENT": "FoodWorkerTests/1.0 (https://example.test)",
    "S3_ENDPOINT": "http://garage:3900",
    "S3_REGION": "region-1",
    "S3_BUCKET": "food-media",
    "S3_ACCESS_KEY": "GKexample",
    "S3_SECRET_KEY": "example",
}


@pytest.mark.parametrize(
    "name", [name for name in ENV if name.startswith("S3_")] + ["WIKIMEDIA_USER_AGENT"]
)
def test_a_missing_setting_is_a_config_error_naming_it(name):
    with pytest.raises(ConfigError, match=name):
        load_photo_sync_config({key: value for key, value in ENV.items() if key != name})
