"""The Wikimedia port of the media pipeline, and its httpx implementation."""

from __future__ import annotations

import logging
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from food_photo_sync.rejected import PhotoRejected

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
THUMBNAIL_WIDTH = 2048
API_ATTEMPTS = 3
DEFAULT_PAUSE_SECONDS = 5
MAX_PAUSE_SECONDS = 60

log = logging.getLogger(__name__)


class CommonsError(RuntimeError):
    pass


@dataclass(frozen=True)
class ImageInfo:
    title: str
    source_page_url: str | None
    thumb_url: str
    thumb_width: int
    thumb_height: int
    extmetadata: Mapping[str, Any]


@dataclass(frozen=True)
class Download:
    body: bytes
    mime: str


class CommonsClient(Protocol):
    def imageinfo(self, title: str) -> ImageInfo | None:
        """The file's description and 2,048 px thumbnail, or None when there is no such file."""
        ...

    def wikidata_image(self, qid: str) -> str | None:
        """The Commons title of the item's image (property P18), or None."""
        ...

    def download(self, url: str) -> Download:
        """The file's bytes, or PhotoRejected when it is larger than the client accepts."""
        ...


class HttpCommonsClient:
    def __init__(self, *, user_agent: str, max_bytes: int, min_interval: float = 1.0) -> None:
        self._max_bytes = max_bytes
        self._min_interval = min_interval
        self._next_request_at = 0.0
        self._http = httpx.Client(
            headers={"User-Agent": user_agent},
            timeout=20.0,
            follow_redirects=True,
            # Runs before every request, redirects included.
            event_hooks={"request": [self._wait_for_turn]},
        )

    def _wait_for_turn(self, request: httpx.Request) -> None:
        """Requests are sequential and at least `min_interval` seconds apart."""
        time.sleep(max(0.0, self._next_request_at - time.monotonic()))
        self._next_request_at = time.monotonic() + self._min_interval

    def close(self) -> None:
        self._http.close()

    def imageinfo(self, title: str) -> ImageInfo | None:
        body = self._api(
            COMMONS_API,
            {
                "action": "query",
                "titles": title,
                "prop": "imageinfo",
                "iiprop": "url|size|sha1|mime|extmetadata",
                "iiurlwidth": str(THUMBNAIL_WIDTH),
                "format": "json",
                "formatversion": "2",
                "maxlag": "5",
            },
        )
        for page in body.get("query", {}).get("pages", []):
            for info in page.get("imageinfo", []):
                if not info.get("thumburl"):
                    return None
                return ImageInfo(
                    title=page.get("title", title),
                    source_page_url=info.get("descriptionurl"),
                    thumb_url=info["thumburl"],
                    thumb_width=info["thumbwidth"],
                    thumb_height=info["thumbheight"],
                    extmetadata=info.get("extmetadata") or {},
                )
        return None

    def wikidata_image(self, qid: str) -> str | None:
        body = self._api(
            WIKIDATA_API,
            {"action": "wbgetclaims", "entity": qid, "property": "P18", "format": "json"},
        )
        claims = body.get("claims", {}).get("P18", [])
        if not claims:
            return None
        filename = claims[0].get("mainsnak", {}).get("datavalue", {}).get("value")
        return f"File:{filename}" if isinstance(filename, str) and filename else None

    def download(self, url: str) -> Download:
        body = bytearray()
        with self._http.stream("GET", url) as response:
            response.raise_for_status()
            mime = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
            for chunk in response.iter_bytes():
                body += chunk
                if len(body) > self._max_bytes:
                    raise PhotoRejected("too_large")  # leaving the block closes the connection
        return Download(body=bytes(body), mime=mime)

    def _api(self, url: str, params: Mapping[str, str]) -> dict[str, Any]:
        attempt = 1
        while True:
            response = self._http.get(url, params=params)
            response.raise_for_status()
            body: dict[str, Any] = response.json()
            if "error" not in body:
                return body
            code = body["error"].get("code")
            if code != "maxlag" or attempt == API_ATTEMPTS:
                # An error answer must not read as "no photo": the place would not be retried.
                raise CommonsError(f"Wikimedia API error: {code}")
            pause = _retry_after(response)
            log.info("Wikimedia is lagged; retrying in %s s", pause)
            time.sleep(pause)
            attempt += 1


def _retry_after(response: httpx.Response) -> int:
    header = response.headers.get("Retry-After", "")
    if header.isdigit():
        return min(int(header), MAX_PAUSE_SECONDS)
    log.warning("maxlag answer without a usable Retry-After; waiting %s s", DEFAULT_PAUSE_SECONDS)
    return DEFAULT_PAUSE_SECONDS
