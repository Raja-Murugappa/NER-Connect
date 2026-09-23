import math

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates geodesic distance between two points in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def interpolate_point(start_coords: tuple, end_coords: tuple, fraction: float) -> tuple:
    """Interpolates coordinates between start and end by a given fraction (0.0 to 1.0)."""
    s_lat, s_lon = start_coords
    e_lat, e_lon = end_coords
    lat = round(s_lat + fraction * (e_lat - s_lat), 4)
    lon = round(s_lon + fraction * (e_lon - s_lon), 4)
    return (lat, lon)
