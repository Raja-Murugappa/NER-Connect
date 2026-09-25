import os
import sys
from flask import Flask, request, jsonify, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from ner_connect.routing.route_engine import (
    resolve_location, get_osrm_route, GeocodingError, RoutingUnavailableError,
)
from ner_connect.routing.route_options import score_route, get_alternative_options
from ner_connect.routing.reroute_engine import evaluate_disruption
from ner_connect.intelligence.district_status import list_districts, route_status_to_hub

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

        # "origin"/"destination" may be place names or {lat, lon, name} objects;
        # the legacy start_lat/start_lon/end_lat/end_lon fields are still accepted.
        origin = resolve_location(data.get("origin") or {
            "lat": data.get("start_lat", 26.1445),
            "lon": data.get("start_lon", 91.7362),
        })
        destination = resolve_location(data.get("destination") or {
            "lat": data.get("end_lat", 27.3389),
            "lon": data.get("end_lon", 88.6065),
        })

        scenario = str(data.get("scenario", "1")).strip()

        start_coords = (origin["lat"], origin["lon"])
        end_coords = (destination["lat"], destination["lon"])

        # Real road route, cut into sectors, each sector risk-scored
        route_info = get_osrm_route(start_coords, end_coords)
        scored = score_route(route_info, road_name, scenario, state, district)

        response_payload = {
            "status": "SUCCESS",
            "corridor": road_name,
            "origin": origin,
            "destination": destination,
            "routing_status": route_info.get("status", "SUCCESS"),
            "routing_warning": route_info.get("warning"),
            "routing_source": route_info.get("source", "OpenStreetMap road network (OSRM)"),
            "total_distance_km": route_info["distance_km"],
            "total_journey_eta": scored["eta"],
            "total_journey_mins": scored["eta_mins"],
            "risk": scored["risk"],
            "full_polyline": route_info.get("polyline", []),
            "junctions": route_info.get("junctions", []),
            "bridges": route_info.get("bridges", []),
            "sectors": scored["sectors"]
        }

        return jsonify(response_payload)
    except GeocodingError as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

@app.route("/api/route-options", methods=["POST"])
def route_options():
    """
    Other real road routes between the same places as /api/evaluate, each risk-scored, so the
    operator can compare them. Separate from /api/evaluate because the public routing server
    can take a while to compute alternatives; the main route is shown first.
    Body: {origin, destination (place names or {lat, lon, name}), road_name?, scenario?}
    """
    try:
        data = request.get_json() or {}
        origin = resolve_location(data.get("origin"))
        destination = resolve_location(data.get("destination"))
        road_name = str(data.get("road_name", "Corridor")).strip()
        scenario = str(data.get("scenario", "1")).strip()
        start_coords = (origin["lat"], origin["lon"])
        end_coords = (destination["lat"], destination["lon"])

        primary = get_osrm_route(start_coords, end_coords)
        if primary.get("status") != "SUCCESS":
            return jsonify({"status": "SUCCESS", "alternatives": [], "searched": False,
                            "message": "The routing service is unavailable, so other routes could not be checked."})
        try:
            alternatives = get_alternative_options(start_coords, end_coords, primary["polyline"],
                                                   road_name, scenario)
        except RoutingUnavailableError:
            return jsonify({"status": "SUCCESS", "alternatives": [], "searched": False,
                            "message": "The routing service did not respond, so other routes could not be checked."})
        return jsonify({"status": "SUCCESS", "alternatives": alternatives, "searched": True})
    except GeocodingError as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

@app.route("/api/reroute", methods=["POST"])
def reroute():
    """
    Evaluates a newly reported disruption against an active journey.
    Body: {current_route: [[lat, lon], ...] (ends at the destination), truck_position: [lat, lon],
           disruption: {lat, lon, radius_km, type, severity},
           road_name?, scenario?, outcome?: "auto" | "force_reroute" | "force_hold"}
    """
    try:
        data = request.get_json() or {}
        route = data.get("current_route") or []
        truck = data.get("truck_position")
        disruption = data.get("disruption") or {}
        if len(route) < 2 or not truck or "lat" not in disruption:
            return jsonify({"status": "ERROR", "message": "current_route, truck_position "
                                                          "and disruption are required"}), 400

        result = evaluate_disruption(
            current_route=route,
            truck_position=(float(truck[0]), float(truck[1])),
            disruption=disruption,
            road_name=str(data.get("road_name", "Active Journey")),
            scenario=str(data.get("scenario", "1")),
            outcome=str(data.get("outcome", "auto")),
        )
        return jsonify(result)
    except ValueError as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

@app.route("/api/districts", methods=["GET"])
def districts_route():
    """The 31 sample districts with their centroid, for the district connectivity page.
    No routing calls - instant."""
    try:
        return jsonify({"status": "SUCCESS", "districts": list_districts()})
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

@app.route("/api/district-route-status", methods=["GET"])
def district_route_status_route():
    """
    How many genuinely different real roads reach one district from the regional hub
    (Guwahati) - real OSRM work, so this is checked per district on request rather than for
    all districts up front. Query params: lat, lon (the district's centroid).
    """
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
    except (TypeError, ValueError):
        return jsonify({"status": "ERROR", "message": "lat and lon query parameters are required"}), 400
    try:
        return jsonify(route_status_to_hub(lat, lon))
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

if __name__ == "__main__":
    print("\n=======================================================")
    print("🌐 NER-Connect 2D Web Server Running")
    print("   Open in your browser: http://127.0.0.1:5000")
    print("=======================================================\n")
    # threaded=True: /api/route-options can take 5-15s on the public OSRM server, and without
    # this Flask's dev server handles one request at a time, so switching to another corridor
    # while that search is still running queues up behind it instead of starting right away.
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
