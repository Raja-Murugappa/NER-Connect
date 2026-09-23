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

def generate_road_segments(road_name: str, state: str, district: str,
                           start_coords: tuple, end_coords: tuple) -> tuple:
    """
    Slices any origin -> destination road corridor into standardized physical segments:
    - < 100 km: exactly 2 segments (50/50 split)
    - >= 100 km: 50 km slices + residual remainder
    """
    total_dist = haversine_distance(start_coords[0], start_coords[1], end_coords[0], end_coords[1])

    if total_dist < 100.0:
        segment_lengths = [total_dist / 2.0, total_dist / 2.0]
    else:
        num_full = int(total_dist // 50.0)
        remainder = total_dist % 50.0
        segment_lengths = [50.0] * num_full
        if remainder > 1.0:
            segment_lengths.append(round(remainder, 1))

    segments = []
    cumulative_dist = 0.0
    for i, length in enumerate(segment_lengths):
        frac_start = cumulative_dist / total_dist
        cumulative_dist += length
        frac_end = cumulative_dist / total_dist

        s_lat = round(start_coords[0] + frac_start * (end_coords[0] - start_coords[0]), 4)
        s_lon = round(start_coords[1] + frac_start * (end_coords[1] - start_coords[1]), 4)
        e_lat = round(start_coords[0] + frac_end * (end_coords[0] - start_coords[0]), 4)
        e_lon = round(start_coords[1] + frac_end * (end_coords[1] - start_coords[1]), 4)

        segments.append({
            "segment_id": f"SEGMENT {i+1:02d}",
            "road_name": f"{road_name} (Part {i+1})",
            "state": state,
            "district": district,
            "distance_km": round(length, 1),
            "start_coords": (s_lat, s_lon),
            "end_coords": (e_lat, e_lon)
        })

    return total_dist, segments