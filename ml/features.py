from __future__ import annotations

import json
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent
FEATURE_SPEC_PATH = ML_DIR / "feature_spec.json"
ARTIFACT_DIR = ML_DIR / "artifacts"

with FEATURE_SPEC_PATH.open(encoding="utf-8") as spec_file:
    FEATURE_SPEC = json.load(spec_file)

FEATURE_NAMES: list[str] = FEATURE_SPEC["feature_names"]
FEATURE_DIM = len(FEATURE_NAMES)
CATEGORIES: dict[str, int] = FEATURE_SPEC["categories"]
DEFAULT_CATEGORY_ID: int = FEATURE_SPEC["default_category_id"]


def encode_category(category: str) -> int:
    return CATEGORIES.get(category.strip().lower(), DEFAULT_CATEGORY_ID)


def cashback_rate(cashback_category: dict | None, category: str) -> float:
    mapping = cashback_category or {}
    key = category.strip().lower()
    if key in mapping:
        return float(mapping[key])
    if "default" in mapping:
        return float(mapping["default"])
    return 0.0
