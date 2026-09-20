from __future__ import annotations
from pathlib import Path
from typing import Optional

from langchain_core.prompts import PromptTemplate
from models.llm import LLMClient


class CCoTAgent:
    def __init__(self, llm: LLMClient, prompt_path: Optional[Path] = None):
        self.llm = llm
        self.prompt_path = prompt_path or Path("prompts/ccot_prompt.txt")
        self.prompt_template = self._load_prompt()
        self.token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "api_calls": 0}
        self.last_token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    def reset_usage(self):
        self.token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "api_calls": 0}
        self.last_token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    def _load_prompt(self) -> PromptTemplate:
        template = Path(self.prompt_path).read_text()
        return PromptTemplate(input_variables=["round_number", "question", "context", "scene_graph"], template=template)

    def run(self, question: str, round_number: int, context_text: str, extra_info: str) -> str:
        base_scene_graph = "{}"
        prompt = self.prompt_template.format(
            round_number=round_number,
            question=question,
            context=context_text or "None",
            scene_graph=base_scene_graph,
        )
        content, usage = self.llm.generate_with_usage(prompt)
        self.last_token_usage = usage
        self.token_usage["prompt_tokens"] += usage.get("prompt_tokens", 0)
        self.token_usage["completion_tokens"] += usage.get("completion_tokens", 0)
        self.token_usage["total_tokens"] += usage.get("total_tokens", 0)
        self.token_usage["api_calls"] += 1
        return content
