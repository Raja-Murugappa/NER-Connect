import os
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder
import joblib

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS_DIR = os.path.join(BASE_DIR, "models")
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(MODELS_DIR, exist_ok=True)

def find_file(filename):
    p = os.path.join(DATA_DIR, filename)
    if not os.path.exists(p):
        p = os.path.join(BASE_DIR, filename)
    if not os.path.exists(p):
        raise FileNotFoundError(f"Missing file: {filename}")
    return p

def train_all_models():
    print("1. Loading datasets with upstream 'current_system_score'...")
    df_ls = pd.read_csv(find_file("landslide_history.csv"))
    df_fl = pd.read_csv(find_file("flood_history.csv"))

    # Train Landslide Risk Classifier
    print("2. Training Landslide Risk Model (Prioritizing upstream hazard score + local context)...")
    le_soil = LabelEncoder()
    df_ls['soil_encoded'] = le_soil.fit_transform(df_ls['soil_type'])

    # Feature matrix with current_system_score as primary feature
    features_ls = ['current_system_score', 'rainfall_mm', 'elevation_m', 'slope_percent', 'soil_encoded']
    X_ls = df_ls[features_ls]
    y_ls = df_ls['landslide_occurred']

    model_ls = GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42)
    model_ls.fit(X_ls, y_ls)

    # Display feature importance breakdown
    importances_ls = dict(zip(features_ls, model_ls.feature_importances_))
    print("   Landslide Model Feature Importances:")
    for feat, imp in sorted(importances_ls.items(), key=lambda x: -x[1]):
        print(f"     • {feat:22s}: {imp*100:.1f}%")

    joblib.dump(model_ls, os.path.join(MODELS_DIR, "landslide_model.joblib"))
    joblib.dump(le_soil, os.path.join(MODELS_DIR, "soil_encoder.joblib"))

    # Train Flood / Inundation Risk Classifier
    print("\n3. Training Flood Risk Model (Prioritizing upstream hazard score + river level)...")
    features_fl = ['current_system_score', 'rainfall_24h_mm', 'river_level_m', 'river_distance_km', 'elevation_m']
    X_fl = df_fl[features_fl]
    y_fl = df_fl['flood_occurred']

    model_fl = GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42)
    model_fl.fit(X_fl, y_fl)

    importances_fl = dict(zip(features_fl, model_fl.feature_importances_))
    print("   Flood Model Feature Importances:")
    for feat, imp in sorted(importances_fl.items(), key=lambda x: -x[1]):
        print(f"     • {feat:22s}: {imp*100:.1f}%")

    joblib.dump(model_fl, os.path.join(MODELS_DIR, "flood_model.joblib"))

    print(f"\n-> All ML models trained and saved in: {MODELS_DIR}")

if __name__ == "__main__":
    train_all_models()
