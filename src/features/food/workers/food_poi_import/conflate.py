"""Merges Overture duplicates into OSM survivors: 50 m, same category, pg_trgm similarity (Guide §5.4)."""

from __future__ import annotations

import json

# The tags a survivor takes from a merged duplicate.
CONTACT_KEYS = ("phone", "website", "addr:full")


def keep_merged_details(cur) -> None:
    """Reapplies to staged survivors what they took from their merged duplicates, so that the upsert
    neither discards it nor reports a change. As in conflation, the earlier merge wins."""
    cur.execute(
        """
        WITH merged AS (
          SELECT s.cand_id, m.position,
                 CASE WHEN c.cand_id IS NULL THEN loser.name_en ELSE c.name_en END AS name_en,
                 CASE WHEN c.cand_id IS NULL THEN loser.name_bn ELSE c.name_bn END AS name_bn,
                 CASE WHEN c.cand_id IS NULL THEN loser.tags ELSE c.tags END AS tags
          FROM tmp_food_candidates s
          JOIN places survivor ON survivor.source = s.source AND survivor.source_id = s.source_id
          CROSS JOIN LATERAL jsonb_array_elements_text(survivor.merged_source_ids)
                             WITH ORDINALITY AS m (source_id, position)
          JOIN places loser ON loser.source = 'overture' AND loser.source_id = m.source_id
                           AND loser.merged_into = survivor.id
          LEFT JOIN tmp_food_candidates c
                 ON c.source = loser.source AND c.source_id = loser.source_id
        ),
        names AS (
          SELECT cand_id,
                 (array_agg(name_en ORDER BY position) FILTER (WHERE name_en IS NOT NULL))[1] AS name_en,
                 (array_agg(name_bn ORDER BY position) FILTER (WHERE name_bn IS NOT NULL))[1] AS name_bn
          FROM merged GROUP BY cand_id
        ),
        contact AS (
          SELECT cand_id, jsonb_object_agg(key, value) AS tags
          FROM (
            SELECT DISTINCT ON (cand_id, key) cand_id, key, value
            FROM merged CROSS JOIN LATERAL jsonb_each(merged.tags)
            WHERE key = ANY (%s) AND value <> 'null'::jsonb
            ORDER BY cand_id, key, position
          ) first_value
          GROUP BY cand_id
        )
        UPDATE tmp_food_candidates s
        SET name_en = COALESCE(s.name_en, found.name_en),
            name_bn = COALESCE(s.name_bn, found.name_bn),
            tags    = COALESCE(found.tags, '{}'::jsonb) || s.tags
        FROM (SELECT * FROM names LEFT JOIN contact USING (cand_id)) found
        WHERE s.cand_id = found.cand_id
        """,
        (list(CONTACT_KEYS),),
    )


def conflate_osm_and_overture(cur) -> dict:
    auto_merged = 0
    queued = 0

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
    seen_ovt: set[str] = set()

    for p in cur.fetchall():
        if p["ovt_id"] in seen_ovt:
            continue
        sim = float(p["name_sim"] or 0.0)
        if sim >= 0.55:
            seen_ovt.add(p["ovt_id"])
            ovt_tags = p["ovt_tags"]
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
                    json.dumps({k: ovt_tags.get(k) for k in CONTACT_KEYS}),
                    p["osm_id"],
                ),
            )
            cur.execute(
                "UPDATE places SET merged_into = %s::uuid, is_active = false, updated_at = now()"
                " WHERE id = %s::uuid",
                (p["osm_id"], p["ovt_id"]),
            )
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

    return {"auto_merged": auto_merged, "review_queued": queued}


def backfill_merged_into(conn) -> int:
    """Recomputes survivor -> loser pairs from merged_source_ids (Slice 0B.8)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE places loser
            SET merged_into = pair.survivor_id, is_active = false, updated_at = now()
            FROM (
              SELECT DISTINCT ON (member.source_id) member.source_id, s.id AS survivor_id
              FROM places s
              CROSS JOIN LATERAL jsonb_array_elements_text(s.merged_source_ids) AS member (source_id)
              WHERE s.overlay_type = 'food' AND s.source = 'osm'
              ORDER BY member.source_id, s.is_active DESC, s.updated_at DESC, s.id
            ) pair
            WHERE loser.source = 'overture' AND loser.source_id = pair.source_id
              AND loser.merged_into IS NULL
            """
        )
        updated = cur.rowcount
    conn.commit()
    return updated
