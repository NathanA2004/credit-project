from __future__ import annotations

import numpy as np


def teacher_utility(row: np.ndarray) -> float:
    """Heuristic the network imitates: rewards, remaining float, utilization headroom."""
    _amount, _category_id, apr, days_until_due, days_since_close, util, cashback = row
    if util >= 1.0:
        return -1.0

    reward = float(np.clip(cashback / 0.06, 0.0, 1.0))
    grace = 0.6 * float(np.clip(days_until_due / 45.0, 0.0, 1.0)) + 0.4 * float(
        np.clip(1.0 - days_since_close / 30.0, 0.0, 1.0)
    )
    utilization_impact = 1.0 - float(np.clip(util, 0.0, 1.0))
    apr_penalty = float(np.clip(apr / 30.0, 0.0, 1.0)) * float(np.clip(util, 0.0, 1.0))
    score = 0.50 * reward + 0.30 * grace + 0.20 * utilization_impact - 0.05 * apr_penalty
    return float(np.clip(score, -1.0, 1.0))
