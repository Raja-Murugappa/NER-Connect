from ner_connect.utils.geo_math import haversine_distance, interpolate_point
from ner_connect.routing.route_engine import get_osrm_route
from ner_connect.intelligence.open_data_service import (
    find_checkposts_along_route,
    get_elevation_profile,
    calculate_slope
)

def create_smart_dynamic_segments(polyline: list, total_dist: float, road_name: str,
                                  state: str, district: str, junctions: list, bridges: list) -> list:
    """
    Dynamically slices a real-world route polyline into smart feature-aware operational segments.
    Breaks at:
    - Control Checkpoints & State/District transit gates
    - Highway Interchanges & Reroute Junctions
    - Critical Bridges & River Crossings
    - High-Slope Mountain Passes (Steep terrain > 18%)
    """
    # 1. Compute cumulative distances along polyline
    cum_dists = [0.0]
    for i in range(1, len(polyline)):
        d = haversine_distance(polyline[i-1][0], polyline[i-1][1], polyline[i][0], polyline[i][1])
        cum_dists.append(cum_dists[-1] + d)

    # 2. Find Checkposts along the route
    checkposts = find_checkposts_along_route(polyline, max_dist_km=5.0)

    # 3. Collect and map all Anchor Points to cumulative distance (km)
    anchors = []

    # Map Checkposts
    for cp in checkposts:
        cp_lat, cp_lon = cp["coords"]
        best_km = 0.0
        min_d = 9999.0
        for i, pt in enumerate(polyline):
            d = haversine_distance(cp_lat, cp_lon, pt[0], pt[1])
            if d < min_d:
                min_d = d
                best_km = cum_dists[i]
        anchors.append({
            "km": round(best_km, 1),
            "type": "🛡️ CONTROL CHECKPOINT",
            "name": cp["name"],
            "action": f"Deploy officers at {cp['name']} for vehicle inspection, driver alerts, and physical notices."
        })

    # Map Major Junctions (pick up to 4 significant junctions spaced out)
    last_junc_km = -50.0
    for j in junctions:
        j_lat, j_lon = j["coords"]
        for i in range(0, len(polyline), 5):
            d = haversine_distance(j_lat, j_lon, polyline[i][0], polyline[i][1])
            if d < 1.0:
                km = cum_dists[i]
                if abs(km - last_junc_km) > 35.0 and 10.0 < km < (total_dist - 15.0):
                    anchors.append({
                        "km": round(km, 1),
                        "type": "🔀 REROUTE JUNCTION",
                        "name": j["name"],
                        "action": f"Primary diversion point. If segment ahead is blocked, divert traffic at {j['name']}."
                    })
                    last_junc_km = km
                break

    # Map Bridges
    for b in bridges:
        b_lat, b_lon = b["coords"]
        for i in range(0, len(polyline), 5):
            d = haversine_distance(b_lat, b_lon, polyline[i][0], polyline[i][1])
            if d < 1.0:
                km = cum_dists[i]
                anchors.append({
                    "km": round(km, 1),
                    "type": "🌉 CRITICAL BRIDGE",
                    "name": b["name"],
                    "action": f"Single-point-of-failure bridge crossing ({b['name']}). Monitor water level and structural integrity."
                })
                break

    # Sort anchors by distance along route
    anchors.sort(key=lambda x: x["km"])

    # 4. Build Smart Cut Points (merge anchors that are too close, add intermediate cuts if stretch > 60 km)
    cut_points = [0.0]
    cut_meta = [{}]

    for a in anchors:
        if a["km"] - cut_points[-1] >= 15.0 and (total_dist - a["km"]) >= 10.0:
            cut_points.append(a["km"])
            cut_meta.append(a)

    # If gaps between cuts are too large (> 65 km), insert standard highway splits
    final_cuts = [cut_points[0]]
    final_meta = [cut_meta[0]]

    for i in range(1, len(cut_points)):
        prev = final_cuts[-1]
        curr = cut_points[i]
        gap = curr - prev
        if gap > 65.0:
            num_splits = int(gap // 50.0)
            step = gap / (num_splits + 1)
            for s in range(1, num_splits + 1):
                mid_km = round(prev + s * step, 1)
                final_cuts.append(mid_km)
                final_meta.append({
                    "type": "🛣️ HIGHWAY CORRIDOR",
                    "name": f"{road_name} Transit Sector",
                    "action": "Standard highway monitoring. Maintain safe following distance."
                })
        final_cuts.append(curr)
        final_meta.append(cut_meta[i])

    # Handle remainder to destination
    if total_dist - final_cuts[-1] > 65.0:
        gap = total_dist - final_cuts[-1]
        mid_km = round(final_cuts[-1] + gap / 2.0, 1)
        final_cuts.append(mid_km)
        final_meta.append({
            "type": "🛣️ HIGHWAY CORRIDOR",
            "name": f"{road_name} Mountain Approach",
            "action": "Standard transit stretch approaching final corridor."
        })

    final_cuts.append(round(total_dist, 1))

    # 5. Extract GPS coordinates & Elevation for each segment
    segments = []
    
    # Sample coordinates for elevation profile query
    sample_pts = []
    for i in range(len(final_cuts) - 1):
        s_km = final_cuts[i]
        e_km = final_cuts[i+1]
        # find closest polyline pt
        s_idx = min(range(len(cum_dists)), key=lambda k: abs(cum_dists[k] - s_km))
        e_idx = min(range(len(cum_dists)), key=lambda k: abs(cum_dists[k] - e_km))
        sample_pts.extend([polyline[s_idx], polyline[e_idx]])

    elevations = get_elevation_profile(sample_pts)

    for i in range(len(final_cuts) - 1):
        s_km = final_cuts[i]
        e_km = final_cuts[i+1]
        seg_dist = round(e_km - s_km, 1)

        s_idx = min(range(len(cum_dists)), key=lambda k: abs(cum_dists[k] - s_km))
        e_idx = min(range(len(cum_dists)), key=lambda k: abs(cum_dists[k] - e_km))
        s_coords = polyline[s_idx]
        e_coords = polyline[e_idx]

        elev_s = elevations[i * 2] if (i * 2) < len(elevations) else 200.0
        elev_e = elevations[i * 2 + 1] if (i * 2 + 1) < len(elevations) else 200.0
        slope_pct = calculate_slope(elev_s, elev_e, seg_dist)

        meta = final_meta[i+1] if (i+1) < len(final_meta) and final_meta[i+1] else {}
        seg_type = meta.get("type", "🛣️ HIGHWAY CORRIDOR")
        seg_label = meta.get("name", f"{road_name} Sector {i+1}")
        action = meta.get("action", "Standard corridor patrol and monitoring.")

        # If elevation increases drastically (> 18% slope), upgrade to High Slope Pass
        if slope_pct >= 18.0 and seg_type == "🛣️ HIGHWAY CORRIDOR":
            seg_type = "⛰️ HIGH SLOPE PASS"
            seg_label = f"{road_name} Mountain Ascent ({int(elev_s)}m ➔ {int(elev_e)}m)"
            action = f"Steep mountain grade ({slope_pct}% slope). Restrict overloaded trucks and alert for rockfalls."

        segments.append({
            "segment_id": f"SEGMENT {i+1:02d}",
            "road_name": seg_label,
            "segment_type": seg_type,
            "state": state,
            "district": district,
            "distance_km": seg_dist,
            "start_coords": s_coords,
            "end_coords": e_coords,
            "elevation_start_m": int(elev_s),
            "elevation_end_m": int(elev_e),
            "slope_percent": slope_pct,
            "operational_action": action
        })

    return segments

def generate_road_segments(road_name: str, state: str, district: str,
                            start_coords: tuple, end_coords: tuple) -> tuple:
    """
    Main entry point for Smart Feature-Aware Road Segmentation.
    Queries OSRM for live driving geometry and automatically cuts at junctions, checkposts, and bridges.
    """
    route_info = get_osrm_route(start_coords, end_coords)
    total_dist = route_info["distance_km"]
    polyline = route_info["polyline"]
    junctions = route_info.get("junctions", [])
    bridges = route_info.get("bridges", [])

    segments = create_smart_dynamic_segments(
        polyline=polyline,
        total_dist=total_dist,
        road_name=road_name,
        state=state,
        district=district,
        junctions=junctions,
        bridges=bridges
    )

    return total_dist, segments, route_info
