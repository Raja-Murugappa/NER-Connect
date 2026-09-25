import os
import json
import threading
import urllib.request
import urllib.parse
import time
from ner_connect.utils.geo_math import haversine_distance, interpolate_point

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE_FILE = os.path.join(BASE_DIR, "data", "route_cache.json")
GEOCODE_CACHE_FILE = os.path.join(BASE_DIR, "data", "geocode_cache.json")
OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving"
NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "NER-Connect Logistics Platform/2.0 (Himalayan Routing Engine)"


class GeocodingError(ValueError):
    """Raised when a place name cannot be resolved to coordinates."""


def _load_cache(path: str = CACHE_FILE) -> dict:
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def _save_cache(cache_data: dict, path: str = CACHE_FILE):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, indent=2)
    except Exception:
        pass

# Route lookups can run in parallel threads; serialise the read-modify-write of the cache file.
_route_cache_lock = threading.Lock()

def _route_cache_get(key: str):
    with _route_cache_lock:
        return _load_cache().get(key)

def _route_cache_put(key: str, value):
    with _route_cache_lock:
        cache = _load_cache()
        cache[key] = value
        _save_cache(cache)

def _junction_name(road_name: str) -> str:
    return f"Junction onto {road_name}" if road_name else "Junction"

def _clean_junction_names(route: dict) -> dict:
    """Routes cached by older versions named junctions like 'Fork (slight left) to NH27' or
    'Highway Interchange (Turn (right))'; normalise them to the current plain names."""
    for j in route.get("junctions", []):
        name = j.get("name", "")
        if name.startswith("Highway Interchange"):
            j["name"] = "Junction"
        elif " to " in name and not name.startswith("Junction"):
            j["name"] = _junction_name(name.split(" to ", 1)[1])
    return route

_geocode_cache_lock = threading.Lock()

