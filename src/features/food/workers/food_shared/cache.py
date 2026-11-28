"""Writer side of the Valkey cache contract: bumping the epoch invalidates the API's cached
responses."""

from __future__ import annotations

import logging
from typing import cast

from valkey import Valkey

EPOCH_KEY = "food:epoch"  # must equal EPOCH_KEY in api/valkey.ts

log = logging.getLogger(__name__)


def bump_epoch(valkey: Valkey, reason: str) -> int:
    """Raises on failure: a writer must know that its change was not published."""
    epoch = cast(int, valkey.incr(EPOCH_KEY))  # typed for the async client too
    log.info("cache epoch bumped to %s (%s)", epoch, reason)
    return epoch
