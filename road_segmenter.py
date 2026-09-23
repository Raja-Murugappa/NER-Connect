"""
Backwards-compatible wrapper module pointing to ner_connect.routing.
"""
from ner_connect.utils.geo_math import haversine_distance
from ner_connect.routing.segmenter import generate_road_segments

__all__ = ["haversine_distance", "generate_road_segments"]