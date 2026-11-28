"""Pure category and cuisine classification for OSM and Overture records (Guide §5.2-5.3)."""

from __future__ import annotations


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
    elif (amenity == "vending_machine" and vending == "food") or (shop == "kiosk" and cuisine_raw):
        category = "street_food"

    if category is None:
        return None, []
    if any(kw in cuisine_raw for kw in ("sweets", "mishti")):
        category = "sweets_bakery"
    elif "dessert" in cuisine_raw and category == "other":
        category = "dessert"

    return category, extract_cuisines(f"{cuisine_raw} {name_blob}", category, cmap)


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

    if not category:
        fallback = cmap["overture_fallback_map"]
        category = next((fallback[h] for h in hierarchy if h in fallback), None)

    if not category:
        return None, []

    blob = " ".join(candidates)
    return category, extract_cuisines(blob, category, cmap)
