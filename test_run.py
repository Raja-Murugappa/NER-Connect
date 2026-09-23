import os
import sys

# Ensure UTF-8 output encoding for Windows PowerShell / CMD
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from ner_connect.routing.segmenter import generate_road_segments
from ner_connect.intelligence.risk_engine import get_segment_intelligence, print_segment_card

def run():
    print("\n" + "=" * 70)
    print("🚦 SIH 26002: SMART FEATURE-AWARE ROAD & RISK INTELLIGENCE PLATFORM")
    print("   OpenStreetMap (OSRM) Polyline + Open-Meteo Dynamic Slicing")
    print("=" * 70)

    # 1. User Inputs with practical defaults
    road_name = input("Enter Road Name (default='Guwahati-Gangtok Strategic Corridor'): ").strip()
    if not road_name:
        road_name = "Guwahati-Gangtok Strategic Corridor"

    state = input("Enter State Name (default='Sikkim'): ").strip()
    if not state:
        state = "Sikkim"

    district = input("Enter District Name (default='East Sikkim'): ").strip()
    if not district:
        district = "East Sikkim"

    # Start Coordinates
    start_lat_in = input("Enter Start Latitude  (default=26.1445 [Guwahati]): ").strip()
    start_lat = float(start_lat_in) if start_lat_in else 26.1445

    start_lon_in = input("Enter Start Longitude (default=91.7362 [Guwahati]): ").strip()
    start_lon = float(start_lon_in) if start_lon_in else 91.7362

    # End Coordinates
    end_lat_in = input("Enter End Latitude    (default=27.3389 [Gangtok]): ").strip()
    end_lat = float(end_lat_in) if end_lat_in else 27.3389

    end_lon_in = input("Enter End Longitude   (default=88.6065 [Gangtok]): ").strip()
    end_lon = float(end_lon_in) if end_lon_in else 88.6065

    # Optional Hazard Simulation
    sim_choice = input("\nSimulate active monsoon storm event on route? (y/n, default=n): ").strip().lower()
    sim_rain = 165.0 if sim_choice == "y" else None

    # 2. Run Smart Feature-Aware Segmentation Engine
    start_coords = (start_lat, start_lon)
    end_coords = (end_lat, end_lon)

    print("\n🌐 Querying OpenStreetMap OSRM Route Engine & Terrain Elevation...")
    total_dist, segments, route_info = generate_road_segments(
        road_name=road_name,
        state=state,
        district=district,
        start_coords=start_coords,
        end_coords=end_coords
    )

    print("\n" + "=" * 70)
    print(f"CORRIDOR: {road_name}")
    print(f"Routing Source: {route_info['source']}")
    print(f"Total Driving Distance: {total_dist:.1f} km  |  Total Highway Waypoints: {len(route_info['polyline'])}")
    print(f"Smart Dynamic Segments: {len(segments)} segments (sliced at checkposts, junctions & mountain passes)")
    print("=" * 70 + "\n")

    # 3. Evaluate each smart segment
    for idx, seg in enumerate(segments, 1):
        # If storm simulation is selected, apply to high-altitude / mountain segments
        rain_val = sim_rain if (sim_rain and idx >= 4) else None
        card = get_segment_intelligence(seg, sim_rainfall_24h=rain_val)
        print_segment_card(card)

    print("=" * 70)
    print(f"✅ COMPLETED: Evaluated {len(segments)} smart operational segments successfully.")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    run()