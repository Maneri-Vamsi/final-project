from __future__ import annotations
from typing import Callable, Dict, Optional

from agents.ccot_agent import CCoTAgent
from agents.ddcot_agent import DDCoTAgent
from agents.io_agent import IOAgent
from memory.context import GroupContext
from models.llm import LLMClient


class GroupManager:
    def __init__(self, group_index: int, llm: LLMClient):
        self.group_index = group_index
        self.llm = llm
        self.context = GroupContext(group_index)
        self.io_agent = IOAgent(llm)
        self.ccot_agent = CCoTAgent(llm)
        self.ddcot_agent = DDCoTAgent(llm)

    def _render_context(self) -> str:
        base_context = self.context.render()
        role_desc = (
            "Debate Perspective: Group 1 [Analytical & Constructive] — Emphasize foundational evidence, core facts, direct reasoning, and clear affirmative derivations."
            if self.group_index == 1
            else "Debate Perspective: Group 2 [Critical & Dialectical] — Scrutinize hidden assumptions, analyze edge cases, explore counter-arguments, and stress-test alternatives."
        )
        if base_context:
            return f"[{role_desc}]\n\n{base_context}"
        return f"[{role_desc}]"

    def run_round(self, question: str, round_number: int, leader_answer: Optional[str] = None) -> Dict[str, str]:
        context_text = self._render_context()
        if leader_answer:
            self.context.add_leader_answer(leader_answer, round_number - 1)
            context_text = self._render_context()

        io_answer = self.io_agent.run(question, round_number, context_text)
        self.context.append("IO_Agent", io_answer)

        ccot_answer = self.ccot_agent.run(question, round_number, context_text, io_answer)
        self.context.append("CCoT_Agent", ccot_answer)

        ddcot_answer = self.ddcot_agent.run(question, round_number, context_text, f"IO Answer:\n{io_answer}\nCCoT Answer:\n{ccot_answer}")
        self.context.append("DDCoT_Agent", ddcot_answer)

        group_answer = self._aggregate_group_answer(io_answer, ccot_answer, ddcot_answer)
        self.context.append("Group_Answer", group_answer)

        return {
            "io_answer": io_answer,
            "ccot_answer": ccot_answer,
            "ddcot_answer": ddcot_answer,
            "group_answer": group_answer,
        }

    def run_round_with_trace(
        self,
        question: str,
        round_number: int,
        leader_answer: Optional[str] = None,
        emit: Optional[Callable[[dict], None]] = None,
    ) -> Dict[str, str]:
        context_text = self._render_context()
        if leader_answer:
            self.context.add_leader_answer(leader_answer, round_number - 1)
            context_text = self._render_context()
            if emit:
                emit(
                    {
                        "type": "leader_context_applied",
                        "group_index": self.group_index,
                        "round_number": round_number,
                        "leader_answer": leader_answer,
                    }
                )

        agents = [
            ("IO_Agent", "io_answer", lambda: self.io_agent.run(question, round_number, context_text)),
            (
                "CCoT_Agent",
                "ccot_answer",
                lambda io_answer=None: self.ccot_agent.run(question, round_number, context_text, results["io_answer"]),
            ),
            (
                "DDCoT_Agent",
                "ddcot_answer",
                lambda: self.ddcot_agent.run(
                    question,
                    round_number,
                    context_text,
                    f"IO Answer:\n{results['io_answer']}\nCCoT Answer:\n{results['ccot_answer']}",
                ),
            ),
        ]

        results: Dict[str, str] = {}

        for agent_name, result_key, runner in agents:
            if emit:
                emit(
                    {
                        "type": "agent_started",
                        "group_index": self.group_index,
                        "round_number": round_number,
                        "agent_name": agent_name,
                        "token_usage": self.llm.get_usage(),
                    }
                )

            answer = runner()
            results[result_key] = answer
            self.context.append(agent_name, answer)

            if emit:
                emit(
                    {
                        "type": "agent_completed",
                        "group_index": self.group_index,
                        "round_number": round_number,
                        "agent_name": agent_name,
                        "answer": answer,
                        "token_usage": self.llm.get_usage(),
                    }
                )

        group_answer = self._aggregate_group_answer(
            results["io_answer"],
            results["ccot_answer"],
            results["ddcot_answer"],
        )
        self.context.append("Group_Answer", group_answer)

        results["group_answer"] = group_answer

        if emit:
            emit(
                {
                    "type": "group_round_completed",
                    "group_index": self.group_index,
                    "round_number": round_number,
                    "group_answer": group_answer,
                    "agent_answers": {
                        "IO_Agent": results["io_answer"],
                        "CCoT_Agent": results["ccot_answer"],
                        "DDCoT_Agent": results["ddcot_answer"],
                    },
                    "token_usage": self.llm.get_usage(),
                }
            )

        return results

    def _aggregate_group_answer(self, io_answer: str, ccot_answer: str, ddcot_answer: str) -> str:
        return (
            f"IO Agent Answer:\n{io_answer}\n\n"
            f"CCoT Agent Answer:\n{ccot_answer}\n\n"
            f"DDCoT Agent Answer:\n{ddcot_answer}"
        )
