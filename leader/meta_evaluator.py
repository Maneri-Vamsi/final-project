from __future__ import annotations
import json
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
        try:
            parsed = json.loads(response)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass

        # Fallback parser for simple outputs
        return [{"Group_Index": i + 1, "Total_Score": 0} for i in range(len(group_answers))]
