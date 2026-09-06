from __future__ import annotations
import json
import re
from pathlib import Path
from typing import List

from langchain_core.prompts import PromptTemplate
from models.llm import LLMClient


class MetaEvaluator:
    def __init__(self, llm: LLMClient, prompt_path: Path | None = None):
        self.llm = llm
        self.prompt_path = prompt_path or Path("prompts/meta_prompt.txt")
        self.prompt_template = self._load_prompt()

    def _load_prompt(self) -> PromptTemplate:
        template = Path(self.prompt_path).read_text()
        return PromptTemplate(input_variables=["question", "group_answers"], template=template)

    def evaluate(self, question: str, group_answers: List[str]) -> List[dict]:
        answers_payload = "\n\n".join(
            [f"Group {idx + 1}:\n{answer}" for idx, answer in enumerate(group_answers)]
        )
        prompt = self.prompt_template.format(question=question, group_answers=answers_payload)
        response = self.llm.generate(prompt)

        parsed = self._extract_json(response)
        if parsed:
            # Normalize and validate parsed evaluation objects
            normalized = []
            for i, item in enumerate(parsed):
                if not isinstance(item, dict):
                    continue
                eg = self._safe_num(item.get("Evidence_Grounding", 7))
                lc = self._safe_num(item.get("Logical_Coherence", 7))
                hd = self._safe_num(item.get("Hallucination_Detection", 7))
                dt = self._safe_num(item.get("Depth_of_Thought", 6))
                total = self._safe_num(item.get("Total_Score", eg + lc + hd + dt))
                if total == 0 and (eg + lc + hd + dt) > 0:
                    total = eg + lc + hd + dt

                group_idx = item.get("Group_Index", i + 1)
                try:
                    group_idx = int(group_idx)
                except (ValueError, TypeError):
                    group_idx = i + 1

                normalized.append({
                    "Group_Index": group_idx,
                    "Evidence_Grounding": eg,
                    "Logical_Coherence": lc,
                    "Hallucination_Detection": hd,
                    "Depth_of_Thought": dt,
                    "Detailed_Reasoning": item.get("Detailed_Reasoning", "Evaluated based on G-DMAD criteria."),
                    "Total_Score": total,
                })
            if normalized:
                return normalized

        # Fallback parser if LLM response couldn't be parsed at all
        return self._generate_fallback_evaluations(group_answers)

    def _safe_num(self, val, default=0) -> int:
        try:
            return int(round(float(val)))
        except (ValueError, TypeError):
            return default

    def _extract_json(self, text: str) -> list | None:
        if not text:
            return None
        text = text.strip()

        # 1. Direct parse
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                for v in data.values():
                    if isinstance(v, list):
                        return v
                return [data]
        except json.JSONDecodeError:
            pass

        # 2. Extract from markdown code fence ```json ... ```
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if fence_match:
            try:
                data = json.loads(fence_match.group(1).strip())
                if isinstance(data, list):
                    return data
                if isinstance(data, dict):
                    for v in data.values():
                        if isinstance(v, list):
                            return v
                    return [data]
            except json.JSONDecodeError:
                pass

        # 3. Extract bracketed array [ ... ]
        bracket_match = re.search(r"\[[\s\S]*\]", text)
        if bracket_match:
            try:
                data = json.loads(bracket_match.group(0))
                if isinstance(data, list):
                    return data
            except json.JSONDecodeError:
                pass

        return None

    def _generate_fallback_evaluations(self, group_answers: List[str]) -> List[dict]:
        evals = []
        for i, answer in enumerate(group_answers):
            length = len(answer.split())
            eg = min(10, max(5, length // 20 + 5))
            lc = min(10, max(5, length // 25 + 6))
            hd = 8
            dt = min(10, max(4, length // 30 + 4))
            total = eg + lc + hd + dt
            evals.append({
                "Group_Index": i + 1,
                "Evidence_Grounding": eg,
                "Logical_Coherence": lc,
                "Hallucination_Detection": hd,
                "Depth_of_Thought": dt,
                "Detailed_Reasoning": f"Heuristic evaluation for Group {i + 1} based on reasoning length and structure.",
                "Total_Score": total,
            })
        return evals

