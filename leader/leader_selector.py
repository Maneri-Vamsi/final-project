from __future__ import annotations
from typing import List


class LeaderSelector:
    def select_leader(self, evaluations: List[dict]) -> int:
        best_index = 0
        best_score = float('-inf')
        for idx, eval_result in enumerate(evaluations):
            score = eval_result.get("Total_Score", 0)
            if score > best_score:
                best_score = score
                best_index = idx
        return best_index
