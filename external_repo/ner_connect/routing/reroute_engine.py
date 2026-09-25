"""
Dynamic Rerouting Engine.

Answers: "A disruption was just reported. Does it affect this truck's upcoming route,
and if the road ahead is blocked, how can the truck get around it from where it is now?"

Flow (see SIH26002_PROJECT_CONTEXT_README.md, sections 4 and 18):
  disruption -> on the active route? -> ahead of the truck? -> blocking?
             -> search for a local bypass around the blocked stretch
             -> discard bypasses through the disruption -> score the rerouted journeys
                with the risk engine -> recommend.
The operator makes the final decision; nothing here switches routes automatically.

Why a *local* bypass: OSRM (the free OpenStreetMap router) cannot be told "avoid this area",
and asking it for alternatives to the destination mostly returns the same blocked road.
So we ask for routes between a point before the blockage and a point after it (short
requests are also much faster), and additionally force OSRM onto other roads by routing
through "side points" on either side of the blockage.

Simulation outcomes (the journey is simulated, so the operator can script the scenario):
  auto          - real check at the reported spot
  force_reroute - if the spot has no real road detour, the disruption is moved to the nearest
                  spot ahead that has one (the detour itself is always a real road)
  force_hold    - simulates "every detour here is closed too": no search, hold the vehicle
"""
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from ner_connect.routing.route_engine import get_osrm_candidates, RoutingUnavailableError
from ner_connect.routing.route_options import score_route, RISK_RANK
from ner_connect.intelligence.open_data_service import find_checkposts_along_route
from ner_connect.utils.geo_math import (
    to_array, cumulative_km, distances_to_point, distances_to_route, side_points, has_out_and_back,
)

DIVERGENCE_TOLERANCE_KM = 0.3   # a detour "leaves" the current road once it is this far from it
HOLD_SHORT_KM = 2.0             # default holding position before a disruption when no checkpost exists

# Local bypass search
BYPASS_WINDOWS_KM = (25, 60, 120)   # leave / rejoin the route this far before / after the blockage
VIA_OFFSETS_KM = (10, 25)           # side points either side of the blockage that force other roads
MAX_DETOURS = 3
MAX_DETOUR_FACTOR = 4.0             # reject bypasses much longer than the stretch they replace
OSRM_PARALLEL_REQUESTS = 3

# force_reroute: other spots tried when the reported spot has no real detour
PROBE_STEP_KM = 25
PROBE_MAX_SPOTS = 8
PROBE_WINDOW_KM = 60
PROBE_VIA_OFFSET_KM = 15

OUTCOMES = ("auto", "force_reroute", "force_hold")

DISRUPTION_LABELS = {
    "landslide": "Landslide",
    "flood": "Flood / waterlogging",
    "bridge_closure": "Bridge closure",
    "road_block": "Road blockage",
}


# ─── Geometry helpers ─────────────────────────────────────────────────────────

def _index_at_km(cum: np.ndarray, km: float) -> int:
    return int(np.clip(np.searchsorted(cum, km), 0, len(cum) - 1))

def _divergence_point(alternative: np.ndarray, current: np.ndarray) -> list:
    """First point where the alternative leaves the current road (both start at the truck)."""
    off_road = np.where(distances_to_route(alternative, current) > DIVERGENCE_TOLERANCE_KM)[0]
    idx = max(int(off_road[0]) - 1, 0) if off_road.size else 0
    return [float(alternative[idx, 0]), float(alternative[idx, 1])]


# ─── Route evaluation helpers ─────────────────────────────────────────────────

