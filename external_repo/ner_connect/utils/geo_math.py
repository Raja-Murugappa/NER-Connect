import math

import numpy as np
from sklearn.neighbors import BallTree

EARTH_RADIUS_KM = 6371.0


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


# ─── Vectorised helpers for whole polylines ([[lat, lon], ...]) ───────────────

def to_array(polyline) -> np.ndarray:
    return np.asarray(polyline, dtype=float).reshape(-1, 2)

def haversine_km(lat1, lon1, lat2, lon2):
    """Element-wise haversine distance in km (accepts scalars or numpy arrays)."""
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))

def cumulative_km(route: np.ndarray) -> np.ndarray:
    """Kilometres from the first point to each point of the route."""
    if len(route) < 2:
        return np.zeros(len(route))
    steps = haversine_km(route[:-1, 0], route[:-1, 1], route[1:, 0], route[1:, 1])
    return np.concatenate([[0.0], np.cumsum(steps)])

def distances_to_point(route: np.ndarray, point) -> np.ndarray:
    return haversine_km(route[:, 0], route[:, 1], point[0], point[1])

def distances_to_route(points: np.ndarray, route: np.ndarray) -> np.ndarray:
    """Distance (km) from each of `points` to the nearest point of `route`."""
    tree = BallTree(np.radians(route), metric="haversine")
    dist, _ = tree.query(np.radians(points), k=1)
    return dist[:, 0] * EARTH_RADIUS_KM

def overlap_fraction(line: np.ndarray, reference: np.ndarray, tolerance_km: float = 0.1) -> float:
    """Share of `line`'s points that lie on `reference` (within tolerance)."""
    if len(line) == 0 or len(reference) == 0:
        return 0.0
    return float(np.mean(distances_to_route(line, reference) <= tolerance_km))

def side_points(route: np.ndarray, before_idx: int, after_idx: int, center, offsets_km) -> list:
    """
    (lat, lon) points `offsets_km` to the left and right of the road at `center`, using the
    road direction between route[before_idx] and route[after_idx]. Routing through such a
    point forces the router onto other roads (OSRM has no "avoid this area" option).
    """
    a = route[max(before_idx, 0)]
    b = route[min(after_idx, len(route) - 1)]
    lat0 = np.radians(center[0])
    dx = (b[1] - a[1]) * 111.32 * np.cos(lat0)   # km east
    dy = (b[0] - a[0]) * 110.57                  # km north
    norm = np.hypot(dx, dy)
    px, py = (-dy / norm, dx / norm) if norm > 1e-6 else (1.0, 0.0)  # perpendicular to the road
    points = []
    for km in offsets_km:
        for side in (1, -1):
            points.append((round(float(center[0] + side * km * py / 110.57), 4),
                           round(float(center[1] + side * km * px / (111.32 * np.cos(lat0))), 4)))
    return points

def has_out_and_back(line: np.ndarray) -> bool:
    """True if the route drives out to a point and back on the same road (a dead-end spur),
    which happens when a forced via point lands on a dead-end road."""
    if len(line) < 20:
        return False
    tree = BallTree(np.radians(line), metric="haversine")
    sample = np.arange(0, len(line), max(1, len(line) // 200))
    neighbours = tree.query_radius(np.radians(line[sample]), r=0.03 / EARTH_RADIUS_KM)
    revisits = sum(1 for i, nb in zip(sample, neighbours) if np.any(np.abs(nb - i) > 30))
    return revisits / len(sample) > 0.05
