"""
Food POI foundation pipeline (Guide §5.1–5.7, Rules R1/R3/R5/R6/R8/R9):
1. Seed HDX COD-AB v03 ADM2 (64) & ADM3 (507) polygons into PostGIS.
2. Download Geofabrik bangladesh-latest.osm.pbf and import via osm2pgsql Flex Lua (food.lua).
3. Download Overture Maps Places (overturemaps-py) and clip/filter >= 0.6 confidence.
4. Normalize Bangla with csebuetnlp/normalizer and assign district_id + upazila_id in PostGIS.
5. Conflate OSM + Overture within 50 m using pg_trgm similarity (OSM survivor + review queue).
"""

from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

import httpx
import shapely
import yaml
from overturemaps import core as overture_core
from shapely import wkb
from shapely.geometry import MultiPolygon, Polygon, shape

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared.bangla_norm import (  # noqa: E402
    normalize_bangla,
    normalize_match_key,
    resolve_bilingual_names,
    transliterate_bn_for_matching,
)
from shared.db import (  # noqa: E402
    DATA_DIR,
    ensure_schema,
    get_database_url,
    get_pg_connection,
    load_geo_codes,
    now_bst_iso,
    stable_uuid_v4,
    today_bst_date,
)

GEOFABRIK_PBF_URL = "https://download.geofabrik.de/asia/bangladesh-latest.osm.pbf"
PBF_PATH = DATA_DIR / "bangladesh-latest.osm.pbf"
PBF_META_PATH = DATA_DIR / "bangladesh-latest.meta.json"
BOUNDARY_DIR = DATA_DIR / "boundaries"
ADM2_PATH = BOUNDARY_DIR / "bgd_admin2.geojson"
ADM3_PATH = BOUNDARY_DIR / "bgd_admin3.geojson"
HDX_GEOJSON_ZIP = (
    "https://data.humdata.org/dataset/401d3fae-4262-48c9-891f-461fd776d49b"
    "/resource/cec2abe3-d8b7-4025-9362-9f7e780f2a07/download/bgd_admin_boundaries.geojson.zip"
)
CATEGORY_MAP_PATH = Path(__file__).resolve().parents[1] / "shared" / "category_map.yaml"
FOOD_LUA_PATH = Path(__file__).resolve().parent / "food.lua"


def load_category_map() -> dict:
    return yaml.safe_load(CATEGORY_MAP_PATH.read_text(encoding="utf-8"))


def to_multipolygon_wkt(geom_dict: dict) -> str:
    g = shape(geom_dict)
    if isinstance(g, Polygon):
        g = MultiPolygon([g])
    return shapely.force_2d(g).wkt


def seed_cod_ab_boundaries(conn) -> tuple[int, int]:
    BOUNDARY_DIR.mkdir(parents=True, exist_ok=True)
    if not (ADM2_PATH.exists() and ADM3_PATH.exists()):
        resp = httpx.get(HDX_GEOJSON_ZIP, follow_redirects=True, timeout=60.0)
        resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            zf.extract("bgd_admin2.geojson", BOUNDARY_DIR)
            zf.extract("bgd_admin3.geojson", BOUNDARY_DIR)

    geo_codes = load_geo_codes()
    d_meta = {d["id"]: d for d in geo_codes["districts"]}
    u_meta = {u["id"]: u for u in geo_codes["upazilas"]}

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS cnt FROM geo_districts")
        d_cnt = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*) AS cnt FROM geo_upazilas")
        u_cnt = cur.fetchone()["cnt"]

        if d_cnt < 64:
            adm2_fc = json.loads(ADM2_PATH.read_text(encoding="utf-8"))
            for feat in adm2_fc["features"]:
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
                    (code, meta.get("name_en", p.get("adm2_name", code)), meta.get("name_bn", ""), to_multipolygon_wkt(feat["geometry"])),
                )

        if u_cnt < 507:
            adm3_fc = json.loads(ADM3_PATH.read_text(encoding="utf-8"))
            for feat in adm3_fc["features"]:
                p = feat["properties"]
                u_code = p["adm3_pcode"]
                d_code = p["adm2_pcode"]
                meta = u_meta.get(u_code, {})
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
                        u_code,
                        d_code,
                        meta.get("name_en", p.get("adm3_name", u_code)),
                        meta.get("name_bn", ""),
                        to_multipolygon_wkt(feat["geometry"]),
                    ),
                )
        conn.commit()

        cur.execute("SELECT COUNT(*) AS cnt FROM geo_districts")
        d_cnt = cur.fetchone()["cnt"]
        cur.execute("SELECT COUNT(*) AS cnt FROM geo_upazilas")
        u_cnt = cur.fetchone()["cnt"]
        if d_cnt != 64 or u_cnt != 507:
            raise RuntimeError(f"COD-AB sanity check failed: districts={d_cnt}, upazilas={u_cnt}")
        return d_cnt, u_cnt


