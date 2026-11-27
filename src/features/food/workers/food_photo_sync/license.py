"""Wikimedia Commons license gate (Guide §6.3 Slice 0A.1, Rule R4)."""

from __future__ import annotations

import re

# Anchored at both ends so NC/ND variants cannot pass on a "CC BY" prefix.
ALLOWED_LICENSE_RE = re.compile(
    r"^(?:CC0(?: 1\.0)?|Public domain|CC BY(?:-SA)? [1-4]\.\d(?: [a-z]{2})?)$"
)


def is_allowed_license(short_name: str, non_free_flag: str | None) -> bool:
    if non_free_flag == "true":
        return False
    return ALLOWED_LICENSE_RE.match(short_name) is not None
