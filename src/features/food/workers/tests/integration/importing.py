"""Shared helpers for importer tests (seam S7): fixture sources, variants of them, and one import."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path

import psycopg
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
from shapely.geometry import Point

from food_poi_import.run import run_import

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
OSM_FIXTURE = FIXTURES / "osm" / "food_small.osm"
OVERTURE_FIXTURE = FIXTURES / "overture" / "food_small.parquet"
GEO_FIXTURE = FIXTURES / "geo" / "geo_fixture.sql"


class FixedClock:
    def now(self) -> datetime:
        return datetime(2026, 11, 27, 20, 0, tzinfo=UTC)  # 28 November in Dhaka


def import_sources(db, osm: Path = OSM_FIXTURE, overture: Path | None = OVERTURE_FIXTURE) -> dict:
    with psycopg.connect(db.url) as conn:
        return run_import(osm, overture, conn, FixedClock(), valkey=db.valkey)


def places(db) -> dict[str, dict]:
    """Every places row, keyed by source_id."""
    rows = db.conn.execute(
        "SELECT *, id::text AS id, merged_into::text AS merged_into FROM places"
    ).fetchall()
    return {row["source_id"]: row for row in rows}


def osm_variant(directory: Path, *, drop: tuple[str, ...] = (), add: tuple[dict, ...] = ()) -> Path:
    """The OSM fixture without the `drop` elements ("node/4") and with extra restaurant nodes."""
    tree = ET.parse(OSM_FIXTURE)
    root = tree.getroot()
    for element in list(root):
        if f"{element.tag}/{element.get('id')}" in drop:
            root.remove(element)
    for node in add:
        element = ET.Element(
            "node",
            id=str(node["id"]),
            version="1",
            lat=f"{node['lat']:.7f}",
            lon=f"{node['lng']:.7f}",
        )
        ET.SubElement(element, "tag", k="amenity", v="restaurant")
        ET.SubElement(element, "tag", k="name", v=node.get("name", f"Test Kitchen {node['id']}"))
        # osm2pgsql needs nodes before ways, in ascending id order.
        root.insert(len(root.findall("node")), element)
    path = directory / "variant.osm"
    tree.write(path, encoding="utf-8", xml_declaration=True)
    return path


def overture_variant(
    directory: Path, *, drop: tuple[str, ...] = (), add: tuple[dict, ...] = ()
) -> Path:
    """The Overture fixture without the `drop` ids and with extra restaurant rows."""
    table = pq.read_table(OVERTURE_FIXTURE)
    table = table.filter(pc.invert(pc.is_in(table["id"], pa.array(list(drop), pa.string()))))
    extra = [
        {
            "id": row["id"],
            "geometry": Point(row["lng"], row["lat"]).wkb,
            "confidence": 0.9,
            "names": {"primary": row.get("name", row["id"]), "common": []},
            "basic_category": "restaurant",
        }
        for row in add
    ]
    if extra:
        table = pa.concat_tables([table, pa.Table.from_pylist(extra, schema=table.schema)])
    path = directory / "variant.parquet"
    pq.write_table(table, path)
    return path
