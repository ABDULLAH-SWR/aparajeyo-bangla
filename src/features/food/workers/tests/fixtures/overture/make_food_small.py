"""Regenerates food_small.parquet: `uv run python tests/fixtures/overture/make_food_small.py`.

8 rows. ovt-star and ovt-akboria duplicate OSM node/1 and way/101. ovt-lowconf is below the
confidence floor and ovt-closed is permanently closed, so 6 rows are candidates.
"""

from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
from shapely.geometry import Point

SCHEMA = pa.schema(
    [
        ("id", pa.string()),
        ("geometry", pa.binary()),
        ("confidence", pa.float64()),
        (
            "names",
            pa.struct([("primary", pa.string()), ("common", pa.map_(pa.string(), pa.string()))]),
        ),
        ("basic_category", pa.string()),
        ("operating_status", pa.string()),
        ("phones", pa.list_(pa.string())),
        ("sources", pa.list_(pa.struct([("dataset", pa.string()), ("license", pa.string())]))),
    ]
)


def row(source_id, lng, lat, name, category, *, confidence=0.9, status="open", phone=None):
    return {
        "id": source_id,
        "geometry": Point(lng, lat).wkb,
        "confidence": confidence,
        "names": {"primary": name, "common": []},
        "basic_category": category,
        "operating_status": status,
        "phones": [phone] if phone else [],
        "sources": [{"dataset": "meta", "license": "CDLA-Permissive-2.0"}],
    }


ROWS = [
    row("ovt-star", 90.37010, 23.75005, "Star Kabab", "restaurant", phone="+8801700000001"),
    row("ovt-akboria", 89.37515, 24.84815, "Akboria Hotel", "restaurant"),
    row("ovt-coffee", 90.4150, 23.7900, "North End Coffee", "coffee_shop"),
    row("ovt-pizza", 90.4300, 23.8000, "Pizza Roma", "pizza_restaurant"),
    row("ovt-doi", 89.3900, 24.8600, "Bogura Doi Ghor", "confectionery"),
    row("ovt-kacchi", 90.3600, 23.7400, "Kacchi Bhai", "biryani_restaurant"),
    row("ovt-lowconf", 90.3650, 23.7450, "Maybe Diner", "restaurant", confidence=0.4),
    row("ovt-closed", 90.3660, 23.7460, "Old Canteen", "restaurant", status="permanently_closed"),
]

if __name__ == "__main__":
    pq.write_table(
        pa.Table.from_pylist(ROWS, schema=SCHEMA), Path(__file__).with_name("food_small.parquet")
    )
