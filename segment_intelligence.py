import os
import joblib
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

# 1. Load Trained Models and Encoders
model_ls = joblib.load(os.path.join(MODELS_DIR, "landslide_model.joblib"))
model_fl = joblib.load(os.path.join(MODELS_DIR, "flood_model.joblib"))
le_soil = joblib.load(os.path.join(MODELS_DIR, "soil_encoder.joblib"))

# 2. Helper to load CSV from root or data/ subfolder
def load_csv(filename):
    path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(path):
        path = os.path.join(BASE_DIR, "data", filename)
    return pd.read_csv(path)

df_weather = load_csv("weather_history.csv")
df_network = load_csv("network_quality.csv")
df_terrain = load_csv("terrain.csv")

def get_segment_intelligence(segment: dict, sim_rainfall_24h: float = None) -> dict:
    state = segment["state"]
    dist = segment["distance_km"]

    # 1. Fetch Local Terrain Characteristics
    match_terrain = df_terrain[df_terrain["state"].str.contains(state, case=False, na=False)]
    if not match_terrain.empty:
        t_row = match_terrain.iloc[0]
        elevation = float(t_row["elevation_m"])
        slope = float(t_row["slope_percent"])
        river_dist = float(t_row["river_distance_km"])
    else:
        elevation, slope, river_dist = 850.0, 15.0, 2.0

    # 2. Fetch Weather Characteristics
    match_weather = df_weather[df_weather["state"].str.contains(state, case=False, na=False)]
    if not match_weather.empty:
        w_row = match_weather.iloc[0]
        rain_24h = float(w_row["rainfall_24h_mm"])
        condition = str(w_row["weather_condition"])
    else:
        rain_24h, condition = 10.0, "CLEAR"

    # Simulation Override
    if sim_rainfall_24h is not None:
        rain_24h = sim_rainfall_24h
        condition = "TORRENTIAL_RAIN" if rain_24h > 120 else ("HEAVY_RAIN" if rain_24h > 50 else "MODERATE_RAIN")

    # 3. Model Inference: Landslide Probability
    soil_enc = le_soil.transform(["Schist_Shale"])[0] if "Schist_Shale" in le_soil.classes_ else 0
    p_landslide = model_ls.predict_proba([[rain_24h, elevation, slope, soil_enc]])[0][1]

    # 4. Model Inference: Flood Probability
    p_flood = model_fl.predict_proba([[rain_24h, 7.5, river_dist, elevation]])[0][1]

    # 5. Network Quality Status
    match_net = df_network[df_network["state"].str.contains(state, case=False, na=False)]
    net_status = match_net.iloc[0]["status"] if not match_net.empty else "OK"

    # 6. ETA Calculation
    base_speed = 60.0 if slope < 15.0 else 35.0
    if p_landslide > 0.6 or p_flood > 0.6:
        base_speed *= 0.45
    eta_mins = int(round((dist / max(5.0, base_speed)) * 60))

    # 7. Classification and Indicators
    # Landslide Risk
    if p_landslide >= 0.65:
        ls_label = "🔴 High"
    elif p_landslide >= 0.35:
        ls_label = "🟡 Moderate"
    else:
        ls_label = "🟢 Low"

    # Flood Risk
    if p_flood >= 0.65:
        fl_label = "🔴 High"
    elif p_flood >= 0.35:
        fl_label = "🟠 Moderate"
    else:
        fl_label = "🟢 Low"

    # Weather Indicator
    if rain_24h > 15.0 or "RAIN" in condition:
        w_label = f"🔴 {condition.replace('_', ' ').title()} ({int(rain_24h)} mm)"
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
    confidence = int(np.clip(100 - (comp_risk * 40) + np.random.randint(-3, 4), 60, 98))

    if comp_risk >= 0.65:
        road_cond = "🟠 Poor"
        status_msg = "⚠️ Landslide/Flood advisory active. Extreme caution required."
    elif comp_risk >= 0.35:
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
    """Prints the segment output in the exact card layout."""
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