def _hold_point(route: np.ndarray, cum: np.ndarray, truck_idx: int, disruption_idx: int, disruption_km: float) -> dict:
    """Where the truck should wait if it can't get around: the last checkpost before the
    disruption, otherwise a point HOLD_SHORT_KM before it (or the truck's own position)."""
    approach = route[truck_idx:disruption_idx + 1].tolist()
    checkposts = find_checkposts_along_route(approach, max_dist_km=5.0) if len(approach) > 1 else []
    if checkposts:
        cp = max(checkposts, key=lambda c: c["route_index"])
        km = float(cum[truck_idx + cp["route_index"]])
        return {"name": cp["name"], "type": "checkpost", "coords": list(cp["coords"]), "km": round(km, 1)}

    km = max(float(cum[truck_idx]), disruption_km - HOLD_SHORT_KM)
    return {"name": f"Safe stop before disruption (km {km:.1f})", "type": "roadside",
            "coords": [float(v) for v in route[_index_at_km(cum, km)]], "km": round(km, 1)}

def _blocked_span(dist_to_center: np.ndarray, radius: float, truck_idx: int):
    """(first, last) route indices of the disruption zone ahead of the truck, or None."""
    ahead = np.where(dist_to_center <= radius)[0]
    ahead = ahead[ahead >= truck_idx]
    return (int(ahead[0]), int(ahead[-1])) if ahead.size else None


# ─── Detour search ────────────────────────────────────────────────────────────

def _search_detours(route, cum, truck_idx, first, last, center, radius, windows, via_offsets):
    """
    Looks for real-road bypasses around route[first:last]. Returns (detours, stats) where each
    detour is {"polyline", "distance_km", "exit_km", "rejoin_km"} describing the whole remaining
    journey (truck -> bypass -> back on the route -> destination).
    Raises RoutingUnavailableError only if every routing request failed.
    """
    stats = {"requests": 0, "failed": 0, "routes_checked": 0, "rejected": 0}
    for window in windows:
        exit_idx = _index_at_km(cum, max(cum[truck_idx], cum[first] - window))
        rejoin_idx = _index_at_km(cum, min(cum[-1], cum[last] + window))
        exit_idx = min(exit_idx, first)
        rejoin_idx = max(rejoin_idx, last)
        exit_pt, rejoin_pt = tuple(route[exit_idx]), tuple(route[rejoin_idx])
        replaced_km = float(cum[rejoin_idx] - cum[exit_idx])

        requests = [[exit_pt, rejoin_pt]] + [[exit_pt, via, rejoin_pt]
                                             for via in side_points(route, first - 20, last + 20, center, via_offsets)]

        def fetch(waypoints):
            try:
                return get_osrm_candidates(waypoints)
            except RoutingUnavailableError:
                return None

        with ThreadPoolExecutor(max_workers=OSRM_PARALLEL_REQUESTS) as pool:
            responses = list(pool.map(fetch, requests))
        stats["requests"] += len(requests)
        stats["failed"] += sum(r is None for r in responses)

        detours = {}
        for cand in (c for r in responses if r for c in r):
            stats["routes_checked"] += 1
            line = to_array(cand["polyline"])
            if (distances_to_point(line, center).min() <= radius          # still goes through it
                    or cand["distance_km"] > replaced_km * MAX_DETOUR_FACTOR + 30  # absurdly long
                    or has_out_and_back(line)):                                   # out-and-back dead end
                stats["rejected"] += 1
                continue
            composite = np.vstack([route[truck_idx:exit_idx], line, route[rejoin_idx + 1:]])
            total_km = float(cum[exit_idx] - cum[truck_idx]) + cand["distance_km"] + float(cum[-1] - cum[rejoin_idx])
            key = round(total_km)  # side points often lead to the same bypass
            if key not in detours:
                detours[key] = {"polyline": composite.tolist(), "distance_km": round(total_km, 1),
                                "exit_km": round(float(cum[exit_idx]), 1), "rejoin_km": round(float(cum[rejoin_idx]), 1)}
        if detours:
            return sorted(detours.values(), key=lambda d: d["distance_km"])[:MAX_DETOURS], stats

    if stats["requests"] and stats["failed"] == stats["requests"]:
        raise RoutingUnavailableError("every routing request failed")
    return [], stats


# ─── Main entry point ────────────────────────────────────────────────────────

