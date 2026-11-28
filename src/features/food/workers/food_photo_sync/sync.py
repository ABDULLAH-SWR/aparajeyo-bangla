"""Wikimedia Commons -> Garage photo mirroring (Guide §8.1, Rule R4)."""

from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from datetime import timedelta
from typing import Any
from urllib.parse import unquote

import psycopg
from psycopg.rows import dict_row
from valkey import Valkey

from food_photo_sync.commons import CommonsClient, HttpCommonsClient
from food_photo_sync.license import Credit, credit_from_extmetadata
from food_photo_sync.rejected import PhotoRejected
from food_photo_sync.s3_store import GarageS3Store, S3Store
from food_shared.cache import bump_epoch
from food_shared.clock import Clock, SystemClock
from food_shared.config import load_env_files, load_photo_sync_config
from food_shared.db import get_pg_connection

EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
RESYNC_AFTER = timedelta(days=30)

log = logging.getLogger(__name__)


def _tagged_file(tags: dict[str, Any]) -> str | None:
    """The `wikimedia_commons` tag, unless it names a category."""
    value = str(tags.get("wikimedia_commons") or "").strip()
    if not value or value.startswith("Category:"):
        return None
    return value if value.startswith("File:") else f"File:{value}"


def _linked_file(tags: dict[str, Any]) -> str | None:
    """The `image` tag, when it is the URL of a Commons file page."""
    url = str(tags.get("image") or "")
    if "commons.wikimedia.org/wiki/" not in url:
        return None
    path = url.split("commons.wikimedia.org/wiki/", 1)[1]
    title = unquote(path.split("#", 1)[0].split("?", 1)[0])
    return title if title.startswith("File:") else None


def _candidates(tags: dict[str, Any], commons: CommonsClient) -> list[tuple[int, str]]:
    """(sort_order, title) of each distinct file the tags point at. The lower order wins."""
    qid = str(tags.get("wikidata") or "").strip()
    titles = (
        _tagged_file(tags),
        _linked_file(tags),
        commons.wikidata_image(qid) if qid else None,
    )
    distinct: dict[str, int] = {}
    for sort_order, title in enumerate(titles):
        if title:
            distinct.setdefault(title.replace("_", " "), sort_order)
    return [(sort_order, title) for title, sort_order in distinct.items()]


@dataclass(frozen=True)
class _StoredPhoto:
    """A photo whose object is already in the store."""

    s3_key: str
    sha256: str
    commons_title: str
    credit: Credit
    width: int
    height: int
    sort_order: int


def _mirror(
    place_id: str, sort_order: int, title: str, s3: S3Store, commons: CommonsClient
) -> _StoredPhoto:
    info = commons.imageinfo(title)
    if info is None:
        raise PhotoRejected("file_not_found")
    credit = credit_from_extmetadata(info.extmetadata, info.source_page_url)
    image = commons.download(info.thumb_url)
    if image.mime not in EXTENSIONS:
        raise PhotoRejected("unsupported_type")
    sha256 = hashlib.sha256(image.body).hexdigest()
    s3_key = f"photos/food/{place_id}/{sha256}.{EXTENSIONS[image.mime]}"
    s3.put(s3_key, image.body, image.mime)
    return _StoredPhoto(
        s3_key, sha256, info.title, credit, info.thumb_width, info.thumb_height, sort_order
    )


def _due_places(conn: psycopg.Connection[Any], clock: Clock, limit: int) -> list[dict[str, Any]]:
    """Places never synced, or not for 30 days: the longest waiting first."""
    with conn.transaction(), conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id::text AS id, tags
            FROM places
            WHERE overlay_type = 'food' AND is_active AND NOT is_hidden
              AND (tags ? 'wikimedia_commons' OR tags ? 'wikidata'
                   OR (tags->>'image') LIKE '%%commons.wikimedia.org%%')
              AND (photos_synced_at IS NULL OR photos_synced_at < %s)
            ORDER BY photos_synced_at NULLS FIRST, id
            LIMIT %s
            """,
            (clock.now() - RESYNC_AFTER, limit),
        )
        return cur.fetchall()


def _insert(conn: psycopg.Connection[Any], place_id: str, photo: _StoredPhoto) -> int:
    """Returns the number of rows inserted: 0 when the place already has these bytes."""
    return conn.execute(
        """
        INSERT INTO place_photos (
          place_id, s3_key, sha256, source, commons_title,
          author, license, license_url, source_page_url, width, height, sort_order
        ) VALUES (%s::uuid, %s, %s, 'wikimedia', %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (place_id, sha256) DO NOTHING
        """,
        (
            place_id,
            photo.s3_key,
            photo.sha256,
            photo.commons_title,
            photo.credit.author,
            photo.credit.license,
            photo.credit.license_url,
            photo.credit.source_page_url,
            photo.width,
            photo.height,
            photo.sort_order,
        ),
    ).rowcount


def sync_photos(
    conn: psycopg.Connection[Any],
    s3: S3Store,
    commons: CommonsClient,
    clock: Clock,
    limit: int,
    *,
    valkey: Valkey,
) -> dict[str, int]:
    """Mirrors the photos of up to `limit` due places. `conn` must not be in a transaction."""
    places = _due_places(conn, clock, limit)
    rows_inserted = skipped = failed = 0
    try:
        for place in places:
            place_id = place["id"]
            photos: list[_StoredPhoto] = []
            try:
                for sort_order, title in _candidates(place["tags"], commons):
                    try:
                        photos.append(_mirror(place_id, sort_order, title, s3, commons))
                    except PhotoRejected as rejected:
                        log.info("photo skipped for place %s reason=%s", place_id, rejected.reason)
                        skipped += 1
            except Exception:
                # No watermark: the place is retried on the next run.
                log.warning("photo sync failed for place %s", place_id, exc_info=True)
                failed += 1
                continue

            # The transaction opens only now: nothing is written unless every upload succeeded.
            with conn.transaction():
                for photo in photos:
                    rows_inserted += _insert(conn, place_id, photo)
                conn.execute(
                    "UPDATE places SET photos_synced_at = %s WHERE id = %s::uuid",
                    (clock.now(), place_id),
                )
    finally:
        # Also when the run dies part way: the places already committed must reach the API.
        if rows_inserted:
            bump_epoch(valkey, "food_photo_sync")

    return {
        "places": len(places),
        "rows_inserted": rows_inserted,
        "skipped": skipped,
        "failed": failed,
    }


def main() -> None:
    load_env_files()
    config = load_photo_sync_config(os.environ)
    commons = HttpCommonsClient(user_agent=config.user_agent, max_bytes=config.max_bytes)
    s3 = GarageS3Store(config.s3)
    with get_pg_connection(config.database_url) as conn, Valkey.from_url(config.valkey_url) as vk:
        print(json.dumps(sync_photos(conn, s3, commons, SystemClock(), 100, valkey=vk)))


if __name__ == "__main__":
    main()
