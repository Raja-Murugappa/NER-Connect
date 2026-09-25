"""
District list for the Connectivity page.

The route-accessibility check itself (how many roads reach a district, how many are
currently available) is a simulation, deliberately not real OSRM work - generated instantly
on the frontend, differently each time it's checked, and labelled as simulated in the UI.
This module only supplies the real part: the district names themselves.
"""
import os

import pandas as pd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")


def list_districts() -> list:
    """One row per district: state, name, and its centroid (mean of its sample points)."""
    path = os.path.join(DATA_DIR, "administrative_boundaries.csv")
    df = pd.read_csv(path)
    rows = []
    for (state, district), g in df.groupby(["state", "district"]):
        rows.append({
            "state": state,
            "district": district,
            "latitude": round(float(g["latitude"].mean()), 4),
            "longitude": round(float(g["longitude"].mean()), 4),
        })
    rows.sort(key=lambda r: (r["state"], r["district"]))
    return rows
