"""
Backwards-compatible wrapper module pointing to ner_connect.intelligence.
"""
from ner_connect.intelligence.risk_engine import (
    BASE_DIR,
    MODELS_DIR,
    model_ls,
    model_fl,
    le_soil,
    df_terrain,
    df_weather,
    df_network,
    tree_terrain,
    tree_weather,
    tree_network,
    query_nearest_record,
    get_segment_intelligence,
    print_segment_card,
)

__all__ = [
    "model_ls",
    "model_fl",
    "le_soil",
    "df_terrain",
    "df_weather",
    "df_network",
    "tree_terrain",
    "tree_weather",
    "tree_network",
    "query_nearest_record",
    "get_segment_intelligence",
    "print_segment_card",
]