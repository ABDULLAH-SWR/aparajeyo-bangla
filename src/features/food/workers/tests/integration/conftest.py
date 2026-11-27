"""One throwaway PostGIS database per test, built from db/migrations (needs DATABASE_URL_OWNER)."""

from __future__ import annotations

import os
import uuid
from urllib.parse import urlsplit, urlunsplit

import psycopg
import pytest
from psycopg.rows import dict_row

from shared.db import FOOD_ROOT

MIGRATIONS = sorted((FOOD_ROOT / "db" / "migrations").glob("*.sql"))

DHAKA, BOGURA = "BD3026", "BD5010"
DHANMONDI, BOGURA_SADAR = "BD30260014", "BD50100020"


def _square(lng: float, lat: float) -> str:
    ring = [(lng, lat), (lng + 0.2, lat), (lng + 0.2, lat + 0.2), (lng, lat + 0.2), (lng, lat)]
    return "MULTIPOLYGON(((" + ",".join(f"{x} {y}" for x, y in ring) + ")))"


class FoodDb:
    def __init__(self, url: str):
        self.url = url
        self.conn = psycopg.connect(url, row_factory=dict_row, autocommit=True)

    def migrate(self, up_to: str = "9999", after: str = "0000") -> None:
        """Runs the `up` section of every migration with after < version <= up_to."""
        for path in MIGRATIONS:
            if after < path.name[:4] <= up_to:
                self.conn.execute(path.read_text(encoding="utf-8").split("-- migrate:down")[0])

    def seed_geo(self) -> None:
        for code, geom in ((DHAKA, _square(90.3, 23.7)), (BOGURA, _square(89.3, 24.8))):
            self.conn.execute(
                "INSERT INTO geo_districts (id, name_en, name_bn, geom)"
                " VALUES (%s, %s, '', ST_GeomFromText(%s, 4326))",
                (code, code, geom),
            )
        for code, district, geom in (
            (DHANMONDI, DHAKA, _square(90.3, 23.7)),
            (BOGURA_SADAR, BOGURA, _square(89.3, 24.8)),
        ):
            self.conn.execute(
                "INSERT INTO geo_upazilas (id, district_id, name_en, name_bn, geom)"
                " VALUES (%s, %s, %s, '', ST_GeomFromText(%s, 4326))",
                (code, district, code, geom),
            )

    def insert_place(self, **overrides) -> str:
        row = {
            "overlay_type": "food",
            "source": "osm",
            "source_id": f"node/{uuid.uuid4()}",
            "district_id": DHAKA,
            "geom": "SRID=4326;POINT(90.4 23.8)",
            "name_en": "Test Kitchen",
            "name_norm": "test kitchen",
            "category": "restaurant",
            "cuisines": ["bangladeshi"],
            "source_license": "ODbL-1.0",
        } | overrides
        return self._insert("places", row, returning="id::text")["id"]

    def insert_photo(self, place_id: str, license: str, sha256: str) -> str:
        key = f"photos/food/{place_id}/{sha256}.jpg"
        self._insert(
            "place_photos",
            {
                "place_id": place_id,
                "s3_key": key,
                "sha256": sha256,
                "source": "wikimedia",
                "author": "Example Author",
                "license": license,
                "license_url": "https://creativecommons.org/",
                "source_page_url": "https://commons.wikimedia.org/wiki/File:Example.jpg",
                "width": 800,
                "height": 600,
            },
        )
        return key

    def _insert(self, table: str, row: dict, returning: str = "1") -> dict:
        columns = ", ".join(row)
        values = ", ".join(["%s"] * len(row))
        return self.conn.execute(
            f"INSERT INTO {table} ({columns}) VALUES ({values}) RETURNING {returning}",
            list(row.values()),
        ).fetchone()


@pytest.fixture
def food_db(monkeypatch):
    owner_url = os.environ.get("DATABASE_URL_OWNER")
    if not owner_url:
        pytest.skip("DATABASE_URL_OWNER is not set")
    name = f"food_pytest_{uuid.uuid4().hex[:12]}"
    parts = urlsplit(owner_url)
    url = urlunsplit(parts._replace(path=f"/{name}"))
    with psycopg.connect(owner_url, autocommit=True) as admin:
        admin.execute(f"CREATE DATABASE {name}")
        db = FoodDb(url)
        monkeypatch.setenv("DATABASE_URL", url)
        try:
            yield db
        finally:
            db.conn.close()
            admin.execute(f"DROP DATABASE IF EXISTS {name} WITH (FORCE)")
