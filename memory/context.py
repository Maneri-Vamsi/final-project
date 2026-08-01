from __future__ import annotations
from typing import List


class GroupContext:
    def __init__(self, group_index: int):
        self.group_index = group_index
        self.entries: List[str] = []

    def append(self, label: str, content: str) -> None:
        if content is None:
            return
        entry = f"[{label}] {content.strip()}"
        self.entries.append(entry)

    def render(self) -> str:
        if not self.entries:
            return ""
        return "\n".join(self.entries)

    def add_leader_answer(self, answer: str, round_number: int) -> None:
        if answer:
            self.append(f"Leader_Round_{round_number}", answer)
