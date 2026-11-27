"""Matches indexed YouTube videos to PostGIS food places using csebuetnlp/normalizer & chapters (Guide §5.10)."""

from __future__ import annotations

import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared.bangla_norm import normalize_match_key, transliterate_bn_for_matching  # noqa: E402
from shared.db import get_pg_connection, load_geo_codes  # noqa: E402

CHAPTER_RE = re.compile(r"^\s*(?:(\d+):)?(\d{1,2}):(\d{2})\s+[-–|:]?\s*(.+)$", re.MULTILINE)

AREA_ALIASES = {
    "old dhaka": "BD3026",
    "puran dhaka": "BD3026",
    "পুরান ঢাকা": "BD3026",
    "dhanmondi": "BD3026",
    "gulshan": "BD3026",
    "banani": "BD3026",
    "mirpur": "BD3026",
    "uttara": "BD3026",
    "chittagong": "BD2015",
    "cox's bazar": "BD2022",
    "coxs bazar": "BD2022",
    "bogra": "BD5010",
}


def detect_candidate_districts(text: str, geo_codes: dict) -> set[str]:
    lower = text.lower()
    matched: set[str] = set()
    for alias, pcode in AREA_ALIASES.items():
        if alias in lower:
            matched.add(pcode)
    for d in geo_codes.get("districts", []):
        if d["name_en"].lower() in lower or (d["name_bn"] and d["name_bn"] in text):
            matched.add(d["id"])
    return matched


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return max(0.88, SequenceMatcher(None, a, b).ratio())
    return SequenceMatcher(None, a, b).ratio()


def match_segment(
    segment_text: str,
    candidates: list[dict],
    *,
    district_detected: bool,
    chapter_line: bool,
) -> list[dict]:
    """Scores one title or chapter line against candidate places, best match first."""
    seg_norm = normalize_match_key(segment_text)
    seg_roman = transliterate_bn_for_matching(segment_text)
    matches: list[dict] = []

    for p in candidates:
        if len(p["norm_en"]) < 4 and len(p["norm_bn"]) < 4:
            continue
        score = 0.0
        for key, segment in (
            (p["norm_en"], seg_norm),
            (p["norm_bn"], seg_norm),
            (p["roman"], seg_roman),
        ):
            key_score = similarity(key, segment)
            if f" {key} " not in f" {segment} ":
                key_score = min(key_score, 0.60)
            elif len(key) < 6 or not (district_detected or chapter_line):
                key_score = min(key_score, 0.84)  # pending review, never auto-approved
            score = max(score, key_score)
        if score >= 0.50:
            matches.append({"place_id": p["id"], "confidence": round(min(score, 0.99), 2)})

    return sorted(matches, key=lambda m: m["confidence"], reverse=True)


def run_matching() -> dict:
    conn = get_pg_connection()
    geo = load_geo_codes()

    with conn.cursor() as cur:
        cur.execute("SELECT video_id, title, description FROM youtube_videos WHERE is_available")
        videos = cur.fetchall()
        if not videos:
            conn.close()
            return {"videos_checked": 0, "matches_upserted": 0}

        cur.execute(
            "SELECT id::text AS id, district_id, name_en, name_bn FROM places WHERE overlay_type = 'food' AND is_active AND NOT is_hidden"
        )
        places = cur.fetchall()

    places_by_dist: dict[str, list[dict]] = {}
    for p in places:
        places_by_dist.setdefault(p["district_id"], []).append({
            "id": p["id"],
            "norm_en": normalize_match_key(p["name_en"]),
            "norm_bn": normalize_match_key(p["name_bn"]),
            "roman": transliterate_bn_for_matching(p["name_bn"] or p["name_en"]),
        })

    upserted = 0

    with conn.cursor() as cur:
        for v in videos:
            full_text = f"{v['title']}\n{v['description'] or ''}"
            dist_ids = detect_candidate_districts(full_text, geo)
            if not dist_ids:
                continue

            candidates = [p for did in dist_ids for p in places_by_dist.get(did, [])]
            chapters = CHAPTER_RE.findall(v["description"] or "")
            segments: list[tuple[str, int | None, str]] = [
                (c_text, int(h or 0) * 3600 + int(m) * 60 + int(s), "chapter")
                for h, m, s, c_text in chapters
            ]
            if not segments:
                segments.append((v["title"], None, "title_fuzzy"))

            for seg_text, start_sec, method in segments:
                matches = match_segment(
                    seg_text,
                    candidates,
                    district_detected=True,  # candidates come only from detected districts
                    chapter_line=method == "chapter",
                )

                if matches:
                    conf = matches[0]["confidence"]
                    status = "auto_approved" if conf >= 0.85 else "pending"
                    cur.execute(
                        """
                        INSERT INTO video_place_matches (
                          video_id, place_id, confidence, method, start_seconds, status
                        ) VALUES (%s, %s::uuid, %s, %s, %s, %s)
                        ON CONFLICT (video_id, place_id) DO UPDATE SET
                          confidence = EXCLUDED.confidence,
                          method = EXCLUDED.method,
                          start_seconds = COALESCE(EXCLUDED.start_seconds, video_place_matches.start_seconds)
                        """,
                        (v["video_id"], matches[0]["place_id"], conf, method, start_sec, status),
                    )
                    upserted += 1

    conn.commit()
    conn.close()
    return {"videos_checked": len(videos), "matches_upserted": upserted}


if __name__ == "__main__":
    print(json.dumps(run_matching()))
