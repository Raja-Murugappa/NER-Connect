import os
import joblib
import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

# 1. Load Trained Models & Encoders
model_ls = joblib.load(os.path.join(MODELS_DIR, "landslide_model.joblib"))
model_fl = joblib.load(os.path.join(MODELS_DIR, "flood_model.joblib"))
le_soil = joblib.load(os.path.join(MODELS_DIR, "soil_encoder.joblib"))

# 2. Helper to load CSV datasets
def load_csv(filename):
    path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(path):
        path = os.path.join(BASE_DIR, "data", filename)
    return pd.read_csv(path)

df_terrain = load_csv("terrain.csv")
df_weather = load_csv("weather_history.csv")
df_network = load_csv("network_quality.csv")

# 3. Build Spatial BallTrees using Haversine metric (Radians)
def build_spatial_tree(df, lat_col="latitude", lon_col="longitude"):
    coords_rad = np.radians(df[[lat_col, lon_col]].values)
    return BallTree(coords_rad, metric="haversine")

tree_terrain = build_spatial_tree(df_terrain)
tree_weather = build_spatial_tree(df_weather)
tree_network = build_spatial_tree(df_network)

def query_nearest_record(tree, df, lat, lon):
    """Finds the closest geographic row in the dataset to the GPS point."""
    q_rad = np.radians([[lat, lon]])
    _, idx = tree.query(q_rad, k=1)
    return df.iloc[idx[0][0]]

def get_segment_intelligence(segment: dict, sim_rainfall_24h: float = None) -> dict:
    mid_lat = (segment['start_coords'][0] + segment['end_coords'][0]) / 2.0
    mid_lon = (segment['start_coords'][1] + segment['end_coords'][1]) / 2.0
    dist = segment["distance_km"]

    # 1. BallTree Spatial Lookup for Localized Ground Truth
    t_row = query_nearest_record(tree_terrain, df_terrain, mid_lat, mid_lon)
    w_row = query_nearest_record(tree_weather, df_weather, mid_lat, mid_lon)
    n_row = query_nearest_record(tree_network, df_network, mid_lat, mid_lon)

    elevation = float(t_row.get("elevation_m", 250.0))
    slope = float(t_row.get("slope_percent", 5.0))
    river_dist = float(t_row.get("river_distance_km", 2.0))

    rain_24h = float(w_row.get("rainfall_24h_mm", 0.0))
    condition = str(w_row.get("weather_condition", "CLEAR"))
    net_status = str(n_row.get("status", "GOOD"))

    # Simulation Override
    if sim_rainfall_24h is not None:
        rain_24h = sim_rainfall_24h
        condition = "TORRENTIAL_RAIN" if rain_24h > 120 else ("HEAVY_RAIN" if rain_24h > 50 else "MODERATE_RAIN")

    # 2. Model Inference: Landslide Probability
    soil_type = "Schist_Shale" if slope > 25.0 else "Sandy_Clay"
    soil_enc = le_soil.transform([soil_type])[0] if soil_type in le_soil.classes_ else 0

    X_ls = pd.DataFrame([{
        'rainfall_mm': rain_24h,
        'elevation_m': elevation,
        'slope_percent': slope,
        'soil_encoded': soil_enc
    }])
    p_landslide = float(model_ls.predict_proba(X_ls)[0][1])

    # 3. Model Inference: Flood / Waterlogging Probability
    sim_river_lvl = 9.0 if rain_24h > 80.0 else (6.5 if rain_24h > 20.0 else 4.0)
    X_fl = pd.DataFrame([{
        'rainfall_24h_mm': rain_24h,
        'river_level_m': sim_river_lvl,
        'river_distance_km': river_dist,
        'elevation_m': elevation
    }])
    p_flood = float(model_fl.predict_proba(X_fl)[0][1])

    # 4. ETA Calculation
    base_speed = 60.0 if slope < 15.0 else 35.0
    if p_landslide > 0.6 or p_flood > 0.6:
        base_speed *= 0.45
    eta_mins = int(round((dist / max(5.0, base_speed)) * 60))

    # 5. Risk Labels & Indicators
    if p_landslide >= 0.50:
        ls_label = "🔴 High"
    elif p_landslide >= 0.20:
        ls_label = "🟡 Moderate"
    else:
        ls_label = "🟢 Low"

    if p_flood >= 0.50:
        fl_label = "🔴 High"
    elif p_flood >= 0.20:
        fl_label = "🟠 Moderate"
    else:
        fl_label = "🟢 Low"

    # Weather Indicator
    if rain_24h > 50.0:
        w_label = f"🔴 {condition.replace('_', ' ').title()} ({int(rain_24h)} mm)"
    elif rain_24h > 15.0:
        w_label = f"🟡 {condition.replace('_', ' ').title()} ({int(rain_24h)} mm)"
    elif rain_24h > 0.5:
        w_label = f"🟢 Light Rain ({int(rain_24h)} mm)"
    else:
        w_label = "🟢 Clear"

    # Network Indicator
    if net_status == "GOOD":
        net_label = "🟢 Good"
    elif net_status in ["OK", "POOR"]:
        net_label = "🟡 Weak"
    else:
        net_label = "🔴 No Service"

    # Road Condition & Confidence
    comp_risk = max(p_landslide, p_flood)
    confidence = int(np.clip(98 - (comp_risk * 35), 62, 98))

    if comp_risk >= 0.50:
        road_cond = "🟠 Poor"
        status_msg = "⚠️ Landslide/Flood advisory active. Extreme caution required."
    elif comp_risk >= 0.20:
        road_cond = "🟡 Fair"
        status_msg = "🟡 Travel with caution. Moderate rainfall on corridor."
    else:
        road_cond = "🟢 Good"
        status_msg = "🟢 Safe to travel"

    return {
        "segment_id": segment["segment_id"],
        "road_name": segment["road_name"],
        "distance": f"{segment['distance_km']} km",
        "eta": f"{eta_mins} min",
        "weather": w_label,
        "landslide_risk": ls_label,
        "flood_risk": fl_label,
        "network": net_label,
        "road_condition": road_cond,
        "confidence": f"{confidence}%",
        "status": status_msg
    }

def print_segment_card(card: dict):
    print("=" * 45)
    print(f"{card['segment_id']} ({card['road_name']})")
    print("=" * 45)
    print(f"Distance:         {card['distance']}")
    print(f"ETA:              {card['eta']}\n")
    print(f"Weather:          {card['weather']}")
    print(f"Landslide risk:   {card['landslide_risk']}")
    print(f"Flood risk:       {card['flood_risk']}")
    print(f"Network:          {card['network']}")
    print(f"Road condition:   {card['road_condition']}\n")
    print(f"Road confidence:  {card['confidence']}")
    print(f"Last update:      4 min ago\n")
    print("Status / Alert:")
    print(f"{card['status']}")
    print("=" * 45 + "\n")
    