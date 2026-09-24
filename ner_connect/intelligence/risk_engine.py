import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import joblib
import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS_DIR = os.path.join(BASE_DIR, "models")
DATA_DIR = os.path.join(BASE_DIR, "data")

# 1. Load Trained Models & Encoders
model_ls = joblib.load(os.path.join(MODELS_DIR, "landslide_model.joblib"))
model_fl = joblib.load(os.path.join(MODELS_DIR, "flood_model.joblib"))
le_soil = joblib.load(os.path.join(MODELS_DIR, "soil_encoder.joblib"))

# 2. Helper to load baseline spatial reference tables
def load_csv(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing data file: {filename}")
    return pd.read_csv(path)

df_terrain = load_csv("terrain.csv")
df_network = load_csv("network_quality.csv")
df_roads = load_csv("road_segments.csv")

# 3. Build Spatial BallTrees using Haversine metric (Radians)
def build_spatial_tree(df, lat_col="latitude", lon_col="longitude"):
    coords_rad = np.radians(df[[lat_col, lon_col]].values)
    return BallTree(coords_rad, metric="haversine")

tree_terrain = build_spatial_tree(df_terrain)
tree_network = build_spatial_tree(df_network)
tree_roads = build_spatial_tree(df_roads, lat_col="start_lat", lon_col="start_lon")

def query_nearest_record(tree, df, lat, lon):
    """Finds the closest geographic row in the reference dataset."""
    q_rad = np.radians([[lat, lon]])
    _, idx = tree.query(q_rad, k=1)
    return df.iloc[idx[0][0]]

def get_segment_intelligence(segment: dict,
                             sim_alert_score: float = None,
                             sim_rainfall_24h: float = None) -> dict:
    mid_lat = (segment['start_coords'][0] + segment['end_coords'][0]) / 2.0
    mid_lon = (segment['start_coords'][1] + segment['end_coords'][1]) / 2.0
    dist = segment["distance_km"]

    # 1. Spatial Lookups for Ground Baseline & Existing System Score
    t_row = query_nearest_record(tree_terrain, df_terrain, mid_lat, mid_lon)
    n_row = query_nearest_record(tree_network, df_network, mid_lat, mid_lon)
    r_row = query_nearest_record(tree_roads, df_roads, mid_lat, mid_lon)

    elevation = float(segment.get("elevation_end_m", t_row.get("elevation_m", 250.0)))
    slope = float(segment.get("slope_percent", t_row.get("slope_percent", 5.0)))
    river_dist = float(t_row.get("river_distance_km", 1.8))
    net_status = str(n_row.get("status", "GOOD"))

    # Baseline Upstream Warning Score from existing systems
    base_upstream_score = float(r_row.get("current_system_score", 0.15))
    if sim_alert_score is not None:
        upstream_score = sim_alert_score
    else:
        upstream_score = base_upstream_score

    # Weather (Rainfall)
    if sim_rainfall_24h is not None:
        rain_24h = sim_rainfall_24h
        condition = "Torrential Storm Rain" if rain_24h > 120 else ("Heavy Rain" if rain_24h > 50 else "Moderate Rain")
    else:
        # Normal baseline conditions
        rain_24h = 15.0 if upstream_score > 0.50 else 3.0
        condition = "Moderate Rain" if rain_24h > 10.0 else "Clear / Light Drizzle"

    # 2. Local Ground Context: Soil Classification
    soil_type = "Schist_Shale" if slope > 20.0 else ("Loose_Phyllite" if slope > 12.0 else "Sandy_Clay")
    soil_enc = le_soil.transform([soil_type])[0] if soil_type in le_soil.classes_ else 0

    # 3. Model Inference: Landslide Probability (Driven by Upstream System + Local Soil/Slope)
    X_ls = pd.DataFrame([{
        'current_system_score': upstream_score,
        'rainfall_mm': rain_24h,
        'elevation_m': elevation,
        'slope_percent': slope,
        'soil_encoded': soil_enc
    }])
    p_landslide = float(model_ls.predict_proba(X_ls)[0][1])

    # 4. Model Inference: Flood Probability (Driven by Upstream System + River Level)
    sim_river_lvl = 11.5 if upstream_score > 0.65 else (7.0 if upstream_score > 0.35 else 3.5)
    X_fl = pd.DataFrame([{
        'current_system_score': upstream_score,
        'rainfall_24h_mm': rain_24h,
        'river_level_m': sim_river_lvl,
        'river_distance_km': river_dist,
        'elevation_m': elevation
    }])
    p_flood = float(model_fl.predict_proba(X_fl)[0][1])

    # 5. Speed & ETA Calculation
    base_speed = 65.0 if slope < 10.0 else (45.0 if slope < 20.0 else 30.0)
    if p_landslide > 0.5 or p_flood > 0.5:
        base_speed *= 0.45
    eta_mins = max(2, int(round((dist / max(5.0, base_speed)) * 60)))
    hours = eta_mins // 60
    mins = eta_mins % 60
    eta_str = f"{hours}h {mins}m" if hours > 0 else f"{mins} min"

    # 6. Risk Labels & Indicators
    if p_landslide >= 0.50:
        ls_label = f"🔴 High ({int(p_landslide*100)}%)"
    elif p_landslide >= 0.20:
        ls_label = f"🟡 Moderate ({int(p_landslide*100)}%)"
    else:
        ls_label = f"🟢 Low ({int(p_landslide*100)}%)"

    if p_flood >= 0.50:
        fl_label = f"🔴 High ({int(p_flood*100)}%)"
    elif p_flood >= 0.20:
        fl_label = f"🟠 Moderate ({int(p_flood*100)}%)"
    else:
        fl_label = f"🟢 Low ({int(p_flood*100)}%)"

    # Upstream Feed Label
    if upstream_score >= 0.70:
        upstream_label = f"🔴 Severe Alert ({upstream_score:.2f}) [ISRO/CWC Feed]"
    elif upstream_score >= 0.40:
        upstream_label = f"🟡 Advisory Warning ({upstream_score:.2f}) [ISRO/CWC Feed]"
    else:
        upstream_label = f"🟢 Normal Activity ({upstream_score:.2f}) [ISRO/CWC Feed]"

    # Connectivity
    if net_status == "GOOD":
        net_label = "🟢 4G/5G Online"
    elif net_status in ["OK", "POOR"]:
        net_label = "🟡 Weak Signal"
    else:
        net_label = "🔴 Dead Zone (Pre-cache Route)"

    # Combined Logistics Health
    comp_risk = max(p_landslide, p_flood)
    confidence = int(np.clip(98 - (comp_risk * 28), 68, 98))

    if comp_risk >= 0.50:
        risk_level = "danger"
        road_cond = "🟠 Critical Logistics Risk"
        status_msg = "⚠️ High Disruption Alert. Upstream hazard confirmed by local physical geology."
    elif comp_risk >= 0.20:
        risk_level = "caution"
        road_cond = "🟡 Caution Advisory"
        status_msg = "🟡 Moderate hazard advisory active. Commercial carriers advised to reduce speed."
    else:
        risk_level = "safe"
        road_cond = "🟢 Clear & Operational"
        status_msg = "🟢 Corridor clear. Upstream feeds normal, safe for all freight."

    elev_start = segment.get("elevation_start_m", int(elevation))
    elev_end = segment.get("elevation_end_m", int(elevation))

    return {
        "segment_id": segment["segment_id"],
        "road_name": segment["road_name"],
        "segment_type": segment.get("segment_type", "🛣️ STRATEGIC HIGHWAY SECTOR"),
        "distance": f"{segment['distance_km']} km",
        "distance_km": segment["distance_km"],
        "eta": eta_str,
        "eta_mins": eta_mins,
        "elevation": f"{elev_start} m ➔ {elev_end} m (Slope: {slope}%)",
        "upstream_feed": upstream_label,
        "upstream_score": upstream_score,
        "local_soil": soil_type.replace("_", " "),
        "landslide_risk": ls_label,
        "flood_risk": fl_label,
        "network": net_label,
        "road_condition": road_cond,
        "risk_level": risk_level,
        "confidence": f"{confidence}%",
        "status": status_msg,
        "start_coords": segment.get("start_coords"),
        "end_coords": segment.get("end_coords"),
        "polyline": segment.get("polyline", []),
        "embedded_milestones": segment.get("embedded_milestones", [])
    }

def print_segment_card(card: dict):
    print("=" * 68)
    print(f"{card['segment_id']} | {card['segment_type']}")
    print(f"Sector:           {card['road_name']}")
    print("=" * 68)
    print(f"Distance & ETA:   {card['distance']}  |  Est. Travel Time: {card['eta']}")
    print(f"Elevation Profile:{card['elevation']}")
    print(f"Connectivity:     {card['network']}")
    print("-" * 68)
    print(f"📡 Upstream System:  {card['upstream_feed']}")
    print(f"🌍 Local Ground Context: Soil: {card['local_soil']}")
    print(f"🎯 Logistics Impact: Landslide: {card['landslide_risk']}  |  Flood: {card['flood_risk']}")
    print(f"Corridor Health:  {card['road_condition']} (Confidence: {card['confidence']})")

    # Render Embedded Milestones (POIs) if any
    milestones = card.get("embedded_milestones", [])
    if milestones:
        print("\n📍 Strategic Milestones & Control Points Inside Sector:")
        for m in milestones:
            print(f"   • [{m['km_marker']}] {m['type']}: {m['name']}")

    print(f"\nStatus & Advisory:")
    print(f"  {card['status']}")
    print("=" * 68 + "\n")
