"""
District road-accessibility status.

Not mobile signal - this answers the actual SIH26002 question: "how many genuinely
different real roads connect this district to the rest of the network, and is it one
missing bridge away from being cut off?" Reuses the exact route-finding and
genuinely-different-road filtering already built for the Route B/C planning feature
(route_options.py) between Guwahati - the region's logistics gateway, and already the
implicit hub for this app's own preset corridors - and each district's centroid.

Districts are cheap to list (administrative_boundaries.csv, no network calls). The route
count for one district is real OSRM work (the same cost as the existing "other routes"
search at planning time) and is only computed on request, not for all districts up front.
"""
import os

import pandas as pd

from ner_connect.routing.route_engine import get_osrm_route, RoutingUnavailableError
from ner_connect.routing.route_options import find_distinct_routes

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")

# The regional logistics gateway used as the reference point for every district's route
# count - the same Guwahati this app already uses as the default origin for its presets.
HUB_NAME = "Guwahati"
HUB_COORDS = (26.1445, 91.7362)

# Alternatives beyond the primary road to look for. Anything found past this is still
# reported as "3+"; the question that matters is 1 (critical) vs 2 (limited) vs several.
MAX_ALTERNATIVES = 3

_LEVEL_LABEL = {
    "critical": "Single road access",
    "limited": "One backup route",
    "good": "Multiple routes",
}


def list_districts() -> list:
    """One row per district: state, name, and its centroid (mean of its sample points)."""
    path = os.path.join(DATA_DIR, "administrative_boundaries.csv")
    df = pd.read_csv(path)
    rows = []
    for (state, district), g in df.groupby(["state", "district"]):
        rows.append({
            "state": state,
            "district": district,
            "latitude": round(float(g["latitude"].mean()), 4),
            "longitude": round(float(g["longitude"].mean()), 4),
        })
    rows.sort(key=lambda r: (r["state"], r["district"]))
    return rows


def route_status_to_hub(lat: float, lon: float) -> dict:
    """
    How many genuinely different real roads reach (lat, lon) from the hub. Never invents a
    road: a routing failure is reported as such, not counted as "no route".
    """
    dest = (lat, lon)
    try:
        primary = get_osrm_route(HUB_COORDS, dest)
    except RoutingUnavailableError as e:
        return {"status": "ROUTING_UNAVAILABLE", "message": str(e)}

    if primary.get("status") not in (None, "SUCCESS"):
        return {"status": "NO_ROAD_FOUND",
                "message": primary.get("warning") or "No real road route found from the hub."}

    routes = [{"distance_km": round(primary["distance_km"], 1), "primary": True}]
    try:
        chosen = find_distinct_routes(HUB_COORDS, dest, primary["polyline"], MAX_ALTERNATIVES)
    except RoutingUnavailableError:
        chosen = []  # primary road exists; the alternative search itself failed - not fatal
    routes += [{"distance_km": round(r["distance_km"], 1), "primary": False} for r, _ in chosen]

    route_count = len(routes)
    level = "critical" if route_count <= 1 else "limited" if route_count == 2 else "good"

    return {
        "status": "SUCCESS",
        "hub": HUB_NAME,
        "route_count": route_count,
        "level": level,
        "label": _LEVEL_LABEL[level],
        "routes": routes,
    }
