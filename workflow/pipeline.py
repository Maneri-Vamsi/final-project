from __future__ import annotations
from typing import Callable, Dict

from models.llm import LLMClient
from config.config import GDMADSettings
from debate.debate_engine import DebateEngine


class DebatePipeline:
    def __init__(self, settings: GDMADSettings):
        self.settings = settings
        self.llm = LLMClient(settings)
        self.engine = DebateEngine(self.llm, groups=self.settings.groups, rounds=self.settings.rounds)

    def run(self, question: str) -> str:
        return self.engine.run(question)

    def run_with_trace(self, question: str, emit: Callable[[dict], None] | None = None) -> Dict[str, object]:
        return self.engine.run_with_trace(question, emit)
