import json
import urllib.request
import urllib.parse
from ner_connect.utils.geo_math import haversine_distance

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"

# Strategic Regional Transit Checkposts & Gateway Corridors in the North Eastern Region
KNOWN_NER_CHECKPOSTS = [
    {"name": "Jorabat Inter-State Transit Gate", "state": "Assam/Meghalaya", "coords": (26.1086, 91.8654), "role": "Inter-State Border & NH-27/NH-6 Diversion Gate"},
    {"name": "Rangpo Entry Checkpost", "state": "Sikkim", "coords": (27.1764, 88.5323), "role": "State Entry Point & Teesta River Valley Control"},
    {"name": "Melli Border Checkpost", "state": "Sikkim/West Bengal", "coords": (27.0913, 88.4593), "role": "South Sikkim Transit & Rerouting Post"},
    {"name": "Bhalukpong Inner Line Gate", "state": "Arunachal Pradesh", "coords": (27.0142, 92.6431), "role": "High-Altitude Tawang Corridor Gateway"},
    {"name": "Byrnihat Industrial Checkpoint", "state": "Meghalaya", "coords": (26.0620, 91.8790), "role": "Commercial Fleet Inspection & Weight Control"},
    {"name": "Sevoke Coronation Gate", "state": "West Bengal/Sikkim", "coords": (26.8833, 88.4722), "role": "Mountain Ascent Transition & River Gorge Control"},
    {"name": "Silchar-Vairengte Gate", "state": "Assam/Mizoram", "coords": (24.5120, 92.7650), "role": "Mizoram Central Supply Chain Checkpost"},
    {"name": "Dimapur Chumukedima Gate", "state": "Nagaland", "coords": (25.7950, 93.7780), "role": "Kohima Mountain Highway Inspection Point"}
]

def get_live_weather(lat: float, lon: float, timeout: float = 4.0) -> dict:
    """
    Fetches real-time live weather from Open-Meteo for the given coordinate.
    """
    url = f"{OPEN_METEO_FORECAST_URL}?latitude={lat:.4f}&longitude={lon:.4f}&current=precipitation,rain,weather_code,wind_speed_10m"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NER-Connect Logistics/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                current = data.get("current", {})
                rain_mm = float(current.get("precipitation", 0.0) or current.get("rain", 0.0))
                w_code = int(current.get("weather_code", 0))

                condition = "Clear"
                if w_code in [1, 2, 3]:
                    condition = "Partly Cloudy"
                elif w_code in [51, 53, 55, 61]:
                    condition = "Light Rain"
                elif w_code in [63, 65, 80, 81]:
                    condition = "Moderate Rain"
                elif w_code in [82, 95, 96, 99]:
                    condition = "Torrential / Storm Rain"

                return {
                    "source": "Open-Meteo Real-Time Weather",
                    "rainfall_mm": rain_mm,
                    "condition": condition,
                    "wind_speed_kmh": float(current.get("wind_speed_10m", 0.0))
                }
    except Exception:
        pass

    return {
        "source": "Default Baseline",
        "rainfall_mm": 5.0,
        "condition": "Clear",
        "wind_speed_kmh": 8.0
    }

def get_elevation_profile(coords_list: list, timeout: float = 5.0) -> list:
    """
    Fetches actual physical elevation (meters) from Open-Meteo Elevation API for a list of coordinates.
    """
    if not coords_list:
        return []

    # Format lats and lons
    lats = ",".join([f"{pt[0]:.4f}" for pt in coords_list])
    lons = ",".join([f"{pt[1]:.4f}" for pt in coords_list])
    url = f"{OPEN_METEO_ELEVATION_URL}?latitude={lats}&longitude={lons}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NER-Connect Logistics/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                elevs = data.get("elevation", [])
                if len(elevs) == len(coords_list):
                    return [float(e) for e in elevs]
    except Exception:
        pass

    # Fallback default elevation estimate based on coordinates
    return [150.0] * len(coords_list)

def calculate_slope(elev1: float, elev2: float, dist_km: float) -> float:
    """Calculates road slope percentage based on elevation delta and distance."""
    if dist_km <= 0.05:
        return 0.0
    dist_meters = dist_km * 1000.0
    delta_elev = abs(elev2 - elev1)
    slope_pct = (delta_elev / dist_meters) * 100.0
    return round(min(55.0, slope_pct), 1)

def find_checkposts_along_route(polyline: list, max_dist_km: float = 4.0) -> list:
    """
    Identifies known strategic checkposts and transit gates within max_dist_km of the route.
    """
    found = []
    seen = set()
    for cp in KNOWN_NER_CHECKPOSTS:
        cp_lat, cp_lon = cp["coords"]
        for idx, pt in enumerate(polyline):
            dist = haversine_distance(cp_lat, cp_lon, pt[0], pt[1])
            if dist <= max_dist_km and cp["name"] not in seen:
                seen.add(cp["name"])
                found.append({
                    "name": cp["name"],
                    "state": cp["state"],
                    "role": cp["role"],
                    "coords": cp["coords"],
                    "route_index": idx
                })
                break
    return found
