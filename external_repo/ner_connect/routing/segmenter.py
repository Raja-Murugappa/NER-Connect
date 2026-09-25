from ner_connect.utils.geo_math import haversine_distance, interpolate_point
from ner_connect.routing.route_engine import get_osrm_route
from ner_connect.intelligence.open_data_service import (
    find_checkposts_along_route,
    get_elevation_profile,
    calculate_slope
)

MIN_SEGMENT_THRESHOLD_KM = 50.0  # Strict minimum segment length in km

def compute_target_sector_count(total_dist: float) -> int:
    """
    Mathematical formula to determine optimal sector budget:
    Target: ~75-85 km per sector.
    Clamped between 2 and 7 sectors.
    """
    if total_dist <= 65.0:
        return 1
    if total_dist <= 120.0:
        return 2
    return max(2, min(7, int(round(total_dist / 80.0))))

def create_smart_dynamic_segments(polyline: list, total_dist: float, road_name: str,
                                  state: str, district: str, junctions: list, bridges: list) -> list:
    """
    Optimized Segmenter using:
    1. Mathematical Sector Budget Formula
    2. Strict Minimum Distance Threshold (>= 50 km)
    3. Priority-Based Landmark Snapping (P1: Checkposts > P2: Major Junctions > P3: Bridges)
    4. Internal Embedded Milestones (POIs) that don't fragment the route.
    """
    # 1. Compute cumulative distances along polyline
    cum_dists = [0.0]
    for i in range(1, len(polyline)):
        d = haversine_distance(polyline[i-1][0], polyline[i-1][1], polyline[i][0], polyline[i][1])
        cum_dists.append(cum_dists[-1] + d)

    # 2. Collect all Landmarks with Priority Scores
    # Priority: 1 = Critical Checkposts, 2 = Major Highway Junctions, 3 = Critical Bridges
    all_landmarks = []

    # Checkposts (Priority 1)
    checkposts = find_checkposts_along_route(polyline, max_dist_km=5.0)
    for cp in checkposts:
        cp_lat, cp_lon = cp["coords"]
        best_km = 0.0
        min_d = 9999.0
        for i, pt in enumerate(polyline):
            d = haversine_distance(cp_lat, cp_lon, pt[0], pt[1])
            if d < min_d:
                min_d = d
                best_km = cum_dists[i]
        all_landmarks.append({
            "priority": 1,
            "type": "Checkpost",
            "name": cp["name"],
            "km": round(best_km, 1),
            "action": "Staffed checkpost: drivers can be stopped and informed here."
        })

    # Major Junctions (Priority 2)
    last_junc_km = -30.0
    for j in junctions:
        j_lat, j_lon = j["coords"]
        for i in range(0, len(polyline), 5):
            d = haversine_distance(j_lat, j_lon, polyline[i][0], polyline[i][1])
            if d < 1.0:
                km = cum_dists[i]
                if abs(km - last_junc_km) > 25.0 and 10.0 < km < (total_dist - 10.0):
                    all_landmarks.append({
                        "priority": 2,
                        "type": "Junction",
                        "name": j["name"],
                        "km": round(km, 1),
                        "action": "Possible diversion point if the road ahead is blocked."
                    })
                    last_junc_km = km
                break

    # Bridges (Priority 3)
    for b in bridges:
        b_lat, b_lon = b["coords"]
        for i in range(0, len(polyline), 5):
            d = haversine_distance(b_lat, b_lon, polyline[i][0], polyline[i][1])
            if d < 1.0:
                km = cum_dists[i]
                all_landmarks.append({
                    "priority": 3,
                    "type": "Bridge",
                    "name": b["name"],
                    "km": round(km, 1),
                    "action": "Watch river level and bridge condition."
                })
                break

    # Sort all landmarks by distance along route
    all_landmarks.sort(key=lambda x: x["km"])

    # 3. Mathematical Nominal Cut Points
    K = compute_target_sector_count(total_dist)
    nominal_cuts = [round(j * (total_dist / K), 1) for j in range(1, K)]

    # 4. Priority-Based Snapping with Strict Minimum Threshold (>= 50 km)
    cuts = [0.0]
    cut_meta = [{}]
    used_landmark_indices = set()

    for target in nominal_cuts:
        prev_cut = cuts[-1]
        
        # Snapping window around target nominal mark
        window_start = max(prev_cut + MIN_SEGMENT_THRESHOLD_KM, target - 25.0)
        window_end = min(total_dist - 35.0, target + 25.0)

        best_cand = None
        best_cand_idx = -1
        best_priority = 99
        min_dist_to_target = 9999.0

        for idx, lm in enumerate(all_landmarks):
            if idx in used_landmark_indices:
                continue
            lm_km = lm["km"]
            # Check strict minimum distance constraints
            if window_start <= lm_km <= window_end and (lm_km - prev_cut) >= MIN_SEGMENT_THRESHOLD_KM:
                # Rank by priority first, then proximity to nominal target
                if (lm["priority"] < best_priority) or (lm["priority"] == best_priority and abs(lm_km - target) < min_dist_to_target):
                    best_cand = lm
                    best_cand_idx = idx
                    best_priority = lm["priority"]
                    min_dist_to_target = abs(lm_km - target)

        if best_cand is not None:
            cuts.append(best_cand["km"])
            cut_meta.append(best_cand)
            used_landmark_indices.add(best_cand_idx)
        else:
            # Fall back to nominal target, enforcing >= 50 km
            fallback_cut = max(prev_cut + MIN_SEGMENT_THRESHOLD_KM, target)
            if (total_dist - fallback_cut) >= 35.0:
                cuts.append(round(fallback_cut, 1))
                cut_meta.append({
                    "type": "Highway",
                    "name": f"{road_name} Sector {len(cuts)}",
                    "action": "Routine monitoring."
                })

    # Add final destination cut
    cuts.append(round(total_dist, 1))

    # 5. Extract GPS & Elevation for each sector
    sample_pts = []
    for i in range(len(cuts) - 1):
        s_km = cuts[i]
        e_km = cuts[i+1]
        s_idx = min(range(len(cum_dists)), key=lambda k: abs(cum_dists[k] - s_km))
        e_idx = min(range(len(cum_dists)), key=lambda k: abs(cum_dists[k] - e_km))
        sample_pts.extend([polyline[s_idx], polyline[e_idx]])

    elevations = get_elevation_profile(sample_pts)

    # 6. Build the Sectors with Embedded Milestones
    sectors = []
    for i in range(len(cuts) - 1):
        s_km = cuts[i]
        e_km = cuts[i+1]
        seg_dist = round(e_km - s_km, 1)

        s_idx = min(range(len(cum_dists)), key=lambda k: abs(cum_dists[k] - s_km))
        e_idx = min(range(len(cum_dists)), key=lambda k: abs(cum_dists[k] - e_km))
        s_coords = polyline[s_idx]
        e_coords = polyline[e_idx]

        raw_s = elevations[i * 2] if (i * 2) < len(elevations) else None
        raw_e = elevations[i * 2 + 1] if (i * 2 + 1) < len(elevations) else None
        # If the elevation service failed, the models get a neutral 150 m / flat input,
        # and the sector is flagged so the UI doesn't present it as measured.
        elevation_known = raw_s is not None and raw_e is not None
        elev_s = raw_s if raw_s is not None else 150.0
        elev_e = raw_e if raw_e is not None else 150.0
        slope_pct = calculate_slope(elev_s, elev_e, seg_dist) if elevation_known else 0.0

        # Collect embedded milestones that fall INSIDE this sector
        embedded = []
        for lm in all_landmarks:
            if s_km < lm["km"] < e_km:
                embedded.append({
                    "km_marker": f"km {lm['km']:.1f}",
                    "type": lm["type"],
                    "name": lm["name"],
                    "action": lm["action"]
                })

        meta = cut_meta[i+1] if (i+1) < len(cut_meta) and cut_meta[i+1] else {}
        seg_type = "Highway"
        seg_name = meta.get("name", f"{road_name} Sector {i+1}")
        action = meta.get("action", "Routine monitoring.")

        # Why this sector was cut where it is - shown as a marker on the map and a line in
        # the sector list. The last sector always ends at the destination, so it needs no
        # boundary explanation; every other sector ends at a real point that has a reason.
        is_last_sector = (i == len(cuts) - 2)
        boundary = None
        if not is_last_sector:
            if "priority" in meta:
                # Cut at a checkpost, junction or bridge (see priority order above).
                landmark_name = meta["name"]
                boundary = {
                    "type": meta["type"],
                    "name": None if landmark_name in (None, "Junction") else landmark_name,
                    "reason": meta["action"],
                    "coords": e_coords,
                }
            else:
                # No landmark was close enough, so the cut falls at the planned distance.
                boundary = {
                    "type": "Distance cut",
                    "name": None,
                    "reason": "No checkpost, junction or bridge was close enough here, so this sector "
                              "was cut at the planned distance to keep sectors within the target "
                              "length (about 80 km each).",
                    "coords": e_coords,
                }

        # Classify high mountain ascent
        if elevation_known and (slope_pct >= 15.0 or (elev_e - elev_s) >= 500.0):
            seg_type = "Mountain climb"
            seg_name = f"Mountain climb, {int(elev_s)} m to {int(elev_e)} m"
            action = f"Steep climb from {int(elev_s)} m to {int(elev_e)} m. Watch for slope failures; heavy trucks will be slow."

        sectors.append({
            "segment_id": f"SECTOR {i+1:02d}",
            "road_name": seg_name,
            "segment_type": seg_type,
            "state": state,
            "district": district,
            "distance_km": seg_dist,
            "start_coords": s_coords,
            "end_coords": e_coords,
            "polyline": polyline[s_idx : e_idx + 1],
            "elevation_start_m": int(elev_s),
            "elevation_end_m": int(elev_e),
            "elevation_known": elevation_known,
            "slope_percent": slope_pct,
            "operational_action": action,
            "boundary": boundary,
            "embedded_milestones": embedded
        })

    return sectors

def segment_route(route_info: dict, road_name: str, state: str = "", district: str = "") -> list:
    """
    Cuts an already-known route (e.g. an OSRM alternative, or the remaining part of an
    active journey) into sectors. route_info needs "polyline" and "distance_km";
    "junctions" and "bridges" are optional landmarks for snapping cut points.
    """
    return create_smart_dynamic_segments(
        polyline=route_info["polyline"],
        total_dist=route_info["distance_km"],
        road_name=road_name,
        state=state,
        district=district,
        junctions=route_info.get("junctions", []),
        bridges=route_info.get("bridges", [])
    )

def generate_road_segments(road_name: str, state: str, district: str,
                            start_coords: tuple, end_coords: tuple) -> tuple:
    """
    Main entry point for Mathematical & Priority-Based Road Segmentation.
    """
    route_info = get_osrm_route(start_coords, end_coords)
    sectors = segment_route(route_info, road_name, state, district)
    return route_info["distance_km"], sectors, route_info

create_smart_dynamic_sectors = create_smart_dynamic_segments
slice_polyline_into_segments = create_smart_dynamic_segments
