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

MOUNTAIN_ELEVATION_M = 1000.0

def is_mountain_sector(segment: dict) -> bool:
    """
    True for sectors in mountain terrain: flagged as a steep ascent by the segmenter,
    or with any part of the sector at or above MOUNTAIN_ELEVATION_M.
    Used to decide where a simulated severe hazard warning applies.
    """
    if segment.get("segment_type") == "Mountain climb":
        return True
    peak = max(segment.get("elevation_start_m", 0), segment.get("elevation_end_m", 0))
    return peak >= MOUNTAIN_ELEVATION_M

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

    # 6. Risk Labels & Indicators (plain text; the numbers are also returned for display)
    ls_pct = int(p_landslide * 100)
    fl_pct = int(p_flood * 100)
    ls_label = f"{_level_word(p_landslide)} ({ls_pct}%)"
    fl_label = f"{_level_word(p_flood)} ({fl_pct}%)"

    # Upstream hazard score (sample data standing in for an ISRO/CWC warning feed)
    if upstream_score >= 0.70:
        upstream_label = f"Severe warning ({upstream_score:.2f})"
    elif upstream_score >= 0.40:
        upstream_label = f"Advisory ({upstream_score:.2f})"
    else:
        upstream_label = f"Normal ({upstream_score:.2f})"

    # Connectivity
    if net_status == "GOOD":
        network_level = "good"
        net_label = "Good"
    elif net_status in ["OK", "POOR"]:
        network_level = "weak"
        net_label = "Weak"
    else:
        network_level = "none"
        net_label = "No signal"

    # Combined Logistics Health
    comp_risk = max(p_landslide, p_flood)
    confidence = int(np.clip(98 - (comp_risk * 28), 68, 98))

    if comp_risk >= 0.50:
        risk_level = "danger"
        road_cond = "High risk"
        status_msg = "Disruption likely. Consider delaying the trip or using another route."
    elif comp_risk >= 0.20:
        risk_level = "caution"
        road_cond = "Medium risk"
        status_msg = "Some risk of disruption. Drive slowly and check for updates."
    else:
        risk_level = "safe"
        road_cond = "Low risk"
        status_msg = "No known problems."

    elev_start = segment.get("elevation_start_m", int(elevation))
    elev_end = segment.get("elevation_end_m", int(elevation))

    return {
        "segment_id": segment["segment_id"],
        "road_name": segment["road_name"],
        "segment_type": segment.get("segment_type", "Highway"),
        "boundary": segment.get("boundary"),
        "distance": f"{segment['distance_km']} km",
        "distance_km": segment["distance_km"],
        "eta": eta_str,
        "eta_mins": eta_mins,
        "elevation": (f"{elev_start} m to {elev_end} m (slope {slope}%)"
                      if segment.get("elevation_known", True) else "Not available"),
        "elevation_start_m": elev_start,
        "elevation_end_m": elev_end,
        "elevation_known": segment.get("elevation_known", True),
        "slope_percent": slope,
        "upstream_feed": upstream_label,
        "upstream_score": upstream_score,
        "local_soil": soil_type.replace("_", " "),
        "landslide_risk": ls_label,
        "landslide_pct": ls_pct,
        "flood_risk": fl_label,
        "flood_pct": fl_pct,
        "network": net_label,
        "network_level": network_level,
        "road_condition": road_cond,
        "risk_level": risk_level,
        "confidence": f"{confidence}%",
        "status": status_msg,
        "start_coords": segment.get("start_coords"),
        "end_coords": segment.get("end_coords"),
        "polyline": segment.get("polyline", []),
        "embedded_milestones": segment.get("embedded_milestones", [])
    }

def _level_word(probability: float) -> str:
    if probability >= 0.50:
        return "High"
    if probability >= 0.20:
        return "Medium"
    return "Low"

SEVERE_ALERT_SCORE = 0.88
SEVERE_RAINFALL_MM = 145.0

def format_eta(total_mins: int) -> str:
    hours, mins = divmod(int(total_mins), 60)
    return f"{hours}h {mins}m" if hours > 0 else f"{mins} mins"

def evaluate_sectors(sectors: list, scenario: str = "1") -> tuple:
    """
    Scores every sector and returns (sector_cards, total_journey_mins).
    Scenario "2" simulates a severe upstream hazard warning on mountain sectors.
    """
    severe = str(scenario).strip() == "2"
    cards = []
    total_mins = 0
    for sec in sectors:
        # The simulated severe warning applies to mountain-terrain sectors only
        active = severe and is_mountain_sector(sec)
        card = get_segment_intelligence(
            sec,
            sim_alert_score=SEVERE_ALERT_SCORE if active else None,
            sim_rainfall_24h=SEVERE_RAINFALL_MM if active else None,
        )
        cards.append(card)
        total_mins += card.get("eta_mins", 0)
    return cards, total_mins

def print_segment_card(card: dict):
    print("=" * 68)
    print(f"{card['segment_id']} | {card['segment_type']}")
    print(f"Name:          {card['road_name']}")
    print("-" * 68)
    print(f"Distance:      {card['distance']}   Travel time: {card['eta']}")
    print(f"Elevation:     {card['elevation']}")
    print(f"Mobile signal: {card['network']}")
    print(f"Hazard score:  {card['upstream_feed']}   Soil: {card['local_soil']}")
    print(f"Landslide:     {card['landslide_risk']}   Flood: {card['flood_risk']}")
    print(f"Overall:       {card['road_condition']} (confidence {card['confidence']})")

    milestones = card.get("embedded_milestones", [])
    if milestones:
        print("\nOn this sector:")
        for m in milestones:
            print(f"   - {m['km_marker']}: {m['type']} - {m['name']}")

    print(f"\nAdvice: {card['status']}")
    print("=" * 68 + "\n")
