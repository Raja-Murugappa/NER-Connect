import os
import sys

# Ensure UTF-8 output encoding for Windows PowerShell / CMD
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from ner_connect.routing.segmenter import generate_road_segments
from ner_connect.intelligence.risk_engine import evaluate_sectors, format_eta, print_segment_card

def run():
    print("\n" + "=" * 70)
    print("🚦 SIH 26002: SMART LOGISTICS ACCESSIBILITY INTELLIGENCE PLATFORM")
    print("   Ingesting Upstream Prediction Systems (ISRO/CWC) + Local Ground Context")
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

    # Optional Upstream Alert Ingestion Demo
    print("\n📡 External Hazard Feed Options:")
    print("  [1] Normal Daily Operations (Standard baseline alert feeds)")
    print("  [2] Ingest Active ISRO/CWC Severe Hazard Warning (Score = 0.88 on mountain sectors)")
    choice = input("Select feed scenario (1/2, default=1): ").strip()

    # 2. Run Mathematical & Priority-Based Slicing Engine
    start_coords = (start_lat, start_lon)
    end_coords = (end_lat, end_lon)

    print("\n🌐 Querying OpenStreetMap OSRM Route & Calculating Mathematical Sectors...")
    total_dist, sectors, route_info = generate_road_segments(
        road_name=road_name,
        state=state,
        district=district,
        start_coords=start_coords,
        end_coords=end_coords
    )

    # 3. Evaluate each strategic sector and compute Total Journey ETA
    # In scenario 2, a simulated severe alert is applied to mountain-terrain sectors
    sector_cards, total_journey_mins = evaluate_sectors(sectors, "2" if choice == "2" else "1")
    formatted_total_eta = format_eta(total_journey_mins)

    print("\n" + "=" * 70)
    print(f"CORRIDOR:          {road_name}")
    print(f"Routing Source:    {route_info['source']}")
    print(f"Total Distance:    {total_dist:.1f} km")
    print(f"TOTAL JOURNEY ETA: ⏱️  {formatted_total_eta} ({total_journey_mins} mins total travel time)")
    print(f"Optimized Sectors: {len(sectors)} Strategic Sectors (Strict min threshold: >= 50.0 km)")
    print("=" * 70 + "\n")

    # 4. Display each sector card
    for card in sector_cards:
        print_segment_card(card)

    print("=" * 70)
    print(f"✅ COMPLETED: Evaluated {len(sectors)} optimized strategic sectors.")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    run()