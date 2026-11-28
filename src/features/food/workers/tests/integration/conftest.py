"""Integration-only fixtures. The database and cache fixtures are in tests/conftest.py."""

from __future__ import annotations

import pytest
from importing import GEO_FIXTURE


@pytest.fixture
def import_db(food_db, valkey_db):
    """A migrated database holding the importer's boundary fixture, and the importer's cache."""
    food_db.valkey = valkey_db
    food_db.migrate()
    food_db.conn.execute(GEO_FIXTURE.read_text(encoding="utf-8"))
    return food_db
