import psycopg
import pytest
from psycopg.rows import dict_row

from food_photo_sync.purge import purge_nonfree


class FakeS3:
    """Stands in for Garage."""

    def __init__(self, fail: bool = False):
        self.deleted: list[str] = []
        self.fail = fail

    def put(self, key: str, body: bytes, content_type: str) -> None:
        raise AssertionError("the purge writes no objects")

    def delete(self, key: str) -> None:
        if self.fail:
            raise ConnectionError("garage is down")
        self.deleted.append(key)


def photo_licenses(db) -> list[str]:
    return [r["license"] for r in db.conn.execute("SELECT license FROM place_photos ORDER BY 1")]


def test_purge_removes_non_free_rows_and_objects_so_0002_can_apply(food_db):
    food_db.migrate(up_to="0001")  # purge runs before 0002, against the legacy schema
    food_db.seed_geo()
    place = food_db.insert_place()
    food_db.insert_photo(place, "CC BY-SA 4.0", "1" * 64)
    nc = food_db.insert_photo(place, "CC BY-NC 4.0", "2" * 64)
    nd = food_db.insert_photo(place, "CC BY-ND 4.0", "3" * 64)
    s3 = FakeS3()

    with psycopg.connect(food_db.url, row_factory=dict_row) as conn:
        result = purge_nonfree(conn, s3)

    assert result == {"rows_deleted": 2}
    assert sorted(s3.deleted) == sorted([nc, nd])
    assert photo_licenses(food_db) == ["CC BY-SA 4.0"]
    food_db.migrate(after="0001", up_to="0002")


def test_purge_keeps_the_row_when_its_object_cannot_be_deleted(food_db):
    food_db.migrate(up_to="0001")
    food_db.seed_geo()
    food_db.insert_photo(food_db.insert_place(), "CC BY-NC 4.0", "2" * 64)

    with (
        psycopg.connect(food_db.url, row_factory=dict_row) as conn,
        pytest.raises(ConnectionError),
    ):
        purge_nonfree(conn, FakeS3(fail=True))

    assert photo_licenses(food_db) == ["CC BY-NC 4.0"]