def download_pbf_if_needed(force: bool = False) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": "AparajeyoFoodSync/0.1 (https://aparajeyo.com)"}
    if PBF_META_PATH.exists() and PBF_PATH.exists() and not force:
        meta = json.loads(PBF_META_PATH.read_text(encoding="utf-8"))
        if meta.get("etag"):
            headers["If-None-Match"] = meta["etag"]
        if meta.get("last_modified"):
            headers["If-Modified-Since"] = meta["last_modified"]

    with httpx.Client(follow_redirects=True, timeout=300.0) as client:
        with client.stream("GET", GEOFABRIK_PBF_URL, headers=headers) as resp:
            if resp.status_code == 304 and PBF_PATH.exists():
                return PBF_PATH
            resp.raise_for_status()
            tmp = PBF_PATH.with_suffix(".osm.pbf.part")
            with tmp.open("wb") as fh:
                for chunk in resp.iter_bytes(chunk_size=1024 * 256):
                    fh.write(chunk)
            tmp.replace(PBF_PATH)
            PBF_META_PATH.write_text(
                json.dumps(
                    {
                        "etag": resp.headers.get("etag"),
                        "last_modified": resp.headers.get("last-modified"),
                        "downloaded_at": now_bst_iso(),
                        "bytes": PBF_PATH.stat().st_size,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
    return PBF_PATH


def win_to_wsl_path(p: Path) -> str:
    resolved = str(p.resolve())
    drive, rest = resolved[0].lower(), resolved[2:].replace("\\", "/")
    return f"/mnt/{drive}{rest}"


def run_osm2pgsql_flex(pbf_path: Path) -> None:
    db_url = get_database_url()
    # Parse postgresql://user:pass@host:port/db
    from urllib.parse import urlparse

    u = urlparse(db_url)
    host = "127.0.0.1" if u.hostname in ("localhost", "127.0.0.1", None) else u.hostname
    port = str(u.port or 5432)
    dbname = u.path.lstrip("/")
    user = u.username or "food"
    password = u.password or "food"

    if shutil.which("osm2pgsql"):
        env = dict(os.environ, PGPASSWORD=password)
        cmd = [
            "osm2pgsql",
            "--create",
            "--output=flex",
            f"--style={FOOD_LUA_PATH}",
            "--host",
            host,
            "--port",
            port,
            "--database",
            dbname,
            "--username",
            user,
            str(pbf_path),
        ]
        subprocess.run(cmd, env=env, check=True)
        return

    # Run official osm2pgsql Docker container via WSL using host network
    wsl_data = win_to_wsl_path(DATA_DIR)
    wsl_lua = win_to_wsl_path(FOOD_LUA_PATH)
    cmd = [
        "wsl",
        "-d",
        "Ubuntu",
        "--",
        "docker",
        "run",
        "--rm",
        "--network",
        "host",
        "-e",
        f"PGPASSWORD={password}",
        "-v",
        f"{wsl_data}:/data:ro",
        "-v",
        f"{wsl_lua}:/style/food.lua:ro",
        "iboates/osm2pgsql:latest",
        "osm2pgsql",
        "--create",
        "--output=flex",
        "--style=/style/food.lua",
        "--host=127.0.0.1",
        f"--port={port}",
        f"--database={dbname}",
        f"--username={user}",
        "/data/bangladesh-latest.osm.pbf",
    ]
    subprocess.run(cmd, check=True)


def extract_cuisines(search_blob: str, category: str, cmap: dict) -> list[str]:
    cuisines: list[str] = []
    for slug, keywords in cmap["cuisine_keywords"].items():
        if any(kw in search_blob for kw in keywords):
            cuisines.append(slug)
    if category == "sweets_bakery" and "mishti" not in cuisines:
        cuisines.append("mishti")
    return cuisines or ["other"]


def classify_osm_tags(tags: dict[str, str], cmap: dict) -> tuple[str | None, list[str]]:
    amenity = (tags.get("amenity") or "").strip().lower()
    shop = (tags.get("shop") or "").strip().lower()
    cuisine_raw = (tags.get("cuisine") or "").strip().lower()
    vending = (tags.get("vending") or "").strip().lower()
    name_blob = " ".join(
        filter(None, [tags.get("name"), tags.get("name:en"), tags.get("name:bn"), cuisine_raw])
    ).lower()

    category: str | None = None
    if amenity == "cafe":
        category = (
            "tea_stall"
            if ("tea" in cuisine_raw or any(kw in name_blob for kw in cmap["tea_keywords"]))
            else "cafe"
        )
    elif amenity in cmap["osm_amenity_map"]:
        if amenity == "street_vendor" and not cuisine_raw and "food" not in name_blob:
            category = None
        else:
            category = cmap["osm_amenity_map"][amenity]
    elif shop in cmap["osm_shop_map"]:
        category = cmap["osm_shop_map"][shop]
    elif amenity == "vending_machine" and vending == "food":
        category = "street_food"
    elif shop == "kiosk" and cuisine_raw:
        category = "street_food"

    if category is None:
        return None, []
    if any(kw in cuisine_raw for kw in ("sweets", "mishti")):
        category = "sweets_bakery"
    elif "dessert" in cuisine_raw and category == "other":
        category = "dessert"

    return category, extract_cuisines(f"{cuisine_raw} {name_blob}", category, cmap)


def ingest_osm_from_staging(conn, cmap: dict) -> tuple[int, set[str]]:
    now_iso = now_bst_iso()
    seen_ids: set[str] = set()
    imported = 0

    with conn.cursor() as cur:
        # Resolve district & upazila directly in PostGIS (exact covers -> 2km snap)
        cur.execute(
            """
            SELECT
              s.osm_type,
              s.osm_id,
              s.tags,
              ST_X(s.geom) AS lng,
              ST_Y(s.geom) AS lat,
              COALESCE(
                (SELECT d.id FROM geo_districts d WHERE ST_Covers(d.geom, s.geom) LIMIT 1),
                (SELECT d.id FROM geo_districts d WHERE ST_DWithin(d.geom::geography, s.geom::geography, 2000) ORDER BY ST_Distance(d.geom::geography, s.geom::geography) LIMIT 1)
              ) AS district_id,
              COALESCE(
                (SELECT u.id FROM geo_upazilas u WHERE ST_Covers(u.geom, s.geom) LIMIT 1),
                (SELECT u.id FROM geo_upazilas u WHERE ST_DWithin(u.geom::geography, s.geom::geography, 2000) ORDER BY ST_Distance(u.geom::geography, s.geom::geography) LIMIT 1)
              ) AS upazila_id
            FROM osm_food_staging s
            """
        )
        rows = cur.fetchall()

        for r in rows:
            district_id = r["district_id"]
            if not district_id:
                continue
            tags = r["tags"] if isinstance(r["tags"], dict) else json.loads(r["tags"])
            category, cuisines = classify_osm_tags(tags, cmap)
            if not category:
                continue
            name_en, name_bn = resolve_bilingual_names(
                tags.get("name"), tags.get("name:en"), tags.get("name:bn")
            )
            if not name_en and not name_bn:
                continue

            kind = "node" if r["osm_type"] == "N" else "way" if r["osm_type"] == "W" else "relation"
            source_id = f"{kind}/{r['osm_id']}"
            place_id = stable_uuid_v4("osm", source_id)
            seen_ids.add(source_id)

            name_norm = normalize_match_key(name_bn or name_en)
            name_roman = transliterate_bn_for_matching(name_bn or name_en)
            has_rich = bool(
                tags.get("wikimedia_commons")
                or tags.get("wikidata")
                or (tags.get("opening_hours") and (tags.get("phone") or tags.get("website")))
            )

            cur.execute(
                """
                INSERT INTO places (
                  id, overlay_type, source, source_id, district_id, upazila_id,
                  geom, name_en, name_bn, name_norm, name_roman, category, cuisines, tags,
                  source_license, is_featured, is_active, missed_imports,
                  first_seen_at, last_seen_at, updated_at
                ) VALUES (
                  %s::uuid, 'food', 'osm', %s, %s, %s,
                  ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s, %s, %s::text[], %s::jsonb,
                  'ODbL-1.0', %s, true, 0, %s, %s, %s
                )
                ON CONFLICT (source, source_id) DO UPDATE SET
                  district_id = EXCLUDED.district_id,
                  upazila_id = EXCLUDED.upazila_id,
                  geom = EXCLUDED.geom,
                  name_en = EXCLUDED.name_en,
                  name_bn = EXCLUDED.name_bn,
                  name_norm = EXCLUDED.name_norm,
                  name_roman = EXCLUDED.name_roman,
                  category = EXCLUDED.category,
                  cuisines = EXCLUDED.cuisines,
                  tags = EXCLUDED.tags,
                  is_featured = (places.is_featured OR EXCLUDED.is_featured),
                  is_active = true,
                  missed_imports = 0,
                  last_seen_at = EXCLUDED.last_seen_at,
                  updated_at = EXCLUDED.updated_at
                """,
                (
                    place_id,
                    source_id,
                    district_id,
                    r["upazila_id"],
                    float(r["lng"]),
                    float(r["lat"]),
                    name_en,
                    name_bn,
                    name_norm,
                    name_roman,
                    category,
                    cuisines,
                    json.dumps(tags, ensure_ascii=False),
                    has_rich,
                    now_iso,
                    now_iso,
                    now_iso,
                ),
            )
            imported += 1

        # Drop staging table cleanly and soft-deactivate missing OSM places after 2 consecutive misses
        cur.execute("DROP TABLE IF EXISTS osm_food_staging")
        if imported > 0:
            cur.execute(
                "SELECT id::text AS id, source_id, missed_imports FROM places WHERE overlay_type = 'food' AND source = 'osm' AND is_active"
            )
            for ex in cur.fetchall():
                if ex["source_id"] not in seen_ids:
                    next_missed = int(ex["missed_imports"]) + 1
                    cur.execute(
                        "UPDATE places SET missed_imports = %s, is_active = %s, updated_at = %s WHERE id = %s::uuid",
                        (next_missed, next_missed < 2, now_iso, ex["id"]),
                    )
    conn.commit()
    return imported, seen_ids


def classify_overture_row(row: dict, cmap: dict) -> tuple[str | None, list[str]]:
    tax = row.get("taxonomy") or {}
    primary = (tax.get("primary") or "").lower()
    hierarchy = [h.lower() for h in (tax.get("hierarchy") or [])]
    alternates = [a.lower() for a in (tax.get("alternates") or [])]
    basic = (row.get("basic_category") or "").lower()

    candidates = [primary, basic, *alternates, *hierarchy]
    ovt_map = cmap["overture_category_map"]
    category: str | None = None
    for c in candidates:
        if c in ovt_map:
            category = ovt_map[c]
            break

    if not category and "eat_and_drink" in hierarchy:
        category = "other"

    if not category:
        return None, []

    blob = " ".join(candidates)
    return category, extract_cuisines(blob, category, cmap)


def extract_overture_names(names_obj: dict | None) -> tuple[str | None, str | None]:
    if not names_obj:
        return None, None
    primary = names_obj.get("primary")
    common_raw = names_obj.get("common")
    common: dict[str, str] = {}
    if isinstance(common_raw, dict):
        common = common_raw
    elif isinstance(common_raw, list):
        for item in common_raw:
            if isinstance(item, (list, tuple)) and len(item) == 2:
                common[item[0]] = item[1]
            elif isinstance(item, dict) and "key" in item and "value" in item:
                common[item["key"]] = item["value"]
    return resolve_bilingual_names(primary, common.get("en"), common.get("bn"))


OVERTURE_CACHE_PATH = DATA_DIR / "bd_overture_food.parquet"


def ingest_overture(conn, cmap: dict, min_confidence: float = 0.6, use_cache: bool = True) -> int:
    import pyarrow as pa
    import pyarrow.parquet as pq

    if not (use_cache and OVERTURE_CACHE_PATH.exists()):
        print("[overture] Streaming Bangladesh places from Overture S3 GeoParquet...", file=sys.stderr, flush=True)
        reader = overture_core.record_batch_reader(
            "place", bbox=(88.0, 20.5, 92.7, 26.7), connect_timeout=15.0, request_timeout=60.0
        )
        if reader is None:
            return 0

        kept_tables: list[pa.Table] = []
        batch_num = 0
        for batch in reader:
            batch_num += 1
            # Keep only columns needed for Food filtering/attribution
            cols = [
                c
                for c in (
                    "id",
                    "geometry",
                    "confidence",
                    "names",
                    "taxonomy",
                    "basic_category",
                    "operating_status",
                    "addresses",
                    "phones",
                    "websites",
                    "sources",
                )
                if c in batch.schema.names
            ]
            sub = pa.Table.from_batches([batch]).select(cols)
            kept_tables.append(sub)
            if batch_num % 10 == 0:
                print(f"[overture] Fetched {batch_num} row batches...", file=sys.stderr, flush=True)

        if not kept_tables:
            return 0
        full_table = pa.concat_tables(kept_tables)
        pq.write_table(full_table, OVERTURE_CACHE_PATH)
        print(f"[overture] Cached {full_table.num_rows} raw places to {OVERTURE_CACHE_PATH.name}", file=sys.stderr, flush=True)

    table = pq.read_table(OVERTURE_CACHE_PATH)
    now_iso = now_bst_iso()
    food_rows: list[tuple] = []

    for row in table.to_pylist():
        conf = float(row.get("confidence") or 0.0)
        if conf < min_confidence:
            continue
        if row.get("operating_status") in ("permanently_closed", "closed"):
            continue

        category, cuisines = classify_overture_row(row, cmap)
        if not category:
            continue
        name_en, name_bn = extract_overture_names(row.get("names"))
        if not name_en and not name_bn:
            continue

        geom_bytes = row.get("geometry")
        if not geom_bytes:
            continue
        pt = wkb.loads(geom_bytes)
        lng, lat = round(float(pt.x), 6), round(float(pt.y), 6)

        source_id = str(row["id"])
        place_id = stable_uuid_v4("overture", source_id)
        sources = row.get("sources") or []
        lic = next((s.get("license") for s in sources if s.get("license")), "CDLA-Permissive-2.0")

        addrs = row.get("addresses") or []
        addr_str = addrs[0].get("freeform") if addrs and isinstance(addrs[0], dict) else None
        phones = row.get("phones") or []
        websites = row.get("websites") or []
        tags = {
            "addr:full": addr_str,
            "phone": phones[0] if phones else None,
            "website": websites[0] if websites else None,
            "overture_taxonomy": row.get("taxonomy"),
            "overture_sources": sources,
        }
        tags = {k: v for k, v in tags.items() if v is not None}

        food_rows.append(
            (
                place_id,
                source_id,
                lng,
                lat,
                name_en,
                name_bn,
                normalize_match_key(name_bn or name_en),
                transliterate_bn_for_matching(name_bn or name_en),
                category,
                cuisines,
                json.dumps(tags, ensure_ascii=False, default=str),
                lic,
                round(conf, 2),
                now_iso,
            )
        )

    if not food_rows:
        return 0

    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TEMP TABLE tmp_overture_food (
              id uuid,
              source_id text,
              lng double precision,
              lat double precision,
              name_en text,
              name_bn text,
              name_norm text,
              name_roman text,
              category text,
              cuisines text[],
              tags jsonb,
              source_license text,
              source_confidence numeric(3, 2),
              seen_at timestamptz
            ) ON COMMIT DROP
            """
        )
        cur.executemany(
            """
            INSERT INTO tmp_overture_food VALUES (
              %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s::text[], %s::jsonb, %s, %s, %s
            )
            """,
            food_rows,
        )
        cur.execute(
            """
            ALTER TABLE tmp_overture_food ADD COLUMN geom geometry(Point, 4326);
            UPDATE tmp_overture_food SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326);
            CREATE INDEX idx_tmp_ovt_geom ON tmp_overture_food USING gist (geom);

            ALTER TABLE tmp_overture_food ADD COLUMN district_id char(6);
            ALTER TABLE tmp_overture_food ADD COLUMN upazila_id char(10);

            -- Fast GiST-indexed containment pass
            UPDATE tmp_overture_food t
            SET district_id = d.id
            FROM geo_districts d
            WHERE d.geom && t.geom AND ST_Covers(d.geom, t.geom);

            -- 2 km coastal/riverbank snap ONLY for unmatched points, prefiltered by GiST bbox
            UPDATE tmp_overture_food t
            SET district_id = (
              SELECT d.id
              FROM geo_districts d
              WHERE d.geom && ST_Expand(t.geom, 0.025)
                AND ST_DWithin(d.geom::geography, t.geom::geography, 2000)
              ORDER BY ST_Distance(d.geom::geography, t.geom::geography) ASC
              LIMIT 1
            )
            WHERE t.district_id IS NULL;

            UPDATE tmp_overture_food t
            SET upazila_id = u.id
            FROM geo_upazilas u
            WHERE u.district_id = t.district_id AND u.geom && t.geom AND ST_Covers(u.geom, t.geom)
            """
        )
        cur.execute(
            """
            INSERT INTO places (
              id, overlay_type, source, source_id, district_id, upazila_id,
              geom, name_en, name_bn, name_norm, name_roman, category, cuisines, tags,
              source_license, source_confidence, is_featured, is_active, missed_imports,
              first_seen_at, last_seen_at, updated_at
            )
            SELECT
              t.id,
              'food',
              'overture',
              t.source_id,
              t.district_id,
              t.upazila_id,
              t.geom,
              t.name_en,
              t.name_bn,
              t.name_norm,
              t.name_roman,
              t.category,
              t.cuisines,
              t.tags,
              t.source_license,
              t.source_confidence,
              false,
              true,
              0,
              t.seen_at,
              t.seen_at,
              t.seen_at
            FROM tmp_overture_food t
            WHERE t.district_id IS NOT NULL
            ON CONFLICT (source, source_id) DO UPDATE SET
              district_id = EXCLUDED.district_id,
              upazila_id = EXCLUDED.upazila_id,
              geom = EXCLUDED.geom,
              name_en = EXCLUDED.name_en,
              name_bn = EXCLUDED.name_bn,
              name_norm = EXCLUDED.name_norm,
              name_roman = EXCLUDED.name_roman,
              category = EXCLUDED.category,
              cuisines = EXCLUDED.cuisines,
              tags = EXCLUDED.tags,
              source_license = EXCLUDED.source_license,
              source_confidence = EXCLUDED.source_confidence,
              is_active = true,
              missed_imports = 0,
              last_seen_at = EXCLUDED.last_seen_at,
              updated_at = EXCLUDED.updated_at
            """
        )
        inserted = cur.rowcount
    conn.commit()
    return inserted


def conflate_osm_and_overture(conn) -> dict:
    """
    Merges Overture duplicates into OSM survivors within 50 m + same category + pg_trgm similarity (Guide §5.4).
    """
    auto_merged = 0
    queued = 0

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              o.id::text AS osm_id,
              v.id::text AS ovt_id,
              v.source_id AS ovt_source_id,
              v.name_en AS ovt_name_en,
              v.name_bn AS ovt_name_bn,
              v.tags AS ovt_tags,
              ST_Distance(o.geom::geography, v.geom::geography) AS dist_m,
              GREATEST(
                similarity(o.name_norm, v.name_norm),
                similarity(o.name_roman, v.name_roman)
              ) AS name_sim
            FROM places o
            JOIN places v
              ON v.overlay_type = 'food'
             AND v.source = 'overture'
             AND v.is_active
             AND o.district_id = v.district_id
             AND o.category = v.category
             AND o.geom && ST_Expand(v.geom, 0.001)
             AND ST_DWithin(o.geom::geography, v.geom::geography, 50)
            WHERE o.overlay_type = 'food'
              AND o.source = 'osm'
              AND o.is_active
            ORDER BY name_sim DESC, dist_m ASC
            """
        )
        pairs = cur.fetchall()
        seen_ovt: set[str] = set()

        for p in pairs:
            if p["ovt_id"] in seen_ovt:
                continue
            sim = float(p["name_sim"] or 0.0)
            if sim >= 0.55:
                seen_ovt.add(p["ovt_id"])
                ovt_tags = p["ovt_tags"] if isinstance(p["ovt_tags"], dict) else {}
                cur.execute(
                    """
                    UPDATE places
                    SET
                      name_en = COALESCE(name_en, %s),
                      name_bn = COALESCE(name_bn, %s),
                      merged_source_ids = CASE
                        WHEN NOT (merged_source_ids ? %s) THEN merged_source_ids || jsonb_build_array(%s::text)
                        ELSE merged_source_ids
                      END,
                      tags = jsonb_strip_nulls(%s::jsonb) || tags,
                      updated_at = now()
                    WHERE id = %s::uuid
                    """,
                    (
                        p["ovt_name_en"],
                        p["ovt_name_bn"],
                        p["ovt_source_id"],
                        p["ovt_source_id"],
                        json.dumps({k: ovt_tags.get(k) for k in ("phone", "website", "addr:full")}),
                        p["osm_id"],
                    ),
                )
                cur.execute("UPDATE places SET is_active = false WHERE id = %s::uuid", (p["ovt_id"],))
                auto_merged += 1
            elif sim >= 0.35:
                seen_ovt.add(p["ovt_id"])
                cur.execute(
                    """
                    INSERT INTO conflation_review_queue (primary_place_id, candidate_place_id, distance_m, name_similarity)
                    VALUES (%s::uuid, %s::uuid, %s, %s)
                    ON CONFLICT (primary_place_id, candidate_place_id) DO NOTHING
                    """,
                    (p["osm_id"], p["ovt_id"], round(float(p["dist_m"]), 2), round(sim, 2)),
                )
                queued += 1
        conn.commit()

    return {"auto_merged": auto_merged, "review_queued": queued}


def run_import(skip_download: bool = False, skip_overture: bool = False) -> dict:
    started_at = now_bst_iso()
    conn = get_pg_connection()
    ensure_schema(conn)
    d_cnt, u_cnt = seed_cod_ab_boundaries(conn)

    pbf_path = PBF_PATH if (skip_download and PBF_PATH.exists()) else download_pbf_if_needed()
    run_osm2pgsql_flex(pbf_path)

    cmap = load_category_map()
    osm_count, _ = ingest_osm_from_staging(conn, cmap)
    overture_count = 0 if skip_overture else ingest_overture(conn, cmap)
    conflation = conflate_osm_and_overture(conn) if overture_count > 0 else {"auto_merged": 0, "review_queued": 0}

    dataset_version = today_bst_date()
    finished_at = now_bst_iso()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sync_runs (source, dataset_version, imported_count, status, started_at, finished_at, notes)
            VALUES (%s, %s, %s, 'ok', %s, %s, %s::jsonb)
            """,
            (
                "osm+overture" if not skip_overture else "osm",
                dataset_version,
                osm_count + overture_count,
                started_at,
                finished_at,
                json.dumps(
                    {
                        "districts": d_cnt,
                        "upazilas": u_cnt,
                        "osm_count": osm_count,
                        "overture_count": overture_count,
                        "conflation": conflation,
                    }
                ),
            ),
        )
        cur.execute("SELECT COUNT(*) AS cnt FROM places WHERE overlay_type = 'food' AND is_active")
        active_total = cur.fetchone()["cnt"]
    conn.commit()
    conn.close()

    return {
        "status": "synced",
        "osm_count": osm_count,
        "overture_count": overture_count,
        "conflation": conflation,
        "active_places": active_total,
        "dataset_version": dataset_version,
        "synced_at": finished_at,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-download", action="store_true")
    parser.add_argument("--skip-overture", action="store_true")
    parser.add_argument("--conflate-only", action="store_true")
    args = parser.parse_args()
    if args.conflate_only:
        c = get_pg_connection()
        res = conflate_osm_and_overture(c)
        c.close()
        print(json.dumps(res))
    else:
        print(json.dumps(run_import(skip_download=args.skip_download, skip_overture=args.skip_overture)))
