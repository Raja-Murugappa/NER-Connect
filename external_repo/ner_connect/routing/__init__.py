from .route_engine import get_osrm_route
from .segmenter import generate_road_segments, create_smart_dynamic_segments

slice_polyline_into_segments = create_smart_dynamic_segments

__all__ = [
    "get_osrm_route",
    "generate_road_segments",
    "create_smart_dynamic_segments",
    "slice_polyline_into_segments"
]
