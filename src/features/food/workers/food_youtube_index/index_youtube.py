"""Daily YouTube indexer using playlistItems.list & videos.list only (Guide §5.9, Rule R2)."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared.db import get_pg_connection, now_bst_iso  # noqa: E402

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
ISO_DUR_RE = re.compile(r"^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$")


def parse_iso_duration(dur: str) -> int:
    m = ISO_DUR_RE.match(dur or "")
    if not m:
        return 0
    return int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + int(m.group(3) or 0)


def channel_to_uploads_playlist(channel_id: str) -> str:
    return "UU" + channel_id[2:] if channel_id.startswith("UC") else channel_id


def register_channel(channel_id: str, title: str) -> None:
    conn = get_pg_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO youtube_channels (channel_id, uploads_playlist_id, title, overlay_type, is_active)
            VALUES (%s, %s, %s, 'food', true)
            ON CONFLICT (channel_id) DO UPDATE SET title = EXCLUDED.title, is_active = true
            """,
            (channel_id, channel_to_uploads_playlist(channel_id), title),
        )
    conn.commit()
    conn.close()


def index_channels(max_pages_per_channel: int = 5) -> dict:
    api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        return {"status": "skipped", "reason": "YOUTUBE_API_KEY not configured", "quota_units": 0}

    conn = get_pg_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM youtube_channels WHERE overlay_type = 'food' AND is_active")
        channels = cur.fetchall()

    if not channels:
        conn.close()
        return {"status": "skipped", "reason": "No active channels in youtube_channels", "quota_units": 0}

    quota_units = 0
    new_videos = 0
    now_iso = now_bst_iso()

    with httpx.Client(timeout=20.0) as client:
        for ch in channels:
            page_token: str | None = None
            seen_stop = ch["last_seen_video_id"]
            newest_id: str | None = None
            candidate_ids: list[str] = []

            for _ in range(max_pages_per_channel):
                params = {
                    "part": "snippet,contentDetails",
                    "playlistId": ch["uploads_playlist_id"],
                    "maxResults": 50,
                    "key": api_key,
                }
                if page_token:
                    params["pageToken"] = page_token
                resp = client.get(f"{YOUTUBE_API_BASE}/playlistItems", params=params)
                quota_units += 1
                resp.raise_for_status()
                body = resp.json()

                hit_known = False
                for item in body.get("items", []):
                    vid = item.get("contentDetails", {}).get("videoId")
                    if not vid:
                        continue
                    if newest_id is None:
                        newest_id = vid
                    if seen_stop and vid == seen_stop:
                        hit_known = True
                        break
                    candidate_ids.append(vid)

                page_token = body.get("nextPageToken")
                if hit_known or not page_token:
                    break

            for i in range(0, len(candidate_ids), 50):
                batch = candidate_ids[i : i + 50]
                resp = client.get(
                    f"{YOUTUBE_API_BASE}/videos",
                    params={
                        "part": "snippet,contentDetails,status",
                        "id": ",".join(batch),
                        "key": api_key,
                    },
                )
                quota_units += 1
                resp.raise_for_status()
                for v in resp.json().get("items", []):
                    status = v.get("status", {})
                    if status.get("privacyStatus") != "public" or not status.get("embeddable", False):
                        continue
                    snip = v.get("snippet", {})
                    dur = parse_iso_duration(v.get("contentDetails", {}).get("duration", ""))
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO youtube_videos (
                              video_id, channel_id, title, description,
                              published_at, duration_seconds, is_available, last_verified_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, true, %s)
                            ON CONFLICT (video_id) DO UPDATE SET
                              title = EXCLUDED.title,
                              description = EXCLUDED.description,
                              duration_seconds = EXCLUDED.duration_seconds,
                              is_available = true,
                              last_verified_at = EXCLUDED.last_verified_at
                            """,
                            (
                                v["id"],
                                ch["channel_id"],
                                snip.get("title", ""),
                                snip.get("description", ""),
                                snip.get("publishedAt", now_iso),
                                dur,
                                now_iso,
                            ),
                        )
                    new_videos += 1

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE youtube_channels
                    SET last_polled_at = %s, last_seen_video_id = COALESCE(%s, last_seen_video_id)
                    WHERE channel_id = %s
                    """,
                    (now_iso, newest_id, ch["channel_id"]),
                )

    conn.commit()
    conn.close()
    return {"status": "ok", "channels": len(channels), "new_videos": new_videos, "quota_units": quota_units}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--add-channel", nargs=2, metavar=("CHANNEL_ID", "TITLE"))
    args = parser.parse_args()
    if args.add_channel:
        register_channel(args.add_channel[0], args.add_channel[1])
    print(json.dumps(index_channels()))