def evaluate_disruption(current_route: list, truck_position: tuple, disruption: dict,
                        road_name: str = "Active Journey", scenario: str = "1",
                        outcome: str = "auto") -> dict:
    """
    current_route:  the active route as [[lat, lon], ...] from journey start to destination
    truck_position: (lat, lon) of the vehicle now
    disruption:     {"lat", "lon", "radius_km", "type", "severity": "caution" | "blocked"}
    outcome:        "auto" | "force_reroute" | "force_hold" (simulation control, see module docstring)

    Returns a dict whose "status" is one of:
      NOT_ON_ROUTE, BEHIND, ADVISORY, REROUTE_AVAILABLE, NO_ALTERNATIVE, ROUTING_UNAVAILABLE
    """
    route = to_array(current_route)
    if len(route) < 2:
        raise ValueError("current_route must contain at least two points")
    if outcome not in OUTCOMES:
        raise ValueError(f"outcome must be one of {OUTCOMES}")

    cum = cumulative_km(route)
    center = (float(disruption["lat"]), float(disruption["lon"]))
    radius = float(disruption.get("radius_km", 2.0))
    severity = disruption.get("severity", "blocked")
    label = DISRUPTION_LABELS.get(disruption.get("type"), "Disruption")

    truck_idx = int(np.argmin(distances_to_point(route, truck_position)))
    truck_km = float(cum[truck_idx])
    dist_to_center = distances_to_point(route, center)

    result = {
        "truck_km": round(truck_km, 1),
        "route_total_km": round(float(cum[-1]), 1),
        "disruption": {**disruption, "label": label, "radius_km": radius},
        "outcome": outcome,
        "affected_polyline": [],
        "alternatives": [],
    }

    # 1. Is the disruption on the route at all?
    if not np.any(dist_to_center <= radius):
        nearest_km = float(dist_to_center.min())
        return {**result, "status": "NOT_ON_ROUTE",
                "message": f"{label} is {nearest_km:.1f} km from the route. No impact on this journey."}

    # 2. Is it ahead of the truck?
    span = _blocked_span(dist_to_center, radius, truck_idx)
    if span is None:
        return {**result, "status": "BEHIND",
                "message": f"{label} is on a stretch the truck has already passed. No action needed."}

    def describe(first, last):
        km = float(cum[first])
        result.update({
            "disruption_km": round(km, 1),
            "distance_ahead_km": round(km - truck_km, 1),
            "affected_polyline": route[first:last + 1].tolist(),
        })
        return f"{label} {km - truck_km:.1f} km ahead (route km {km:.1f})"

    first, last = span
    where = describe(first, last)

    # 3. A caution doesn't block the road: warn, keep the route.
    if severity != "blocked":
        return {**result, "status": "ADVISORY",
                "message": f"{where}. Road still passable: reduce speed and proceed with caution."}

    # 4. Blocked.
    remaining = route[truck_idx:]
    remaining_km = round(float(cum[-1] - truck_km), 1)
    current = score_route({"polyline": remaining.tolist(), "distance_km": remaining_km}, road_name, scenario)
    result["current_remaining"] = {"distance_km": remaining_km, "eta_mins": current["eta_mins"], "eta": current["eta"]}
    result["hold_point"] = _hold_point(route, cum, truck_idx, first, float(cum[first]))

    if first == truck_idx:
        return {**result, "status": "NO_ALTERNATIVE",
                "message": f"{label}: the truck is already inside the disruption zone. Stop and wait for clearance."}

    if outcome == "force_hold":
        return {**result, "status": "NO_ALTERNATIVE", "simulated": True,
                "message": f"{where}. Simulated scenario: every detour around it is closed too. "
                           f"Hold at {result['hold_point']['name']}."}

    # 5. Look for a real-road bypass around the blocked stretch.
    try:
        detours, stats = _search_detours(route, cum, truck_idx, first, last, center, radius,
                                         BYPASS_WINDOWS_KM, VIA_OFFSETS_KM)
        if not detours and outcome == "force_reroute":
            detours, stats, moved = _relocate_to_detour(route, cum, truck_idx, first, radius, stats)
            if moved:
                clicked_km = float(cum[first])
                center, first, last = moved
                result["relocated_from"] = {"lat": float(disruption["lat"]), "lon": float(disruption["lon"]),
                                            "km": round(clicked_km, 1)}
                result["disruption"] = {**result["disruption"], "lat": center[0], "lon": center[1]}
                result["hold_point"] = _hold_point(route, cum, truck_idx, first, float(cum[first]))
                where = (f"No real road detour exists around route km {clicked_km:.1f} (single-road stretch), "
                         f"so the simulated {label.lower()} was moved to the nearest spot with one. ") + describe(first, last)
    except RoutingUnavailableError as e:
        return {**result, "status": "ROUTING_UNAVAILABLE",
                "message": f"{where}. Road blocked, but the routing service is unreachable ({e}), so no "
                           f"detour search could be done. Hold at {result['hold_point']['name']} and retry."}

    result["search"] = stats
    alternatives = []
    for d in detours:
        line = to_array(d["polyline"])
        scored = score_route(d, road_name, scenario)
        alternatives.append({
            "polyline": d["polyline"],
            "distance_km": d["distance_km"],
            "extra_km": round(d["distance_km"] - remaining_km, 1),
            "eta_mins": scored["eta_mins"],
            "eta": scored["eta"],
            "extra_mins": scored["eta_mins"] - current["eta_mins"],
            "worst_risk": scored["risk"]["worst"],
            "risk": scored["risk"],
            "sectors": scored["sectors"],
            "junctions": [],
            "bridges": [],
            "divergence_point": _divergence_point(line, remaining),
            "bypass": {"exit_km": d["exit_km"], "rejoin_km": d["rejoin_km"]},
        })

    # Recommend the lowest-risk option, then the fastest. The operator still decides.
    alternatives.sort(key=lambda a: (RISK_RANK[a["worst_risk"]], a["eta_mins"]))
    for i, alt in enumerate(alternatives):
        alt["id"] = f"ALT-{i + 1}"
        alt["recommended"] = i == 0
    result["alternatives"] = alternatives

    if not alternatives:
        scope = (f"within {PROBE_MAX_SPOTS * PROBE_STEP_KM} km of it on the upcoming route"
                 if outcome == "force_reroute" else "around it")
        return {**result, "status": "NO_ALTERNATIVE",
                "message": f"{where}. Road blocked and no real road detour exists {scope} "
                           f"({stats['routes_checked']} candidate routes checked). "
                           f"Hold at {result['hold_point']['name']}."}

    best = alternatives[0]
    return {**result, "status": "REROUTE_AVAILABLE",
            "message": f"{where}. Road blocked. {len(alternatives)} detour(s) found; "
                       f"recommended adds {best['extra_km']:+.1f} km and {best['extra_mins']:+d} min."}


