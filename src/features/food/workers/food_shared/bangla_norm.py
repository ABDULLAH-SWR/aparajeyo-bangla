"""Bangla & English text normalization using csebuetnlp/normalizer (Guide §5.4, §5.5, R9)."""

from __future__ import annotations

import re

from normalizer import normalize as buet_normalize

BENGALI_BLOCK_RE = re.compile(r"[\u0980-\u09FF]")
LATIN_LETTER_RE = re.compile(r"[A-Za-z]")
WHITESPACE_RE = re.compile(r"\s+")
PUNCT_RE = re.compile(r"[^\w\u0980-\u09FF\s]", re.UNICODE)

_RAW_SUFFIXES = (
    "restaurant",
    "hotel",
    "cafe",
    "coffee",
    "house",
    "corner",
    "kitchen",
    "রেস্তোরাঁ",
    "রেস্তোরা",
    "রেস্টুরেন্ট",
    "হোটেল",
    "ক্যাফে",
    "হাউস",
)

BN_TRANSLIT = {
    "অ": "o",
    "আ": "a",
    "ই": "i",
    "ঈ": "i",
    "উ": "u",
    "ঊ": "u",
    "ঋ": "ri",
    "এ": "e",
    "ঐ": "oi",
    "ও": "o",
    "ঔ": "ou",
    "া": "a",
    "ি": "i",
    "ী": "i",
    "ু": "u",
    "ূ": "u",
    "ৃ": "ri",
    "ে": "e",
    "ৈ": "oi",
    "ো": "o",
    "ৌ": "ou",
    "ং": "ng",
    "ঃ": "h",
    "ঁ": "",
    "ক": "k",
    "খ": "kh",
    "গ": "g",
    "ঘ": "gh",
    "ঙ": "ng",
    "চ": "ch",
    "ছ": "chh",
    "জ": "j",
    "ঝ": "jh",
    "ঞ": "n",
    "ট": "t",
    "ঠ": "th",
    "ড": "d",
    "ঢ": "dh",
    "ণ": "n",
    "ত": "t",
    "থ": "th",
    "দ": "d",
    "ধ": "dh",
    "ন": "n",
    "প": "p",
    "ফ": "f",
    "ব": "b",
    "ভ": "bh",
    "ম": "m",
    "য": "j",
    "র": "r",
    "ল": "l",
    "শ": "sh",
    "ষ": "sh",
    "স": "s",
    "হ": "h",
    "ড়": "r",
    "ঢ়": "rh",
    "য়": "y",
    "ৎ": "t",
    "্": "",
}


def normalize_bangla(text: str | None) -> str:
    """Runs csebuetnlp/normalizer on Bangla/English strings (Rule R9)."""
    if not text:
        return ""
    cleaned = buet_normalize(text, unicode_norm="NFKC")
    return WHITESPACE_RE.sub(" ", cleaned).strip()


# Normalized like the text it is compared with, however the literals above were typed.
GENERIC_SUFFIXES = frozenset(normalize_bangla(s) for s in _RAW_SUFFIXES)


def strip_generic_suffixes(normalized: str) -> str:
    """Removes generic words such as "restaurant" from normalized text."""
    return " ".join(tok for tok in normalized.split() if tok not in GENERIC_SUFFIXES)


def contains_bengali(text: str | None) -> bool:
    return bool(text and BENGALI_BLOCK_RE.search(text))


def contains_latin(text: str | None) -> bool:
    return bool(text and LATIN_LETTER_RE.search(text))


def resolve_bilingual_names(
    name: str | None,
    name_en: str | None,
    name_bn: str | None,
) -> tuple[str | None, str | None]:
    """Assigns name_en / name_bn per Guide §5.5 without machine translating."""
    en = normalize_bangla(name_en) if name_en else None
    bn = normalize_bangla(name_bn) if name_bn else None
    raw = normalize_bangla(name) if name else None

    if raw:
        if contains_bengali(raw) and not bn:
            bn = raw
        elif (not contains_bengali(raw) and contains_latin(raw) and not en) or (not bn and not en):
            en = raw

    return (en or None), (bn or None)


def normalize_match_key(text: str | None) -> str:
    if not text:
        return ""
    s = normalize_bangla(text).lower()
    return strip_generic_suffixes(PUNCT_RE.sub(" ", s))


def transliterate_bn_for_matching(text: str | None) -> str:
    """Internal phonetic romanization key for cross-script matching ONLY (never display)."""
    if not text:
        return ""
    s = normalize_bangla(text).lower()
    out: list[str] = []
    for ch in s:
        if ch in BN_TRANSLIT:
            out.append(BN_TRANSLIT[ch])
        elif ch.isalnum() or ch.isspace():
            out.append(ch)
        else:
            out.append(" ")
    return WHITESPACE_RE.sub(" ", "".join(out)).strip()
