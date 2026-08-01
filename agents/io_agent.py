from __future__ import annotations
from pathlib import Path
from typing import Optional

from langchain_core.prompts import PromptTemplate
from memory.context import GroupContext
from models.llm import LLMClient


class IOAgent:
    def __init__(self, llm: LLMClient, prompt_path: Optional[Path] = None):
        self.llm = llm
        self.prompt_path = prompt_path or Path("prompts/io_prompt.txt")
        self.prompt_template = self._load_prompt()

    def _load_prompt(self) -> PromptTemplate:
        template = Path(self.prompt_path).read_text()
        return PromptTemplate(input_variables=["round_number", "question", "context"], template=template)

    def run(self, question: str, round_number: int, context_text: str) -> str:
        prompt = self.prompt_template.format(
            round_number=round_number,
            question=question,
            context=context_text or "None",
        )
        return self.llm.generate(prompt)
