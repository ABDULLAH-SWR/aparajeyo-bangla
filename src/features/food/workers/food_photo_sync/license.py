"""Wikimedia Commons license gate (Guide §6.3 Slice 0A.1, Rule R4)."""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any

from food_photo_sync.rejected import PhotoRejected

# Matched in full, so NC/ND variants cannot pass on a "CC BY" prefix. Must stay identical to the
# place_photos_license_chk pattern in 0002_place_photos_per_place.sql: purge.py sends it to
# PostgreSQL, so it must mean the same in both regex dialects.
ALLOWED_LICENSE = re.compile(
    r"^(CC0( 1\.0)?|Public domain|PD(-[A-Za-z0-9.-]+)?"
    r"|CC BY(-SA)? (1\.0|2\.0|2\.5|3\.0|4\.0)( [a-z]{2,4})?)$"
)


def is_allowed_license(short_name: str | None, non_free: str | None) -> bool:
    if short_name is None or (non_free or "").strip().lower() == "true":
        return False
    return ALLOWED_LICENSE.fullmatch(short_name.strip()) is not None


class _TextExtractor(HTMLParser):
    """Keeps text only. Every tag and attribute is dropped: no whitelist to get wrong."""

    SEPARATING = frozenset({"br", "div", "li", "p", "table", "td", "th", "tr", "ul", "ol"})
    UNSEEN = frozenset({"script", "style"})

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._unseen = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._unseen += tag in self.UNSEEN
        if tag in self.SEPARATING:
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.UNSEEN and self._unseen:
            self._unseen -= 1
        if tag in self.SEPARATING:
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        if not self._unseen:
            self.parts.append(data)


def plain_text(value: str | None) -> str:
    extractor = _TextExtractor()
    extractor.feed(value or "")
    extractor.close()
    return " ".join("".join(extractor.parts).split())


@dataclass(frozen=True)
class Credit:
    """What the contract requires to be rendered with a photo (§2.2)."""

    author: str
    license: str
    license_url: str
    source_page_url: str


def credit_from_extmetadata(extmetadata: Mapping[str, Any], source_page_url: str | None) -> Credit:
    """The complete credit of a mirrorable photo, or PhotoRejected."""

    def text(name: str) -> str:
        return plain_text(extmetadata.get(name, {}).get("value"))

    short_name = text("LicenseShortName")
    if not short_name:
        raise PhotoRejected("license_missing")
    if not is_allowed_license(short_name, extmetadata.get("NonFree", {}).get("value")):
        raise PhotoRejected("license_not_allowed")
    required = {
        "author": text("Artist")[:200],
        "license_url": text("LicenseUrl"),
        "source_page_url": source_page_url or "",
    }
    for field, value in required.items():
        if not value:
            raise PhotoRejected(f"{field}_missing")
    return Credit(license=short_name, **required)
