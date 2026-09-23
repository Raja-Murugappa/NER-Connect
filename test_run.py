import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from road_segmenter import generate_road_segments
from segment_intelligence import get_segment_intelligence, print_segment_card

def run():
    print("\n" + "=" * 65)
    print("🚦 SIH 26002: INTERACTIVE ROAD SEGMENT & RISK EVALUATOR")
    print("=" * 65)

    # 1. User Inputs with practical defaults
    road_name = input("Enter Road Name (default='Guwahati-Gangtok Corridor'): ").strip()
    if not road_name:
        road_name = "Guwahati-Gangtok Corridor"

    state = input("Enter State Name (default='Sikkim'): ").strip()
    if not state:
        state = "Sikkim"

    district = input("Enter District Name (default='East Sikkim'): ").strip()
    if not district:
        district = "East Sikkim"

    # Start Coordinates
    start_lat_in = input("Enter Start Latitude  (default=26.1445): ").strip()
    start_lat = float(start_lat_in) if start_lat_in else 26.1445

    start_lon_in = input("Enter Start Longitude (default=91.7362): ").strip()
    start_lon = float(start_lon_in) if start_lon_in else 91.7362

    # End Coordinates
    end_lat_in = input("Enter End Latitude    (default=27.3389): ").strip()
    end_lat = float(end_lat_in) if end_lat_in else 27.3389

    end_lon_in = input("Enter End Longitude   (default=88.6065): ").strip()
    end_lon = float(end_lon_in) if end_lon_in else 88.6065

    # Optional Hazard Simulation
    sim_choice = input("\nSimulate heavy monsoon storm on road? (y/n, default=n): ").strip().lower()
    sim_rain = 175.0 if sim_choice == "y" else None

    # 2. Run Segmentation Engine
    start_coords = (start_lat, start_lon)
    end_coords = (end_lat, end_lon)

    total_dist, segments = generate_road_segments(
        road_name=road_name,
        state=state,
        district=district,
        start_coords=start_coords,
        end_coords=end_coords
    )

    print("\n" + "=" * 65)
    print(f"CORRIDOR: {road_name}")
    print(f"Total Geodesic Distance: {total_dist:.1f} km")
    if total_dist < 100.0:
        print(f"Rule Applied: < 100 km ➔ EXACTLY 2 EQUAL SEGMENTS ({len(segments)} segments)")
    else:
        print(f"Rule Applied: >= 100 km ➔ 50 KM BLOCKS + REMAINDER ({len(segments)} segments)")
    print("=" * 65 + "\n")

    # 3. Evaluate each segment card
    for idx, seg in enumerate(segments, 1):
        # If storm simulation is selected, apply it on the middle/later segments
        rain_val = sim_rain if (sim_rain and idx >= 2) else None
        card = get_segment_intelligence(seg, sim_rainfall_24h=rain_val)
        print_segment_card(card)

    print("=" * 65)
    print(f"✅ COMPLETED: Evaluated {len(segments)} segments successfully.")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    run()