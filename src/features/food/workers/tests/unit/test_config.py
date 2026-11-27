"""Slice 0D.6: worker configuration is explicit."""

import pytest

from food_shared.config import ConfigError, load_worker_config

ENV = {"DATABASE_URL": "postgresql://worker@db/food", "VALKEY_URL": "redis://cache:6379/0"}


def test_c1_a_missing_database_url_is_named():
    with pytest.raises(ConfigError, match="DATABASE_URL"):
        load_worker_config({})


def test_c2_a_geo_codes_file_that_differs_from_the_vendored_checksum_is_refused(tmp_path):
    edited = tmp_path / "geo_codes.json"
    edited.write_text('{"districts": [], "upazilas": []}', encoding="utf-8")

    with pytest.raises(ConfigError, match="GEO_CODES_PATH"):
        load_worker_config(ENV | {"GEO_CODES_PATH": str(edited)})


def test_the_vendored_geo_codes_load_through_a_path_relative_to_the_feature_root():
    config = load_worker_config(ENV | {"GEO_CODES_PATH": "data/geo_codes.v03.json"})

    assert (len(config.geo_codes["districts"]), len(config.geo_codes["upazilas"])) == (64, 507)
