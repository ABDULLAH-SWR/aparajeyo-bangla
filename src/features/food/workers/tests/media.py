"""Shared helpers of the media pipeline tests (seam S5). Only Wikimedia is substituted."""

from __future__ import annotations

import copy
import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import boto3
import httpx
import psycopg
import respx
from valkey import Valkey

from food_photo_sync.commons import COMMONS_API, WIKIDATA_API, HttpCommonsClient
from food_photo_sync.s3_store import GarageS3Store
from food_photo_sync.sync import sync_photos
from food_shared.config import FOOD_ROOT

FIXTURES = Path(__file__).resolve().parent / "fixtures"
IMAGEINFO = json.loads((FIXTURES / "commons" / "imageinfo_kacchi.json").read_text(encoding="utf-8"))
THUMB_URL = IMAGEINFO["query"]["pages"][0]["imageinfo"][0]["thumburl"]
JPEG = (FOOD_ROOT / "testdata" / "media" / "kacchi.jpg").read_bytes()
JPEG_SHA256 = hashlib.sha256(JPEG).hexdigest()
USER_AGENT = "FoodWorkerTests/1.0 (https://example.test)"


class FixedClock:
    def __init__(self, now: datetime = datetime(2026, 11, 27, 20, 0, tzinfo=UTC)):
        self._now = now

    def now(self) -> datetime:
        return self._now

    def advance(self, **delta: float) -> None:
        self._now += timedelta(**delta)


def imageinfo_with(**extmetadata: str | None) -> dict[str, Any]:
    """The recorded answer with extmetadata values replaced, or removed by None."""
    body = copy.deepcopy(IMAGEINFO)
    recorded = body["query"]["pages"][0]["imageinfo"][0]["extmetadata"]
    for name, value in extmetadata.items():
        if value is None:
            del recorded[name]
        else:
            recorded[name] = {"value": value}
    return body


def mock_commons(
    router: respx.MockRouter, imageinfo: dict[str, Any] = IMAGEINFO
) -> tuple[respx.Route, respx.Route]:
    """The recorded imageinfo answer and its thumbnail. Returns (API route, download route)."""
    api = router.get(url__startswith=COMMONS_API).respond(json=imageinfo)
    download = router.get(THUMB_URL).respond(content=JPEG, headers={"Content-Type": "image/jpeg"})
    return api, download


def mock_commons_files(router: respx.MockRouter, *titles: str) -> dict[str, str]:
    """One allowed photo with its own bytes per title. Returns the sha256 of each."""
    answers, sha256s = {}, {}
    for number, title in enumerate(titles):
        body = copy.deepcopy(IMAGEINFO)
        page = body["query"]["pages"][0]
        page["title"] = title
        url = f"https://upload.wikimedia.org/thumb/{number}.jpg"
        page["imageinfo"][0]["thumburl"] = url
        answers[title] = body
        content = JPEG + str(number).encode()  # trailing bytes: still a decodable JPEG
        sha256s[title] = hashlib.sha256(content).hexdigest()
        router.get(url).respond(content=content, headers={"Content-Type": "image/jpeg"})
    router.get(url__startswith=COMMONS_API).mock(
        side_effect=lambda request: httpx.Response(200, json=answers[request.url.params["titles"]])
    )
    return sha256s


def mock_wikidata_image(router: respx.MockRouter, qid: str, filename: str) -> respx.Route:
    claim = {"mainsnak": {"datavalue": {"value": filename}}}
    return router.get(url__startswith=WIKIDATA_API, params={"entity": qid}).respond(
        json={"claims": {"P18": [claim]}}
    )


def store(stack: dict[str, str], key: str = "S3") -> GarageS3Store:
    """The workers' store. key="S3_IMGPROXY" uses the read-only key instead."""
    return GarageS3Store(
        endpoint=stack["S3_ENDPOINT"],
        region=stack["S3_REGION"],
        bucket=stack["S3_BUCKET"],
        access_key=stack[f"{key}_ACCESS_KEY"],
        secret_key=stack[f"{key}_SECRET_KEY"],
    )


def stored_objects(stack: dict[str, str], prefix: str) -> dict[str, bytes]:
    """What Garage really holds under `prefix`, read with a client of the test's own."""
    s3 = boto3.client(
        "s3",
        endpoint_url=stack["S3_ENDPOINT"],
        region_name=stack["S3_REGION"],
        aws_access_key_id=stack["S3_ACCESS_KEY"],
        aws_secret_access_key=stack["S3_SECRET_KEY"],
    )
    listed = s3.list_objects_v2(Bucket=stack["S3_BUCKET"], Prefix=prefix).get("Contents", [])
    return {
        item["Key"]: s3.get_object(Bucket=stack["S3_BUCKET"], Key=item["Key"])["Body"].read()
        for item in listed
    }


def run_sync(
    db: Any,
    stack: dict[str, str],
    valkey: Valkey,
    *,
    clock: FixedClock | None = None,
    s3: GarageS3Store | None = None,
    max_bytes: int = 10 * 1024 * 1024,
    limit: int = 10,
    min_interval: float = 0,
) -> dict[str, int]:
    commons = HttpCommonsClient(
        user_agent=USER_AGENT, max_bytes=max_bytes, min_interval=min_interval
    )
    with psycopg.connect(db.url) as conn:
        return sync_photos(
            conn, s3 or store(stack), commons, clock or FixedClock(), limit, valkey=valkey
        )
