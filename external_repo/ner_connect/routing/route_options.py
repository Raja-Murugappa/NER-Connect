"""
Route options at planning time.

Gives the operator the main road route plus up to two genuinely different real roads between
the same places, each cut into sectors and risk-scored so they can be compared side by side.
The platform informs; the operator chooses (SIH26002_PROJECT_CONTEXT_README.md, section 11) -
a riskier route may be the right call for an urgent delivery.

Where the options come from:
  1. OSRM's own alternatives (often none on North East roads).
  2. Routes forced past "side points" to the left and right of the main road, which makes OSRM
     use other roads. Every option is still a real road route; nothing is drawn by hand.
"""
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from ner_connect.routing.route_engine import (
    get_osrm_route_alternatives, get_osrm_route_via, RoutingUnavailableError,
)
from ner_connect.routing.segmenter import segment_route
from ner_connect.intelligence.risk_engine import evaluate_sectors, format_eta
from ner_connect.utils.geo_math import (
    to_array, cumulative_km, overlap_fraction, side_points, has_out_and_back,
)

RISK_RANK = {"safe": 0, "caution": 1, "danger": 2}

MAX_ALTERNATIVES = 2          # options shown besides the main route
DUPLICATE_OVERLAP = 0.9       # routes sharing this much road are the same option
MIN_DIFFERENT_SHARE = 0.3     # an option must use at least 30% different road from the main route
MAX_LENGTH_FACTOR = 1.6       # ...and be at most 60% longer than it
PROBE_FRACTIONS = (0.35, 0.65)  # where along the main route side points are placed
PARALLEL_REQUESTS = 3


def summarize_risk(sector_cards: list) -> dict:
    """Worst level plus how many sectors / km fall in each risk level."""
    counts = {level: 0 for level in RISK_RANK}
    km = {level: 0.0 for level in RISK_RANK}
    for card in sector_cards:
        counts[card["risk_level"]] += 1
        km[card["risk_level"]] += card["distance_km"]
    worst = max((c["risk_level"] for c in sector_cards), key=RISK_RANK.get, default="safe")
    return {"worst": worst, "sector_counts": counts, "km_by_level": {k: round(v, 1) for k, v in km.items()}}


def score_route(route_info: dict, road_name: str, scenario: str = "1",
                state: str = "", district: str = "") -> dict:
    """Cuts a route into sectors and risk-scores them. Returns sectors, ETA and a risk summary."""
    sectors = segment_route(route_info, road_name, state, district)
    cards, total_mins = evaluate_sectors(sectors, scenario)
    return {"sectors": cards, "eta_mins": int(total_mins), "eta": format_eta(total_mins),
            "risk": summarize_risk(cards)}


def _candidate_routes(start_coords: tuple, end_coords: tuple, primary: np.ndarray) -> list:
    """OSRM alternatives plus routes forced past side points. Raises RoutingUnavailableError
    only if every request failed."""
    cum = cumulative_km(primary)
    total_km = float(cum[-1])
    base = float(np.clip(total_km * 0.1, 8.0, 30.0))
    vias = []
    for fraction in PROBE_FRACTIONS:
        idx = int(np.clip(np.searchsorted(cum, fraction * total_km), 0, len(primary) - 1))
        vias += side_points(primary, idx - 20, idx + 20, primary[idx], (base, base * 2))

    def fetch(job):
        try:
            if job is None:
                return get_osrm_route_alternatives(start_coords, end_coords)
            return [get_osrm_route_via([start_coords, job, end_coords])]
        except RoutingUnavailableError:
            return None

    jobs = [None] + vias
    with ThreadPoolExecutor(max_workers=PARALLEL_REQUESTS) as pool:
        results = list(pool.map(fetch, jobs))
    if all(r is None for r in results):
        raise RoutingUnavailableError("every routing request failed")
    return [route for r in results if r for route in r]


def find_distinct_routes(start_coords: tuple, end_coords: tuple, primary_polyline: list,
                         max_count: int) -> list:
    """
    Up to max_count real alternative road routes between two places, excluding the primary
    route and near-duplicates (see the module docstring's filters), shortest first. Returns
    (route, polyline_array) pairs. Shared by get_alternative_options (which scores each one
    for display) and district route-accessibility counting (which only needs how many
    genuinely different roads exist). Raises RoutingUnavailableError if OSRM cannot be reached.
    """
    primary = to_array(primary_polyline)
    primary_km = float(cumulative_km(primary)[-1])
    chosen = []
    for route in sorted(_candidate_routes(start_coords, end_coords, primary), key=lambda r: r["distance_km"]):
        line = to_array(route["polyline"])
        if route["distance_km"] > primary_km * MAX_LENGTH_FACTOR:
            continue
        if 1 - overlap_fraction(line, primary) < MIN_DIFFERENT_SHARE:
            continue
        if has_out_and_back(line):
            continue
        if any(overlap_fraction(line, other) >= DUPLICATE_OVERLAP for _, other in chosen):
            continue
        chosen.append((route, line))
        if len(chosen) == max_count:
            break
    return chosen


def get_alternative_options(start_coords: tuple, end_coords: tuple, primary_polyline: list,
                            road_name: str, scenario: str = "1") -> list:
    """
    Up to MAX_ALTERNATIVES real alternative road routes between the two places, each scored
    like the primary. Raises RoutingUnavailableError if OSRM cannot be reached.
    """
    chosen = find_distinct_routes(start_coords, end_coords, primary_polyline, MAX_ALTERNATIVES)
    return [{
        "polyline": route["polyline"],
        "distance_km": route["distance_km"],
        "junctions": route.get("junctions", []),
        "bridges": route.get("bridges", []),
        **score_route(route, road_name, scenario),
    } for route, _ in chosen]
