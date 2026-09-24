import os
import json
import urllib.request
import urllib.parse
import time
from ner_connect.utils.geo_math import haversine_distance, interpolate_point

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE_FILE = os.path.join(BASE_DIR, "data", "route_cache.json")
OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/driving"

def _load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def _save_cache(cache_data: dict):
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, indent=2)
    except Exception:
        pass

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
    cache = _load_cache()

    # 1. Return from cache if already fetched
    if cache_key in cache:
        cached_result = cache[cache_key]
        cached_result["source"] = "OpenStreetMap (OSRM Router - Verified Real Route)"
        return cached_result

    # 2. Query OSRM with generous timeout
    url = f"{OSRM_BASE_URL}/{s_lon},{s_lat};{e_lon},{e_lat}?overview=full&geometries=geojson&steps=true"
    
    last_err = None
    for attempt in range(2):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "NER-Connect Logistics Platform/2.0 (Himalayan Routing Engine)"}
            )
            with urllib.request.urlopen(req, timeout=timeout) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    if data.get("code") == "Ok" and len(data.get("routes", [])) > 0:
                        route = data["routes"][0]
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
                                    desc = f"{m_type.title()} ({m_mod})" if m_mod else m_type.title()
                                    junctions.append({
                                        "name": f"{desc} to {name}" if name else f"Highway Interchange ({desc})",
                                        "coords": pt,
                                        "intersections_count": len(intersections)
                                    })

                        result = {
                            "status": "SUCCESS",
                            "source": "OpenStreetMap (OSRM Router - Verified Real Route)",
                            "distance_km": dist_km,
                            "duration_mins": duration_mins,
                            "polyline": polyline,
                            "junctions": junctions,
                            "bridges": bridges
                        }

                        # Save to cache for guaranteed consistency
                        cache[cache_key] = result
                        _save_cache(cache)
                        return result
        except Exception as e:
            last_err = e
            time.sleep(1.0)

    # 3. Fallback only if public OSRM is completely unreachable after retries
    print(f"\n[Route Engine Alert] Note: Public OSRM server delayed ({last_err}). Utilizing geodesic corridor projection.")
    dist_km = round(haversine_distance(s_lat, s_lon, e_lat, e_lon), 1)
    num_steps = max(10, int(dist_km // 5.0))
    fallback_polyline = [interpolate_point(start_coords, end_coords, i / num_steps) for i in range(num_steps + 1)]

    return {
        "status": "FALLBACK",
        "source": "Local Fallback Model (Offline)",
        "distance_km": dist_km,
        "duration_mins": int(round((dist_km / 45.0) * 60)),
        "polyline": fallback_polyline,
        "junctions": [],
        "bridges": []
    }