def _relocate_to_detour(route, cum, truck_idx, first, radius, stats):
    """
    force_reroute: try spots along the upcoming route, nearest to the reported one first, until
    one has a real-road detour. Returns (detours, stats, (center, first, last) or None).
    """
    start_km = float(cum[truck_idx]) + radius + 5
    end_km = float(cum[-1]) - radius - 5
    clicked_km = float(cum[first])
    spots = sorted({round(clicked_km + sign * k * PROBE_STEP_KM, 1)
                    for k in range(1, PROBE_MAX_SPOTS + 1) for sign in (1, -1)},
                   key=lambda km: abs(km - clicked_km))
    spots = [km for km in spots if start_km <= km <= end_km][:PROBE_MAX_SPOTS]

    for km in spots:
        center = tuple(float(v) for v in route[_index_at_km(cum, km)])
        span = _blocked_span(distances_to_point(route, center), radius, truck_idx)
        if span is None:
            continue
        p_first, p_last = span
        try:
            detours, s = _search_detours(route, cum, truck_idx, p_first, p_last, center, radius,
                                         (PROBE_WINDOW_KM,), (PROBE_VIA_OFFSET_KM,))
        except RoutingUnavailableError:
            continue
        for k in stats:
            stats[k] += s[k]
        if detours:
            return detours, stats, (center, p_first, p_last)
    return [], stats, None
