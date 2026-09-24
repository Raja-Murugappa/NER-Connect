import os
import sys
from flask import Flask, request, jsonify, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from ner_connect.routing.segmenter import generate_road_segments
from ner_connect.intelligence.risk_engine import get_segment_intelligence

app = Flask(__name__, static_folder="web", static_url_path="")

@app.route("/")
def index():
    return send_from_directory("web", "index.html")

@app.route("/api/evaluate", methods=["POST"])
def evaluate():
    try:
        data = request.get_json() or {}
        road_name = data.get("road_name", "Guwahati-Gangtok Strategic Corridor").strip()
        state = data.get("state", "Sikkim").strip()
        district = data.get("district", "East Sikkim").strip()

        start_lat = float(data.get("start_lat", 26.1445))
        start_lon = float(data.get("start_lon", 91.7362))
        end_lat = float(data.get("end_lat", 27.3389))
        end_lon = float(data.get("end_lon", 88.6065))

        scenario = str(data.get("scenario", "1")).strip()
        sim_alert = 0.88 if scenario == "2" else None

        start_coords = (start_lat, start_lon)
        end_coords = (end_lat, end_lon)

        # 1. Generate real road route & mathematical sectors
        total_dist, sectors, route_info = generate_road_segments(
            road_name=road_name,
            state=state,
            district=district,
            start_coords=start_coords,
            end_coords=end_coords
        )

        # 2. Evaluate intelligence for each sector
        evaluated_sectors = []
        total_journey_mins = 0

        for idx, sec in enumerate(sectors, 1):
            active_alert = sim_alert if (sim_alert and idx >= 5) else None
            active_rain = 145.0 if active_alert else None

            card = get_segment_intelligence(sec, sim_alert_score=active_alert, sim_rainfall_24h=active_rain)
            evaluated_sectors.append(card)
            total_journey_mins += card.get("eta_mins", 0)

        tot_hrs = total_journey_mins // 60
        tot_mins = total_journey_mins % 60
        formatted_total_eta = f"{tot_hrs}h {tot_mins}m" if tot_hrs > 0 else f"{tot_mins} mins"

        response_payload = {
            "status": "SUCCESS",
            "corridor": road_name,
            "routing_source": route_info.get("source", "OpenStreetMap (OSRM Router)"),
            "total_distance_km": total_dist,
            "total_journey_eta": formatted_total_eta,
            "total_journey_mins": total_journey_mins,
            "full_polyline": route_info.get("polyline", []),
            "junctions": route_info.get("junctions", []),
            "bridges": route_info.get("bridges", []),
            "sectors": evaluated_sectors
        }

        return jsonify(response_payload)
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

if __name__ == "__main__":
    print("\n=======================================================")
    print("🌐 NER-Connect 2D Web Server Running")
    print("   Open in your browser: http://127.0.0.1:5000")
    print("=======================================================\n")
    app.run(host="127.0.0.1", port=5000, debug=False)
