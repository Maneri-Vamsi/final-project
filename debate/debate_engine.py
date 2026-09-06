from __future__ import annotations
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, Dict, List, Optional

from group.group_manager import GroupManager
from leader.meta_evaluator import MetaEvaluator
from leader.leader_selector import LeaderSelector
from models.llm import LLMClient


class DebateEngine:
    def __init__(self, llm: LLMClient, groups: int = 2, rounds: int = 3):
        self.llm = llm
        self.groups = groups
        self.rounds = rounds
        self.group_managers: List[GroupManager] = [GroupManager(i + 1, llm) for i in range(groups)]
        self.meta_evaluator = MetaEvaluator(llm)
        self.leader_selector = LeaderSelector()
        self._emit_lock = threading.Lock()

    def run(self, question: str) -> str:
        leader_answer: Optional[str] = None
        last_leader_answer = ""

        for round_number in range(1, self.rounds + 1):
            # Run all groups in parallel
            with ThreadPoolExecutor(max_workers=len(self.group_managers)) as executor:
                futures = {
                    executor.submit(manager.run_round, question, round_number, leader_answer): manager
                    for manager in self.group_managers
                }
                group_results: List[Dict[str, str]] = []
                for future in futures:
                    group_results.append(future.result())

            group_answers = [result["group_answer"] for result in group_results]
            evaluations = self.meta_evaluator.evaluate(question, group_answers)
            chosen_index = self.leader_selector.select_leader(evaluations, round_number=round_number)
            leader_answer = group_answers[chosen_index]
            last_leader_answer = leader_answer

        return self._extract_final_answer(last_leader_answer)

    def _thread_safe_emit(self, emit, event):
        """Emit an event with thread safety."""
        if emit:
            with self._emit_lock:
                emit(event)

    def run_with_trace(
        self,
        question: str,
        emit: Optional[Callable[[dict], None]] = None,
    ) -> Dict[str, object]:
        leader_answer: Optional[str] = None
        last_leader_answer = ""
        last_final_answer = ""
        rounds_trace: List[Dict[str, object]] = []
        groups_snapshot = [
            {
                "group_index": manager.group_index,
                "agents": ["IO_Agent", "CCoT_Agent", "DDCoT_Agent"],
            }
            for manager in self.group_managers
        ]

        self.llm.reset_usage()

        if emit:
            emit({"type": "question_received", "question": question, "token_usage": self.llm.get_usage()})
            emit(
                {
                    "type": "stage_update",
                    "stage": "Initializing Agents",
                    "status": "running",
                }
            )
            emit(
                {
                    "type": "agents_initialized",
                    "groups": groups_snapshot,
                    "total_groups": len(groups_snapshot),
                    "total_agents": len(groups_snapshot) * 3,
                    "total_rounds": self.rounds,
                }
            )
            emit(
                {
                    "type": "stage_update",
                    "stage": "Group Formation",
                    "status": "completed",
                    "groups": groups_snapshot,
                }
            )

        for round_number in range(1, self.rounds + 1):
            round_trace: Dict[str, object] = {
                "round_number": round_number,
                "groups": [],
                "evaluations": [],
                "winner_index": None,
                "leader_answer": "",
            }

            if emit:
                emit(
                    {
                        "type": "round_started",
                        "round_number": round_number,
                        "stage": "Generating Independent Agent Reasoning",
                        "token_usage": self.llm.get_usage(),
                    }
                )

            # Create a thread-safe emit wrapper for parallel execution
            safe_emit = (lambda e: self._thread_safe_emit(emit, e)) if emit else None

            # Run all groups in PARALLEL using threads
            group_results_map: Dict[int, Dict[str, str]] = {}

            with ThreadPoolExecutor(max_workers=len(self.group_managers)) as executor:
                futures = {
                    executor.submit(
                        manager.run_round_with_trace,
                        question,
                        round_number,
                        leader_answer,
                        safe_emit,
                    ): manager
                    for manager in self.group_managers
                }
                for future in as_completed(futures):
                    manager = futures[future]
                    group_result = future.result()
                    group_results_map[manager.group_index] = group_result

            # Reconstruct results in group order
            group_results: List[Dict[str, str]] = []
            for manager in self.group_managers:
                group_result = group_results_map[manager.group_index]
                group_results.append(group_result)
                round_trace["groups"].append(
                    {
                        "group_index": manager.group_index,
                        "agents": {
                            "IO_Agent": group_result["io_answer"],
                            "CCoT_Agent": group_result["ccot_answer"],
                            "DDCoT_Agent": group_result["ddcot_answer"],
                        },
                        "group_answer": group_result["group_answer"],
                    }
                )

            group_answers = [result["group_answer"] for result in group_results]

            if emit:
                emit(
                    {
                        "type": "stage_update",
                        "stage": "Evaluation",
                        "status": "running",
                        "round_number": round_number,
                    }
                )

            evaluations = self.meta_evaluator.evaluate(question, group_answers)
            chosen_index = self.leader_selector.select_leader(evaluations, round_number=round_number)
            leader_answer = group_answers[chosen_index]
            last_leader_answer = leader_answer
            last_final_answer = self._extract_final_answer(leader_answer)

            round_trace["evaluations"] = evaluations
            round_trace["winner_index"] = chosen_index + 1
            round_trace["leader_answer"] = leader_answer
            round_trace["final_answer"] = last_final_answer
            rounds_trace.append(round_trace)

            if emit:
                emit(
                    {
                        "type": "evaluation_completed",
                        "round_number": round_number,
                        "evaluations": evaluations,
                        "token_usage": self.llm.get_usage(),
                    }
                )
                emit(
                    {
                        "type": "winner_selected",
                        "round_number": round_number,
                        "winner_index": chosen_index + 1,
                        "leader_synthesis": leader_answer,
                        "leader_answer": leader_answer,
                        "final_answer": last_final_answer,
                        "token_usage": self.llm.get_usage(),
                    }
                )
                emit(
                    {
                        "type": "leader_synthesis_completed",
                        "round_number": round_number,
                        "leader_synthesis": leader_answer,
                        "leader_answer": leader_answer,
                        "final_answer": last_final_answer,
                        "token_usage": self.llm.get_usage(),
                    }
                )

        final_usage = self.llm.get_usage()

        if emit:
            emit(
                {
                    "type": "final_answer",
                    "leader_synthesis": last_leader_answer,
                    "leader_answer": last_final_answer,
                    "token_usage": final_usage,
                }
            )

        return {
            "leader_answer": last_final_answer,
            "leader_synthesis": last_leader_answer,
            "groups": groups_snapshot,
            "rounds": rounds_trace,
            "total_rounds": self.rounds,
            "token_usage": final_usage,
        }

    def _extract_final_answer(self, group_answer: str) -> str:
        sections = {
            "IO": self._extract_agent_section(group_answer, "IO Agent Answer:", "CCoT Agent Answer:"),
            "CCoT": self._extract_agent_section(group_answer, "CCoT Agent Answer:", "DDCoT Agent Answer:"),
            "DDCoT": self._extract_agent_section(group_answer, "DDCoT Agent Answer:", None),
        }

        for key in ("DDCoT", "CCoT", "IO"):
            candidate = self._strip_final_answer_marker(sections.get(key, ""))
            if candidate:
                return candidate

        return group_answer.strip()

    def _extract_agent_section(self, text: str, start_marker: str, end_marker: str | None) -> str:
        if start_marker not in text:
            return ""
        section = text.split(start_marker, 1)[1]
        if end_marker and end_marker in section:
            section = section.split(end_marker, 1)[0]
        return section.strip()

    def _strip_final_answer_marker(self, text: str) -> str:
        if not text:
            return ""
        match = re.search(r"Final answer\s*:\s*(.*)", text, flags=re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()
        return text.strip()
