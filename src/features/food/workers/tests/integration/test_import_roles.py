"""run_import under the least-privilege worker role (migration 0010)."""

import uuid
from urllib.parse import urlsplit, urlunsplit

import pytest
from importing import import_sources


@pytest.fixture
def worker_url(import_db):
    """The test database, reached through a throwaway login that only holds food_worker's grants."""
    name = f"food_pytest_worker_{uuid.uuid4().hex[:12]}"
    password = uuid.uuid4().hex
    import_db.conn.execute(f"CREATE ROLE {name} LOGIN PASSWORD '{password}' IN ROLE food_worker")
    parts = urlsplit(import_db.url)
    host = parts.netloc.rsplit("@", 1)[-1]
    try:
        yield urlunsplit(parts._replace(netloc=f"{name}:{password}@{host}"))
    finally:
        import_db.conn.execute(f"DROP OWNED BY {name}")
        import_db.conn.execute(f"DROP ROLE {name}")


def test_the_worker_role_can_import_after_the_owner_has(import_db, worker_url):
    import_sources(import_db)

    import_db.url = worker_url
    result = import_sources(import_db)

    assert result["candidates"] == {"osm": 7, "overture": 6}
