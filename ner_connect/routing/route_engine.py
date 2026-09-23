import json
import urllib.request
import urllib.parse
from ner_connect.utils.geo_math import haversine_distance, interpolate_point

OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/driving"

def get_osrm_route(start_coords: tuple, end_coords: tuple, timeout: float = 6.0) -> dict:
    """
    Fetches real-world driving geometry, steps, intersections, and ETAs from OpenStreetMap (OSRM).
    Extracts highway junctions and bridge crossing maneuvers.
    """
    s_lat, s_lon = start_coords
    e_lat, e_lon = end_coords

    # OSRM expects longitude,latitude format with steps enabled
    url = f"{OSRM_BASE_URL}/{s_lon},{s_lat};{e_lon},{e_lat}?overview=full&geometries=geojson&steps=true"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NER-Connect Logistics Platform/1.0"})
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

                    return {
                        "status": "SUCCESS",
                        "source": "OpenStreetMap (OSRM Router)",
                        "distance_km": dist_km,
                        "duration_mins": duration_mins,
                        "polyline": polyline,
                        "junctions": junctions,
                        "bridges": bridges
                    }
    except Exception:
        pass

    # Offline Fallback Geometry
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
