from __future__ import annotations
from typing import List, Optional


class LeaderSelector:
    def select_leader(self, evaluations: List[dict], round_number: Optional[int] = None) -> int:
        if not evaluations:
            return 0

        def score_tuple(idx: int, ev: dict):
            # Primary: Total Score
            total = float(ev.get("Total_Score", 0))
            # Secondary: Depth of Thought
            depth = float(ev.get("Depth_of_Thought", 0))
            # Tertiary: Evidence Grounding
            evidence = float(ev.get("Evidence_Grounding", 0))
            # Quaternary: Logical Coherence
            logic = float(ev.get("Logical_Coherence", 0))
            # Quinary: Length of detailed explanation
            reasoning_len = len(str(ev.get("Detailed_Reasoning", "")))
            # If everything is strictly tied, rotate tie-break by round number
            round_bonus = 0.01 if (round_number is not None and (round_number % len(evaluations) == idx)) else 0.0
            return (total, depth, evidence, logic, reasoning_len, round_bonus)

        best_index = 0
        best_tuple = score_tuple(0, evaluations[0])

        for idx in range(1, len(evaluations)):
            current_tuple = score_tuple(idx, evaluations[idx])
            if current_tuple > best_tuple:
                best_tuple = current_tuple
                best_index = idx

        return best_index

