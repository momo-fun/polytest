#!/usr/bin/env python3
"""
Analyze historical YES price ranges for candidate-related markets on Polymarket.

Usage:
  python3 polymarket_candidate_yes_analysis.py --days 30 --out results.csv

Notes:
- Uses public Gamma API for market metadata and CLOB prices-history for time series.
- Candidate tag discovery is heuristic (label/slug contains "candidate").
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Iterable, List, Optional, Tuple

GAMMA_BASE = "https://gamma-api.polymarket.com"
CLOB_BASE = "https://clob.polymarket.com"


# ------------------------- HTTP helpers -------------------------

def build_ssl_context(insecure: bool = False) -> ssl.SSLContext:
    if insecure:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def http_get_json(
    url: str,
    params: Optional[Dict[str, Any]] = None,
    ssl_context: Optional[ssl.SSLContext] = None,
) -> Any:
    if params:
        qs = urllib.parse.urlencode(params, doseq=True)
        url = f"{url}?{qs}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "polymarket-candidate-yes-analysis/1.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=ssl_context) as resp:
            return json.load(resp)
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        raise SystemExit(
            f"Network error while fetching {url}: {reason}. "
            "If you are behind a proxy or have no DNS, this script cannot reach Polymarket APIs. "
            "Try again on a networked machine or check your DNS settings."
        ) from e


def jsonish(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


# ------------------------- Stats helpers -------------------------

def quantile(sorted_vals: List[float], q: float) -> float:
    if not sorted_vals:
        return float("nan")
    if q <= 0:
        return sorted_vals[0]
    if q >= 1:
        return sorted_vals[-1]
    n = len(sorted_vals)
    idx = (n - 1) * q
    lo = int(math.floor(idx))
    hi = int(math.ceil(idx))
    if lo == hi:
        return sorted_vals[lo]
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (idx - lo)


def summarize(values: List[float]) -> Dict[str, float]:
    values = sorted(values)
    return {
        "min": values[0],
        "p05": quantile(values, 0.05),
        "p10": quantile(values, 0.10),
        "p25": quantile(values, 0.25),
        "p50": quantile(values, 0.50),
        "p75": quantile(values, 0.75),
        "max": values[-1],
    }


# ------------------------- Polymarket helpers -------------------------

def list_candidate_tags(
    ssl_context: Optional[ssl.SSLContext],
    contains: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    tags = http_get_json(f"{GAMMA_BASE}/tags", {"limit": 500}, ssl_context)
    needles = [c.lower() for c in (contains or ["candidate"])]
    matched: List[Dict[str, Any]] = []
    for t in tags:
        label = (t.get("label") or "").lower()
        slug = (t.get("slug") or "").lower()
        if any(n in label or n in slug for n in needles):
            matched.append(t)
    return matched


def iter_markets_by_tag(tag_id: int, ssl_context: Optional[ssl.SSLContext], limit: int = 200) -> Iterable[Dict[str, Any]]:
    offset = 0
    while True:
        params = {
            "tag_id": tag_id,
            "active": True,
            "closed": False,
            "limit": limit,
            "offset": offset,
            "order": "volume_num",
            "ascending": False,
        }
        page = http_get_json(f"{GAMMA_BASE}/markets", params, ssl_context)
        if not page:
            break
        for m in page:
            yield m
        if len(page) < limit:
            break
        offset += limit


def iter_markets_search(query: str, ssl_context: Optional[ssl.SSLContext], limit: int = 200) -> Iterable[Dict[str, Any]]:
    offset = 0
    while True:
        params = {
            "search": query,
            "active": True,
            "closed": False,
            "limit": limit,
            "offset": offset,
            "order": "volume_num",
            "ascending": False,
        }
        page = http_get_json(f"{GAMMA_BASE}/markets", params, ssl_context)
        if not page:
            break
        for m in page:
            yield m
        if len(page) < limit:
            break
        offset += limit


def pick_yes_token(market: Dict[str, Any]) -> Optional[Tuple[float, str]]:
    outcomes = jsonish(market.get("outcomes"))
    prices = jsonish(market.get("outcomePrices"))
    clob_ids = jsonish(market.get("clobTokenIds"))

    if not isinstance(outcomes, list) or not isinstance(prices, list) or not isinstance(clob_ids, list):
        return None

    # Normalize
    outcomes = [str(o) for o in outcomes]
    try:
        prices_f = [float(p) for p in prices]
    except Exception:
        return None

    # Only handle YES/NO style markets
    try:
        yes_idx = next(i for i, o in enumerate(outcomes) if o.strip().lower() == "yes")
    except StopIteration:
        return None

    if yes_idx >= len(prices_f) or yes_idx >= len(clob_ids):
        return None

    yes_price = prices_f[yes_idx]
    yes_token = str(clob_ids[yes_idx])
    return yes_price, yes_token


def fetch_history(
    token_id: str,
    start_ts: int,
    end_ts: int,
    ssl_context: Optional[ssl.SSLContext],
    fidelity: int = 60,
) -> List[float]:
    params = {
        "market": token_id,
        "startTs": start_ts,
        "endTs": end_ts,
        "fidelity": fidelity,  # minutes
    }
    data = http_get_json(f"{CLOB_BASE}/prices-history", params, ssl_context)
    history = data.get("history") or []
    prices = []
    for pt in history:
        try:
            prices.append(float(pt.get("p")))
        except Exception:
            continue
    return prices


# ------------------------- Main -------------------------

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--tag-id", action="append", type=int, default=[],
                    help="Use explicit tag id(s); can be repeated. If omitted, auto-detects candidate tags.")
    ap.add_argument("--max-markets", type=int, default=200)
    ap.add_argument("--sleep", type=float, default=0.15, help="Sleep between history requests (seconds).")
    ap.add_argument("--out", type=str, default="", help="Optional CSV output path.")
    ap.add_argument("--list-candidate-tags", action="store_true",
                    help="Print candidate-like tags (label/slug contains 'candidate') and exit.")
    ap.add_argument("--list-tags", action="store_true",
                    help="Print all tags (id, label, slug) and exit.")
    ap.add_argument("--tag-contains", action="append", default=[],
                    help="Filter tags by substring (case-insensitive). Can be repeated.")
    ap.add_argument("--search", type=str, default="",
                    help="Use Gamma /markets search query instead of tags.")
    ap.add_argument("--insecure", action="store_true",
                    help="Disable TLS cert verification (not recommended).")
    args = ap.parse_args()

    now = int(time.time())
    start_ts = now - args.days * 24 * 60 * 60
    ssl_context = build_ssl_context(insecure=args.insecure)

    if args.list_tags:
        all_tags = http_get_json(f"{GAMMA_BASE}/tags", {"limit": 500}, ssl_context)
        for t in all_tags:
            print(f"{t.get('id')}\t{t.get('label')}\t{t.get('slug')}")
        return

    contains = args.tag_contains if args.tag_contains else None
    candidate_tags = list_candidate_tags(ssl_context, contains=contains)
    if args.list_candidate_tags:
        for t in candidate_tags:
            print(f"{t.get('id')}\t{t.get('label')}\t{t.get('slug')}")
        return

    rows: List[Dict[str, Any]] = []
    seen_market_ids = set()

    if args.search:
        market_iter = iter_markets_search(args.search, ssl_context)
        tag_ids: List[int] = []
    else:
        tag_ids = args.tag_id or sorted({int(t.get("id")) for t in candidate_tags if t.get("id") is not None})
        if not tag_ids:
            raise SystemExit(
                "No matching tags found. Try --list-tags, --tag-contains election, or pass --tag-id explicitly."
            )
        market_iter = (m for tag_id in tag_ids for m in iter_markets_by_tag(tag_id, ssl_context))

    for m in market_iter:
        mid = m.get("id")
        if mid in seen_market_ids:
            continue
        seen_market_ids.add(mid)

        if len(rows) >= args.max_markets:
            break

        picked = pick_yes_token(m)
        if not picked:
            continue

        yes_price, yes_token = picked
        prices = fetch_history(yes_token, start_ts, now, ssl_context)
        if len(prices) < 10:
            continue

        stats = summarize(prices)
        row = {
            "market_id": mid,
            "title": m.get("title") or m.get("question") or m.get("slug"),
            "yes_current": yes_price,
            "hist_min": stats["min"],
            "hist_p05": stats["p05"],
            "hist_p10": stats["p10"],
            "hist_p25": stats["p25"],
            "hist_p50": stats["p50"],
            "hist_p75": stats["p75"],
            "hist_max": stats["max"],
            "n_points": len(prices),
            "tag_id": m.get("tag_id"),
        }
        rows.append(row)
        time.sleep(args.sleep)

    # Sort by how far below 5th percentile current price is (negative = below)
    def score(r: Dict[str, Any]) -> float:
        return r["yes_current"] - r["hist_p05"]

    rows.sort(key=score)

    # Print summary
    if args.search:
        print(f"Search query used: {args.search}")
    else:
        print(f"Tag IDs used: {tag_ids}")
    print(f"Markets analyzed: {len(rows)}")
    print("Top 20 markets with current YES below 5th percentile:")
    for r in rows[:20]:
        delta = r["yes_current"] - r["hist_p05"]
        print(f"- {r['title']} | YES now {r['yes_current']:.4f} | p05 {r['hist_p05']:.4f} | delta {delta:.4f}")

    if args.out:
        with open(args.out, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [])
            if rows:
                w.writeheader()
                w.writerows(rows)
        print(f"Wrote CSV to {args.out}")


if __name__ == "__main__":
    main()
