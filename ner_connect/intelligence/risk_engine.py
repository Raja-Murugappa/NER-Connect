import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import joblib
import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree
from ner_connect.intelligence.open_data_service import get_live_weather

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

# 3. Build Spatial BallTrees using Haversine metric (Radians)
def build_spatial_tree(df, lat_col="latitude", lon_col="longitude"):
    coords_rad = np.radians(df[[lat_col, lon_col]].values)
    return BallTree(coords_rad, metric="haversine")

tree_terrain = build_spatial_tree(df_terrain)
tree_network = build_spatial_tree(df_network)

def query_nearest_record(tree, df, lat, lon):
    """Finds the closest geographic row in the reference dataset."""
    q_rad = np.radians([[lat, lon]])
    _, idx = tree.query(q_rad, k=1)
    return df.iloc[idx[0][0]]

def get_segment_intelligence(segment: dict, sim_rainfall_24h: float = None) -> dict:
    mid_lat = (segment['start_coords'][0] + segment['end_coords'][0]) / 2.0
    mid_lon = (segment['start_coords'][1] + segment['end_coords'][1]) / 2.0
    dist = segment["distance_km"]

    # 1. Real Physical Elevation & Slope from Open-Meteo profile
    elevation = float(segment.get("elevation_end_m", 250.0))
    slope = float(segment.get("slope_percent", 5.0))

    # Nearest river distance and network quality from geographic reference
    t_row = query_nearest_record(tree_terrain, df_terrain, mid_lat, mid_lon)
    n_row = query_nearest_record(tree_network, df_network, mid_lat, mid_lon)
    river_dist = float(t_row.get("river_distance_km", 1.8))
    net_status = str(n_row.get("status", "GOOD"))

    # 2. Live Weather Query (Open-Meteo) or Simulation Override
    if sim_rainfall_24h is not None:
        rain_24h = sim_rainfall_24h
        condition = "Torrential Storm Rain" if rain_24h > 120 else ("Heavy Rain" if rain_24h > 50 else "Moderate Rain")
    else:
        live_w = get_live_weather(mid_lat, mid_lon)
        rain_24h = live_w["rainfall_mm"]
        condition = live_w["condition"]

    # 3. Model Inference: Landslide Probability
    soil_type = "Schist_Shale" if slope > 20.0 else "Sandy_Clay"
    soil_enc = le_soil.transform([soil_type])[0] if soil_type in le_soil.classes_ else 0

    X_ls = pd.DataFrame([{
        'rainfall_mm': rain_24h,
        'elevation_m': elevation,
        'slope_percent': slope,
        'soil_encoded': soil_enc
    }])
    p_landslide = float(model_ls.predict_proba(X_ls)[0][1])

    # 4. Model Inference: Flood / Waterlogging Probability
    sim_river_lvl = 9.5 if rain_24h > 80.0 else (6.5 if rain_24h > 20.0 else 4.0)
    X_fl = pd.DataFrame([{
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

    # Weather Indicator
    if rain_24h > 50.0:
        w_label = f"🔴 {condition} ({int(rain_24h)} mm)"
    elif rain_24h > 10.0:
        w_label = f"🟡 {condition} ({int(rain_24h)} mm)"
    elif rain_24h > 0.0:
        w_label = f"🟢 {condition} ({round(rain_24h, 1)} mm)"
    else:
        w_label = f"🟢 {condition}"

    # Network Indicator
    if net_status == "GOOD":
        net_label = "🟢 4G/5G Online"
    elif net_status in ["OK", "POOR"]:
        net_label = "🟡 Weak Signal"
    else:
        net_label = "🔴 Dead Zone (Pre-cache Route)"

    # Road Condition & Confidence
    comp_risk = max(p_landslide, p_flood)
    confidence = int(np.clip(98 - (comp_risk * 30), 65, 98))

    if comp_risk >= 0.50:
        road_cond = "🟠 Hazardous Corridor"
        status_msg = "⚠️ High Disruption Risk ahead. Rerouting / officer intervention recommended."
    elif comp_risk >= 0.20:
        road_cond = "🟡 Caution Advisory"
        status_msg = "🟡 Moderate hazard potential. Drivers should reduce speed and proceed with caution."
    else:
        road_cond = "🟢 Clear & Operational"
        status_msg = "🟢 Route open. Normal transit conditions."

    elev_start = segment.get("elevation_start_m", int(elevation))
    elev_end = segment.get("elevation_end_m", int(elevation))

    return {
        "segment_id": segment["segment_id"],
        "road_name": segment["road_name"],
        "segment_type": segment.get("segment_type", "🛣️ HIGHWAY CORRIDOR"),
        "distance": f"{segment['distance_km']} km",
        "eta": f"{eta_mins} min",
        "elevation": f"{elev_start} m ➔ {elev_end} m (Slope: {slope}%)",
        "weather": w_label,
        "landslide_risk": ls_label,
        "flood_risk": fl_label,
        "network": net_label,
        "road_condition": road_cond,
        "confidence": f"{confidence}%",
        "status": status_msg,
        "operational_action": segment.get("operational_action", "Maintain standard monitoring.")
    }

def print_segment_card(card: dict):
    print("=" * 65)
    print(f"{card['segment_id']} | {card['segment_type']}")
    print(f"Location:         {card['road_name']}")
    print("=" * 65)
    print(f"Distance & ETA:   {card['distance']}  |  Est. Travel Time: {card['eta']}")
    print(f"Elevation Profile:{card['elevation']}")
    print(f"Weather:          {card['weather']}")
    print(f"Landslide Risk:   {card['landslide_risk']}")
    print(f"Flood Risk:       {card['flood_risk']}")
    print(f"Connectivity:     {card['network']}")
    print(f"Corridor Health:  {card['road_condition']} (Confidence: {card['confidence']})\n")
    print(f"Status & Advisory:")
    print(f"  {card['status']}\n")
    print(f"🚨 Actionable Operational Directive:")
    print(f"  👉 {card['operational_action']}")
    print("=" * 65 + "\n")
