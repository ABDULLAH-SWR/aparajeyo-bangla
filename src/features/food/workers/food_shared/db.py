"""PostgreSQL connections and the id and time helpers shared by the Food workers."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime

import psycopg
from psycopg.rows import DictRow, dict_row

from food_shared.clock import BST


def now_bst_iso() -> str:
    return datetime.now(BST).isoformat(timespec="seconds")


def stable_uuid_v4(source: str, source_id: str) -> str:
    """Deterministic RFC 4122 UUID v4 derived from (source, source_id) (Rule R8)."""
    digest = bytearray(hashlib.sha256(f"{source}:{source_id}".encode()).digest()[:16])
    digest[6] = (digest[6] & 0x0F) | 0x40
    digest[8] = (digest[8] & 0x3F) | 0x80
    return str(uuid.UUID(bytes=bytes(digest)))


def get_pg_connection(database_url: str) -> psycopg.Connection[DictRow]:
    return psycopg.Connection[DictRow].connect(database_url, row_factory=dict_row, autocommit=False)
