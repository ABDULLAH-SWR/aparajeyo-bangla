"""Wikimedia Commons -> Garage S3 photo mirroring with license gate (Guide §5.8, Rule R4)."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from pathlib import Path
from urllib.parse import unquote

import boto3
import httpx

from food_photo_sync.license import is_allowed_license
from food_shared.config import load_env_files, require
from food_shared.db import get_pg_connection

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
USER_AGENT = "AparajeyoFoodSync/0.1 (https://aparajeyo.com)"

log = logging.getLogger(__name__)


def extract_commons_title(tags: dict) -> str | None:
    wm = tags.get("wikimedia_commons")
    if isinstance(wm, str) and wm.strip():
        val = wm.strip()
        if val.startswith("File:"):
            return val
        if not val.startswith("Category:"):
            return f"File:{val}"

    img = tags.get("image")
    if isinstance(img, str) and "commons.wikimedia.org/wiki/" in img:
        part = unquote(
            img.split("commons.wikimedia.org/wiki/", 1)[1].split("#", 1)[0].split("?", 1)[0]
        )
        if part.startswith("File:"):
            return part
    return None


def resolve_wikidata_p18(client: httpx.Client, qid: str) -> str | None:
    resp = client.get(
        WIKIDATA_API,
        params={"action": "wbgetclaims", "entity": qid, "property": "P18", "format": "json"},
    )
    resp.raise_for_status()
    claims = resp.json().get("claims", {}).get("P18", [])
    if not claims:
        return None
    filename = claims[0].get("mainsnak", {}).get("datavalue", {}).get("value")
    return f"File:{filename}" if isinstance(filename, str) and filename else None


def strip_html(value: str | None) -> str:
    return re.sub(r"<[^>]+>", "", value or "").strip()


def get_s3_client():
    endpoint = os.environ.get("S3_ENDPOINT", "http://127.0.0.1:3900")
    access_key = os.environ.get("S3_ACCESS_KEY", "")
    secret_key = os.environ.get("S3_SECRET_KEY", "")
    if not access_key or not secret_key:
        return None, None
    bucket = os.environ.get("S3_BUCKET", "aparajeyo")
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="ap-south-1",
    )
    return client, bucket


def fetch_commons_photo(client: httpx.Client, title: str) -> dict | None:
    resp = client.get(
        COMMONS_API,
        params={
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "extmetadata|size|url|mime",
            "format": "json",
        },
    )
    resp.raise_for_status()
    pages = resp.json().get("query", {}).get("pages", {})
    for page in pages.values():
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]
        ext = info.get("extmetadata") or {}
        lic = strip_html(ext.get("LicenseShortName", {}).get("value"))
        if not is_allowed_license(lic, ext.get("NonFree", {}).get("value")):
            return None
        author = strip_html(ext.get("Artist", {}).get("value")) or "Wikimedia Commons contributor"
        lic_url = strip_html(ext.get("LicenseUrl", {}).get("value")) or "https://creativecommons.org/"
        page_url = info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/{title.replace(' ', '_')}"
        raw_url = info.get("url")
        if not raw_url:
            continue
        img_resp = client.get(raw_url)
        img_resp.raise_for_status()
        img_bytes = img_resp.content
        sha256 = hashlib.sha256(img_bytes).hexdigest()
        ext_name = Path(raw_url.split("?")[0]).suffix.lstrip(".").lower() or "jpg"
        return {
            "commons_title": page.get("title") or title,
            "author": author[:200],
            "license": lic[:100],
            "license_url": lic_url,
            "source_page_url": page_url,
            "width": int(info.get("width") or 0),
            "height": int(info.get("height") or 0),
            "sha256": sha256,
            "ext": ext_name,
            "mime": info.get("mime") or "image/jpeg",
            "bytes": img_bytes,
        }
    return None


def sync_photos(database_url: str, limit: int = 100) -> dict:
    conn = get_pg_connection(database_url)
    s3_client, s3_bucket = get_s3_client()

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::text AS id, tags
            FROM places
            WHERE overlay_type = 'food' AND is_active AND NOT is_hidden
              AND (tags ? 'wikimedia_commons' OR tags ? 'wikidata' OR (tags->>'image') LIKE '%%commons.wikimedia.org%%')
            LIMIT %s
            """,
            (limit,),
        )
        rows = cur.fetchall()

    synced = 0
    uploaded_s3 = 0
    skipped = 0
    errors = 0

    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=20.0, follow_redirects=True) as client:
        for row in rows:
            place_id = row["id"]
            tags = row["tags"] if isinstance(row["tags"], dict) else json.loads(row["tags"])
            title = extract_commons_title(tags)
            if not title and isinstance(tags.get("wikidata"), str):
                try:
                    title = resolve_wikidata_p18(client, tags["wikidata"].strip())
                except Exception:
                    log.warning("wikidata P18 lookup failed for place %s", place_id, exc_info=True)
                    errors += 1
                    title = None
            if not title:
                skipped += 1
                continue

            try:
                meta = fetch_commons_photo(client, title)
            except Exception:
                log.warning("commons fetch failed for place %s", place_id, exc_info=True)
                errors += 1
                skipped += 1
                continue

            if not meta or meta["width"] <= 0 or meta["height"] <= 0:
                skipped += 1
                continue

            s3_key = f"photos/food/{place_id}/{meta['sha256']}.{meta['ext']}"
            if s3_client and s3_bucket:
                s3_client.put_object(
                    Bucket=s3_bucket,
                    Key=s3_key,
                    Body=meta["bytes"],
                    ContentType=meta["mime"],
                )
                uploaded_s3 += 1

            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO place_photos (
                      place_id, s3_key, sha256, source, commons_title,
                      author, license, license_url, source_page_url, width, height, sort_order
                    ) VALUES (%s::uuid, %s, %s, 'wikimedia', %s, %s, %s, %s, %s, %s, %s, 0)
                    ON CONFLICT (place_id, sha256) DO UPDATE SET
                      author = EXCLUDED.author,
                      license = EXCLUDED.license,
                      license_url = EXCLUDED.license_url,
                      source_page_url = EXCLUDED.source_page_url
                    """,
                    (
                        place_id,
                        s3_key,
                        meta["sha256"],
                        meta["commons_title"],
                        meta["author"],
                        meta["license"],
                        meta["license_url"],
                        meta["source_page_url"],
                        meta["width"],
                        meta["height"],
                    ),
                )
            synced += 1

    conn.commit()
    conn.close()
    return {
        "checked": len(rows),
        "synced": synced,
        "uploaded_s3": uploaded_s3,
        "skipped": skipped,
        "errors": errors,
    }


def main() -> None:
    load_env_files()
    (database_url,) = require(os.environ, "DATABASE_URL")
    print(json.dumps(sync_photos(database_url)))


if __name__ == "__main__":
    main()
