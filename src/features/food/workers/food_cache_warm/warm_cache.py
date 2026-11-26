"""Pre-warms Valkey caches for featured national view and all 64 districts (Guide §4, §8)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import sys
from pathlib import Path

import valkey

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared.db import get_pg_connection, get_valkey_url, today_bst_date  # noqa: E402


def sign_imgproxy_url(s3_key: str, width: int) -> str | None:
    base_url = os.environ.get("IMGPROXY_BASE_URL", "").strip().rstrip("/")
    key_hex = os.environ.get("IMGPROXY_KEY", "").strip()
    salt_hex = os.environ.get("IMGPROXY_SALT", "").strip()
    bucket = os.environ.get("S3_BUCKET", "aparajeyo").strip() or "aparajeyo"
    if not (base_url and key_hex and salt_hex):
        return None
    try:
        key = bytes.fromhex(key_hex)
        salt = bytes.fromhex(salt_hex)
        path = f"/rs:fit:{width}:0/plain/s3://{bucket}/{s3_key}".encode("utf-8")
        sig = base64.urlsafe_b64encode(hmac.new(key, salt + path, hashlib.sha256).digest()).rstrip(b"=").decode("ascii")
        return f"{base_url}/{sig}{path.decode('utf-8')}"
    except Exception:
        return None


def build_pins_payload(rows: list[dict], district_id: str | None, truncated: bool, version: str) -> dict:
    features = []
    for r in rows:
        s3_keys = r.get("wikimedia_s3_keys") or []
        thumb_url = sign_imgproxy_url(s3_keys[0], 320) if s3_keys else None
        features.append({
            "type": "Feature",
            "id": r["id"],
            "geometry": {"type": "Point", "coordinates": [float(r["eff_lng"]), float(r["eff_lat"])]},
            "properties": {
                "id": r["id"],
                "pin_type": "food_poi",
                "district_id": r["district_id"],
                "upazila_id": r["upazila_id"],
                "name_en": r["eff_name_en"],
                "name_bn": r["eff_name_bn"],
                "category": r["category"],
                "has_video": bool(r["youtube_video_ids"]),
                "thumbnail_url": thumb_url,
                "source": r["source"],
            },
        })
    return {
        "type": "FeatureCollection",
        "metadata": {
            "overlay": "food",
            "district_id": district_id,
            "total_count": len(features),
            "truncated": truncated,
            "dataset_version": version,
            "attribution_text": "© OpenStreetMap contributors, Overture Maps Foundation",
        },
        "features": features,
    }


def warm_all() -> dict:
    conn = get_pg_connection()
    vk = valkey.from_url(get_valkey_url(), decode_responses=True)

    with conn.cursor() as cur:
        cur.execute("SELECT dataset_version FROM sync_runs ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        version = row["dataset_version"] if row else today_bst_date()

        # 1. Warm national featured set (cap 2000)
        cur.execute(
            """
            SELECT
              id::text AS id, district_id, upazila_id, category, source, wikimedia_s3_keys, youtube_video_ids,
              ST_X(COALESCE(geom_override, geom)) AS eff_lng,
              ST_Y(COALESCE(geom_override, geom)) AS eff_lat,
              COALESCE(name_en_override, name_en) AS eff_name_en,
              COALESCE(name_bn_override, name_bn) AS eff_name_bn
            FROM places
            WHERE overlay_type = 'food' AND is_active AND NOT is_hidden
            ORDER BY (cardinality(youtube_video_ids) > 0) DESC, (jsonb_array_length(wikimedia_s3_keys) > 0) DESC,
                     is_featured DESC, (name_bn IS NOT NULL AND name_en IS NOT NULL) DESC, updated_at DESC, id ASC
            LIMIT 2001
            """
        )
        nat_rows = cur.fetchall()
        nat_payload = build_pins_payload(nat_rows[:2000], None, len(nat_rows) > 2000, version)
        nat_str = json.dumps(nat_payload, ensure_ascii=False)
        nat_etag = f'W/"{hashlib.sha256(nat_str.encode("utf-8")).hexdigest()[:20]}"'
        vk.set("food:dataset_version", version)
        vk.set(
            f"food:pins:v{version}:featured:all",
            json.dumps({"etag": nat_etag, "body": nat_str}, ensure_ascii=False),
            ex=86400,
        )

        # 2. Warm all 64 districts
        cur.execute("SELECT id FROM geo_districts ORDER BY id")
        dist_ids = [d["id"] for d in cur.fetchall()]

        warmed = 0
        for did in dist_ids:
            cur.execute(
                """
                SELECT
                  id::text AS id, district_id, upazila_id, category, source, wikimedia_s3_keys, youtube_video_ids,
                  ST_X(COALESCE(geom_override, geom)) AS eff_lng,
                  ST_Y(COALESCE(geom_override, geom)) AS eff_lat,
                  COALESCE(name_en_override, name_en) AS eff_name_en,
                  COALESCE(name_bn_override, name_bn) AS eff_name_bn
                FROM places
                WHERE overlay_type = 'food' AND is_active AND NOT is_hidden AND district_id = %s
                ORDER BY (cardinality(youtube_video_ids) > 0) DESC, (jsonb_array_length(wikimedia_s3_keys) > 0) DESC,
                         is_featured DESC, name_bn IS NOT NULL DESC, id ASC
                LIMIT 5001
                """,
                (did,),
            )
            d_rows = cur.fetchall()
            d_payload = build_pins_payload(d_rows[:5000], did, len(d_rows) > 5000, version)
            d_str = json.dumps(d_payload, ensure_ascii=False)
            d_etag = f'W/"{hashlib.sha256(d_str.encode("utf-8")).hexdigest()[:20]}"'
            vk.set(
                f"food:pins:v{version}:{did}:all",
                json.dumps({"etag": d_etag, "body": d_str}, ensure_ascii=False),
                ex=86400,
            )
            warmed += 1

    conn.close()
    vk.close()
    return {"status": "warmed", "dataset_version": version, "districts_warmed": warmed}


if __name__ == "__main__":
    print(json.dumps(warm_all()))
