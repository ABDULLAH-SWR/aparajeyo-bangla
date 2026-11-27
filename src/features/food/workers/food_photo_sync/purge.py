"""Deletes non-allowlisted photos and their Garage objects (Guide §6.4 Slice 0B.2).

Run before migration 0002, which refuses to apply while any such row exists.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from food_photo_sync.sync_photos import get_s3_client  # noqa: E402
from shared.db import get_pg_connection  # noqa: E402

# Must stay identical to the place_photos_license_chk pattern in 0002_place_photos_per_place.sql.
DB_LICENSE_PATTERN = (
    r"^(CC0( 1\.0)?|Public domain|PD(-[A-Za-z0-9.-]+)?"
    r"|CC BY(-SA)? (1\.0|2\.0|2\.5|3\.0|4\.0)( [a-z]{2,4})?)$"
)


def purge_nonfree(conn, s3_client, bucket: str) -> dict:
    rows = conn.execute(
        "SELECT id, s3_key FROM place_photos WHERE license !~ %s", (DB_LICENSE_PATTERN,)
    ).fetchall()
    for row in rows:
        # Object first: if this fails, the row survives and a rerun can find the object again.
        s3_client.delete_object(Bucket=bucket, Key=row["s3_key"])
        conn.execute("DELETE FROM place_photos WHERE id = %s", (row["id"],))
        conn.commit()
    return {"rows_deleted": len(rows)}


def main() -> None:
    s3_client, bucket = get_s3_client()
    if s3_client is None:
        raise SystemExit("S3_ACCESS_KEY and S3_SECRET_KEY are required to delete mirrored files")
    with get_pg_connection() as conn:
        print(json.dumps(purge_nonfree(conn, s3_client, bucket)))


if __name__ == "__main__":
    main()
