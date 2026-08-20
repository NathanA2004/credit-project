"""JSON in / JSON out inference bridge for the Next.js /api/recommend route.

Reads one JSON object from stdin:

  {
    "amount": 150,
    "category": "groceries",
    "referenceDate": "2026-08-19",
    "cards": [{ "id", "cardName", "institutionName", "lastFourDigits",
                "creditLimit", "currentBalance", "apr",
                "statementClosingDay", "paymentDueDay", "cashbackCategory" }]
  }

Prints ranked cards with utility scores. Uses ONNX if present, else the
PyTorch checkpoint, else the same heuristic the network was trained on.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import numpy as np

ML_DIR = Path(__file__).resolve().parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from dates import days_since_statement_close, days_until_due
from features import ARTIFACT_DIR, FEATURE_NAMES, cashback_rate, encode_category
from heuristic import teacher_utility

ONNX_PATH = ARTIFACT_DIR / "card_ranker.onnx"
CHECKPOINT_PATH = ARTIFACT_DIR / "card_ranker.pt"


def _num(value: Any) -> float:
    return float(value)


def build_features(payload: dict[str, Any]) -> tuple[list[dict[str, Any]], np.ndarray]:
    amount = _num(payload["amount"])
    category = str(payload["category"])
    reference = payload.get("referenceDate") or payload.get("reference_date")
    if not reference:
        from datetime import date

        reference = date.today().isoformat()

    rows: list[dict[str, Any]] = []
    matrix: list[list[float]] = []

    for card in payload.get("cards") or []:
        limit = max(_num(card["creditLimit"]), 1e-6)
        balance = _num(card["currentBalance"])
        utilization = (balance + amount) / limit
        due_in = days_until_due(int(card["statementClosingDay"]), int(card["paymentDueDay"]), reference)
        since_close = days_since_statement_close(int(card["statementClosingDay"]), reference)
        rate = cashback_rate(card.get("cashbackCategory") or {}, category)
        vector = [
            amount,
            float(encode_category(category)),
            _num(card["apr"]),
            float(due_in),
            float(since_close),
            float(utilization),
            rate,
        ]
        eligible = utilization <= 1.0
        rows.append(
            {
                "cardId": card.get("id"),
                "cardName": card.get("cardName"),
                "institutionName": card.get("institutionName"),
                "lastFourDigits": card.get("lastFourDigits"),
                "eligible": eligible,
                "cashbackRate": rate,
                "rewardAmount": round(amount * rate, 2),
                "daysUntilDue": due_in,
                "daysSinceStatementClose": since_close,
                "utilizationAfter": round(utilization, 4),
                "features": dict(zip(FEATURE_NAMES, vector)),
            }
        )
        matrix.append(vector)

    if not matrix:
        return rows, np.zeros((0, len(FEATURE_NAMES)), dtype=np.float32)
    return rows, np.asarray(matrix, dtype=np.float32)


def score_with_onnx(features: np.ndarray) -> np.ndarray | None:
    if not ONNX_PATH.exists():
        return None
    try:
        import onnxruntime as ort
    except ImportError:
        return None
    session = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])
    outputs = session.run(["utility"], {"features": features})[0]
    return np.asarray(outputs, dtype=np.float32).reshape(-1)


def score_with_torch(features: np.ndarray) -> np.ndarray | None:
    if not CHECKPOINT_PATH.exists():
        return None
    try:
        from ranker import load_ranker, score_feature_matrix

        model = load_ranker(CHECKPOINT_PATH)
        return score_feature_matrix(model, features).reshape(-1)
    except Exception:
        return None


def score_with_heuristic(features: np.ndarray) -> np.ndarray:
    return np.array([teacher_utility(row) for row in features], dtype=np.float32)


def rank(payload: dict[str, Any]) -> dict[str, Any]:
    rows, features = build_features(payload)
    if features.shape[0] == 0:
        return {"rankings": [], "source": "none"}

    source = "heuristic"
    scores = score_with_onnx(features)
    if scores is not None:
        source = "onnx"
    else:
        torch_scores = score_with_torch(features)
        if torch_scores is not None:
            scores = torch_scores
            source = "pytorch"
        else:
            scores = score_with_heuristic(features)

    for row, score, vector in zip(rows, scores, features):
        # Over-limit cards are never recommended, even if the net is slightly off.
        row["score"] = -1.0 if not row["eligible"] else round(float(score), 6)
        row["teacherScore"] = round(float(teacher_utility(vector)), 6)

    rows.sort(key=lambda item: item["score"], reverse=True)
    return {"rankings": rows, "source": source}


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("expected JSON on stdin", file=sys.stderr)
        return 1
    result = rank(json.loads(raw))
    json.dump(result, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