def geocode_place(query: str, timeout: float = 10.0) -> dict:
    """
    Resolves a place name (e.g. "Imphal" or "Kohima, Nagaland") to coordinates using
    OpenStreetMap Nominatim. Results are restricted to India and cached on disk so a
    given name always resolves to the same point.
    Returns {"name", "display_name", "lat", "lon"}; raises GeocodingError if not found.
    """
    name = (query or "").strip()
    if not name:
        raise GeocodingError("Location name is empty")

    cache_key = name.lower()
    with _geocode_cache_lock:
        cache = _load_cache(GEOCODE_CACHE_FILE)
    if cache_key in cache:
        return {**cache[cache_key], "name": name}

    params = urllib.parse.urlencode({"q": name, "format": "json", "limit": 1, "countrycodes": "in"})
    req = urllib.request.Request(
        f"{NOMINATIM_SEARCH_URL}?{params}",
        headers={"User-Agent": USER_AGENT, "Accept-Language": "en"}
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            results = json.loads(response.read().decode("utf-8"))
    except Exception as e:
        raise GeocodingError(f"Location lookup for \"{name}\" failed: {e}") from e

    if not results:
        raise GeocodingError(f"Could not find a location named \"{name}\"")

    place = {
        "name": name,
        "display_name": results[0].get("display_name", name),
        "lat": round(float(results[0]["lat"]), 4),
        "lon": round(float(results[0]["lon"]), 4),
    }
    with _geocode_cache_lock:
        # Re-read in case a concurrent request cached a different place meanwhile, so its
        # entry isn't lost when this write lands.
        stored = _load_cache(GEOCODE_CACHE_FILE)
        stored[cache_key] = place
        _save_cache(stored, GEOCODE_CACHE_FILE)
    return place

def resolve_location(value) -> dict:
    """
    Accepts either a place name string or a {"lat", "lon", "name"?} mapping and
    returns a normalised {"name", "display_name", "lat", "lon"} dict.
    """
    if isinstance(value, str):
        return geocode_place(value)
    if isinstance(value, dict) and "lat" in value and "lon" in value:
        name = str(value.get("name") or f"{float(value['lat']):.4f}, {float(value['lon']):.4f}")
        return {
            "name": name,
            "display_name": str(value.get("display_name") or name),
            "lat": float(value["lat"]),
            "lon": float(value["lon"]),
        }
    raise GeocodingError("Location must be a place name or an object with lat and lon")

class RoutingUnavailableError(RuntimeError):
    """Raised when the OSRM routing service cannot be reached or returns no route."""


def _parse_osrm_route(route: dict) -> dict:
    """Converts one OSRM route object into the platform's route format."""
    dist_km = round(route["distance"] / 1000.0, 1)  # meters to km
    duration_mins = int(round(route["duration"] / 60.0))  # seconds to mins

    # Convert OSRM [lon, lat] coordinates to [(lat, lon), ...]
    coords_geojson = route["geometry"]["coordinates"]
    polyline = [(round(pt[1], 4), round(pt[0], 4)) for pt in coords_geojson]

    # Parse OSRM Steps for Junctions and Bridges
    junctions = []
    bridges = []
    steps = route.get("legs", [{}])[0].get("steps", [])

    for s in steps:
        name = s.get("name", "").strip()
        maneuver = s.get("maneuver", {})
        m_type = maneuver.get("type", "")
        m_mod = maneuver.get("modifier", "")
        loc = maneuver.get("location", [])
        intersections = s.get("intersections", [])

        if loc and len(loc) == 2:
            pt = (round(loc[1], 4), round(loc[0], 4))

            # Detect Bridges / River Crossings
            lower_name = name.lower()
            if any(w in lower_name for w in ["bridge", "setu", "flyover", "crossing"]):
                bridges.append({
                    "name": name or "River / Valley Bridge Crossing",
                    "coords": pt,
                    "distance_m": s.get("distance", 0)
                })

            # Detect Highway Junctions & Rerouting nodes
            if m_type in ["fork", "merge", "off ramp", "roundabout"] or (m_type == "turn" and len(intersections) >= 3):
                junctions.append({
                    "name": _junction_name(name),
                    "coords": pt,
                    "intersections_count": len(intersections)
                })

    return {
        "status": "SUCCESS",
        "source": "OpenStreetMap road network (OSRM)",
        "distance_km": dist_km,
        "duration_mins": duration_mins,
        "polyline": polyline,
        "junctions": junctions,
        "bridges": bridges
    }

def _query_osrm(waypoints: list, alternatives: int = 0, steps: bool = True,
                timeout: float = 16.0, attempts: int = 2) -> list:
    """
    Queries OSRM for a route through the given (lat, lon) waypoints (start, optional vias, end)
    and returns the parsed routes, main route first. OSRM only offers alternatives for
    two-waypoint requests. Raises RoutingUnavailableError if unreachable or no route is found.
    """
    coords = ";".join(f"{lon},{lat}" for lat, lon in waypoints)
    url = f"{OSRM_BASE_URL}/{coords}?overview=full&geometries=geojson"
    if steps:
        url += "&steps=true"
    if alternatives:
        url += f"&alternatives={alternatives}"

    last_err = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
            if data.get("code") == "Ok" and data.get("routes"):
                return [_parse_osrm_route(r) for r in data["routes"]]
            last_err = data.get("message") or data.get("code") or "no route found"
        except Exception as e:
            last_err = e
        if attempt < attempts - 1:
            time.sleep(1.0)
    raise RoutingUnavailableError(f"OSRM routing failed: {last_err}")

CANDIDATES_CACHE_TTL_S = 15 * 60
_candidates_cache: dict = {}

def get_osrm_candidates(waypoints: list, max_alternatives: int = 3, timeout: float = 30.0) -> list:
    """
    Candidate driving routes through the given (lat, lon) waypoints: the main route plus any
    alternatives OSRM finds (alternatives only exist for two-waypoint requests).
    Used for dynamic rerouting: there is NO straight-line fallback (raises RoutingUnavailableError
    instead of inventing a road), and results are only kept in memory for a short time.
    Turn-by-turn steps are skipped because they make the public OSRM server much slower,
    so candidates carry no junction/bridge landmarks.
    """
    key = "|".join(f"{lat:.3f},{lon:.3f}" for lat, lon in waypoints) + f"|alt{max_alternatives}"
    cached = _candidates_cache.get(key)
    if cached and time.time() - cached[0] < CANDIDATES_CACHE_TTL_S:
        return cached[1]

    routes = _query_osrm(waypoints, alternatives=max_alternatives if len(waypoints) == 2 else 0,
                         steps=False, timeout=timeout, attempts=1)
    _candidates_cache[key] = (time.time(), routes)
    return routes

def get_osrm_route_alternatives(start_coords: tuple, end_coords: tuple, timeout: float = 90.0) -> list:
    """
    All routes OSRM offers between two points (main route plus up to 3 alternatives), for
    comparing options at planning time. Cached on disk like the main route, so repeated
    requests are instant and identical. Turn-by-turn steps are skipped (they make the public
    OSRM server several times slower), so these routes carry no junction/bridge landmarks.
    Raises RoutingUnavailableError if OSRM cannot be reached.
    """
    s_lat, s_lon = start_coords
    e_lat, e_lon = end_coords
    cache_key = f"alternatives|{s_lat:.4f},{s_lon:.4f}->{e_lat:.4f},{e_lon:.4f}"
    cached = _route_cache_get(cache_key)
    if cached is not None:
        return cached

    routes = _query_osrm([start_coords, end_coords], alternatives=3, steps=False,
                         timeout=timeout, attempts=1)
    _route_cache_put(cache_key, routes)
    return routes

def get_osrm_route_via(waypoints: list, timeout: float = 60.0) -> dict:
    """
    The driving route through the given (lat, lon) waypoints (start, via points, end). Used to
    find genuinely different roads at planning time by forcing the route past a side point.
    Cached on disk; no junction/bridge landmarks (steps skipped for speed).
    Raises RoutingUnavailableError if OSRM cannot be reached.
    """
    cache_key = "via|" + ";".join(f"{lat:.4f},{lon:.4f}" for lat, lon in waypoints)
    cached = _route_cache_get(cache_key)
    if cached is not None:
        return cached

    route = _query_osrm(waypoints, steps=False, timeout=timeout, attempts=1)[0]
    _route_cache_put(cache_key, route)
    return route

def get_osrm_route(start_coords: tuple, end_coords: tuple, timeout: float = 16.0) -> dict:
    """
    Fetches real-world driving geometry, steps, intersections, and ETAs from OpenStreetMap (OSRM).
    Features:
    - Persistent disk cache for instant, 100% deterministic identical outputs.
    - Extended 16.0s timeout to prevent random fallback dropouts on long 500+ km mountain highways.
    - Automatic retry mechanism.
    """
    s_lat, s_lon = start_coords
    e_lat, e_lon = end_coords

    cache_key = f"{s_lat:.4f},{s_lon:.4f}->{e_lat:.4f},{e_lon:.4f}"

    # 1. Return from cache if already fetched
    cached_result = _route_cache_get(cache_key)
    if cached_result is not None:
        cached_result["source"] = "OpenStreetMap road network (OSRM)"
        return _clean_junction_names(cached_result)

    # 2. Query OSRM with generous timeout
    try:
        routes = _query_osrm([start_coords, end_coords], timeout=timeout)
        result = routes[0]
        # Save to cache for guaranteed consistency
        _route_cache_put(cache_key, result)
        return result
    except RoutingUnavailableError as e:
        last_err = e

    # 3. Fallback only if public OSRM is completely unreachable after retries.
    # This is a straight line, NOT a road path, so it is flagged for the UI and never cached.
    print(f"\n[Route Engine Alert] Note: Public OSRM server delayed ({last_err}). Utilizing geodesic corridor projection.")
    dist_km = round(haversine_distance(s_lat, s_lon, e_lat, e_lon), 1)
    num_steps = max(10, int(dist_km // 5.0))
    fallback_polyline = [interpolate_point(start_coords, end_coords, i / num_steps) for i in range(num_steps + 1)]

    return {
        "status": "FALLBACK",
        "source": "Straight-line estimate (routing service unavailable)",
        "warning": "Road routing service unreachable. Showing an approximate straight-line corridor, not the actual road path.",
        "distance_km": dist_km,
        "duration_mins": int(round((dist_km / 45.0) * 60)),
        "polyline": fallback_polyline,
        "junctions": [],
        "bridges": []
    }
