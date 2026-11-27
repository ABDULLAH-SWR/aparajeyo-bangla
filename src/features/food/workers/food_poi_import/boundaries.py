"""Loads HDX COD-AB v03 ADM2 (64) and ADM3 (507) polygons. Needs the database owner role."""

from __future__ import annotations

import io
import json
import zipfile

import httpx
import shapely
from shapely.geometry import MultiPolygon, Polygon, shape

from food_shared.db import DATA_DIR

BOUNDARY_DIR = DATA_DIR / "boundaries"
ADM2_PATH = BOUNDARY_DIR / "bgd_admin2.geojson"
ADM3_PATH = BOUNDARY_DIR / "bgd_admin3.geojson"
HDX_GEOJSON_ZIP = (
    "https://data.humdata.org/dataset/401d3fae-4262-48c9-891f-461fd776d49b"
    "/resource/cec2abe3-d8b7-4025-9362-9f7e780f2a07/download/bgd_admin_boundaries.geojson.zip"
)


def _to_multipolygon_wkt(geom_dict: dict) -> str:
    g = shape(geom_dict)
    if isinstance(g, Polygon):
        g = MultiPolygon([g])
    return shapely.force_2d(g).wkt


def _counts(cur) -> tuple[int, int]:
    cur.execute(
        "SELECT (SELECT COUNT(*) FROM geo_districts) AS d, (SELECT COUNT(*) FROM geo_upazilas) AS u"
    )
    row = cur.fetchone()
    return row["d"], row["u"]


def seed_cod_ab_boundaries(conn, geo_codes: dict) -> tuple[int, int]:
    """Fills any missing boundaries and commits. `conn` must return dict rows."""
    with conn.cursor() as cur:
        d_cnt, u_cnt = _counts(cur)
        if (d_cnt, u_cnt) != (64, 507):
            BOUNDARY_DIR.mkdir(parents=True, exist_ok=True)
            if not (ADM2_PATH.exists() and ADM3_PATH.exists()):
                resp = httpx.get(HDX_GEOJSON_ZIP, follow_redirects=True, timeout=60.0)
                resp.raise_for_status()
                with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                    zf.extract("bgd_admin2.geojson", BOUNDARY_DIR)
                    zf.extract("bgd_admin3.geojson", BOUNDARY_DIR)

            d_meta = {d["id"]: d for d in geo_codes["districts"]}
            u_meta = {u["id"]: u for u in geo_codes["upazilas"]}

        if d_cnt < 64:
            for feat in json.loads(ADM2_PATH.read_text(encoding="utf-8"))["features"]:
                p = feat["properties"]
                code = p["adm2_pcode"]
                meta = d_meta.get(code, {})
                cur.execute(
                    """
                    INSERT INTO geo_districts (id, name_en, name_bn, geom)
                    VALUES (%s, %s, %s, ST_Multi(ST_GeomFromText(%s, 4326)))
                    ON CONFLICT (id) DO UPDATE SET
                      name_en = EXCLUDED.name_en,
                      name_bn = EXCLUDED.name_bn,
                      geom = EXCLUDED.geom
                    """,
                    (
                        code,
                        meta.get("name_en", p.get("adm2_name", code)),
                        meta.get("name_bn", ""),
                        _to_multipolygon_wkt(feat["geometry"]),
                    ),
                )

        if u_cnt < 507:
            for feat in json.loads(ADM3_PATH.read_text(encoding="utf-8"))["features"]:
                p = feat["properties"]
                code = p["adm3_pcode"]
                meta = u_meta.get(code, {})
                cur.execute(
                    """
                    INSERT INTO geo_upazilas (id, district_id, name_en, name_bn, geom)
                    VALUES (%s, %s, %s, %s, ST_Multi(ST_GeomFromText(%s, 4326)))
                    ON CONFLICT (id) DO UPDATE SET
                      district_id = EXCLUDED.district_id,
                      name_en = EXCLUDED.name_en,
                      name_bn = EXCLUDED.name_bn,
                      geom = EXCLUDED.geom
                    """,
                    (
                        code,
                        p["adm2_pcode"],
                        meta.get("name_en", p.get("adm3_name", code)),
                        meta.get("name_bn", ""),
                        _to_multipolygon_wkt(feat["geometry"]),
                    ),
                )
        d_cnt, u_cnt = _counts(cur)
    if (d_cnt, u_cnt) != (64, 507):
        raise RuntimeError(f"COD-AB sanity check failed: districts={d_cnt}, upazilas={u_cnt}")
    conn.commit()
    return d_cnt, u_cnt
