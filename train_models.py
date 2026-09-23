"""
Backwards-compatible wrapper module pointing to ner_connect.training.
"""
from ner_connect.training.train import train_all_models

if __name__ == "__main__":
    train_all_models()