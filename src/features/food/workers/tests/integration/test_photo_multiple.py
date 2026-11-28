"""Slice 2.6: every allowed candidate of a place is kept, in priority order."""

from media import mock_commons_files, mock_wikidata_image, run_sync
from psycopg.types.json import Jsonb

from food_photo_sync.commons import COMMONS_API


def photos(db) -> list[tuple[str, int]]:
    rows = db.conn.execute(
        "SELECT commons_title, sort_order FROM place_photos ORDER BY sort_order"
    ).fetchall()
    return [(row["commons_title"], row["sort_order"]) for row in rows]


def test_c1_two_candidates_become_two_ordered_photos(food_db, valkey_db, media_stack, http_mock):
    food_db.migrate()
    food_db.seed_geo()
    place = food_db.insert_place(
        tags=Jsonb(
            {
                "image": "https://commons.wikimedia.org/wiki/File:Second%20photo.jpg",
                "wikimedia_commons": "File:First photo.jpg",
            }
        )
    )
    sha = mock_commons_files(http_mock, "File:First photo.jpg", "File:Second photo.jpg")

    result = run_sync(food_db, media_stack, valkey_db)

    assert result["rows_inserted"] == 2
    assert photos(food_db) == [("File:First photo.jpg", 0), ("File:Second photo.jpg", 1)]
    keys = food_db.conn.execute("SELECT wikimedia_s3_keys AS keys FROM places").fetchone()["keys"]
    assert keys == [
        f"photos/food/{place}/{sha['File:First photo.jpg']}.jpg",
        f"photos/food/{place}/{sha['File:Second photo.jpg']}.jpg",
    ]


def test_c2_the_wikidata_image_comes_last_and_a_repeated_file_is_taken_once(
    food_db, valkey_db, media_stack, http_mock
):
    food_db.migrate()
    food_db.seed_geo()
    food_db.insert_place(
        tags=Jsonb(
            {
                "wikimedia_commons": "File:First photo.jpg",
                "image": "https://commons.wikimedia.org/wiki/File:First_photo.jpg",
                "wikidata": "Q42",
            }
        )
    )
    mock_wikidata_image(http_mock, "Q42", "Third photo.jpg")
    mock_commons_files(http_mock, "File:First photo.jpg", "File:Third photo.jpg")

    run_sync(food_db, media_stack, valkey_db)

    assert photos(food_db) == [("File:First photo.jpg", 0), ("File:Third photo.jpg", 2)]


def test_a_rejected_candidate_does_not_cost_the_place_its_other_photos(
    food_db, valkey_db, media_stack, http_mock
):
    food_db.migrate()
    food_db.seed_geo()
    food_db.insert_place(tags=Jsonb({"wikimedia_commons": "File:Gone.jpg", "wikidata": "Q42"}))
    mock_wikidata_image(http_mock, "Q42", "Third photo.jpg")
    gone = {"query": {"pages": [{"title": "File:Gone.jpg", "missing": True}]}}
    # Routes match in the order they were added: this one before the catch-all below.
    http_mock.get(url__startswith=COMMONS_API, params={"titles": "File:Gone.jpg"}).respond(
        json=gone
    )
    mock_commons_files(http_mock, "File:Third photo.jpg")

    result = run_sync(food_db, media_stack, valkey_db)

    assert (result["rows_inserted"], result["skipped"], result["failed"]) == (1, 1, 0)
    assert photos(food_db) == [("File:Third photo.jpg", 2)]
