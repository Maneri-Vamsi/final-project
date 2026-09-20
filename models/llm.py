import json
import threading
import time
from typing import Optional

from config.config import GDMADSettings

try:
    from openai import OpenAI, APIError, RateLimitError
except ImportError:
    OpenAI = None  # OpenAI SDK is optional when using mock mode
    APIError = Exception
    RateLimitError = Exception


class LLMClient:
    def __init__(self, settings: GDMADSettings):
        self.settings = settings
        self.use_mock = self.settings.use_mock_llm
        self.api_key = self.settings.api_key
        self.model_name = self.settings.model_name
        self.client = None
        self.enabled = False

        # Thread-safe token usage tracking
        self._lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.total_tokens = 0
        self.api_calls = 0

        if self.use_mock:
            self.enabled = True
            return

        if self.api_key and OpenAI is not None:
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=self.settings.api_base if self.settings.api_base else None,
            )
            self.enabled = True

    def generate_with_usage(
        self, prompt: str, temperature: Optional[float] = None, max_tokens: Optional[int] = None
    ) -> tuple[str, dict]:
        if not self.enabled:
            return (
                "No API key found and mock LLM is disabled. Set USE_MOCK_LLM=true or provide an API key.",
                {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            )

        if self.use_mock:
            return self._mock_generate_with_usage(prompt)

        params = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature if temperature is not None else self.settings.temperature,
            "max_tokens": max_tokens if max_tokens is not None else self.settings.max_tokens,
        }

        response = None
        max_retries = 5
        backoff = 2.0
        for attempt in range(max_retries):
            try:
                response = self.client.chat.completions.create(**params)
                break
            except RateLimitError as e:
                if attempt == max_retries - 1:
                    raise e
                time.sleep(backoff)
                backoff *= 2
            except APIError as e:
                if attempt == max_retries - 1:
                    raise e
                time.sleep(backoff)

        prompt_tokens = 0
        completion_tokens = 0
        total_tokens = 0
        if response.usage:
            prompt_tokens = response.usage.prompt_tokens or 0
            completion_tokens = response.usage.completion_tokens or 0
            total_tokens = response.usage.total_tokens or (prompt_tokens + completion_tokens)

        # Track global token usage (thread-safe)
        with self._lock:
            self.prompt_tokens += prompt_tokens
            self.completion_tokens += completion_tokens
            self.total_tokens += total_tokens
            self.api_calls += 1

        call_usage = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
        }

        content = response.choices[0].message.content.strip()
        return content, call_usage

    def generate(self, prompt: str, temperature: Optional[float] = None, max_tokens: Optional[int] = None) -> str:
        content, _ = self.generate_with_usage(prompt, temperature, max_tokens)
        return content

    def get_usage(self) -> dict:
        """Return current token usage stats (thread-safe)."""
        with self._lock:
            return {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
                "total_tokens": self.total_tokens,
                "api_calls": self.api_calls,
            }

    def reset_usage(self):
        """Reset token usage counters (thread-safe)."""
        with self._lock:
            self.prompt_tokens = 0
            self.completion_tokens = 0
            self.total_tokens = 0
            self.api_calls = 0

    def _mock_generate_with_usage(self, prompt: str) -> tuple[str, dict]:
        mock_response = ""

        if "Group answers" in prompt or "Group answers:" in prompt:
            group_count = max(1, prompt.count("Group ") // 2)
            groups = []
            for idx in range(group_count):
                eg = 8 if idx == 0 else 7
                lc = 8 if idx == 0 else 9
                hd = 9 if idx == 0 else 8
                dt = 7 if idx == 0 else 8
                total = eg + lc + hd + dt
                groups.append({
                    "Group_Index": idx + 1,
                    "Evidence_Grounding": eg,
                    "Logical_Coherence": lc,
                    "Hallucination_Detection": hd,
                    "Depth_of_Thought": dt,
                    "Detailed_Reasoning": f"Group {idx + 1} demonstrated strong reasoning with nuanced debate arguments.",
                    "Total_Score": total,
                })
            mock_response = json.dumps(groups)
        elif "Final answer:" in prompt or "Provide a final answer" in prompt or "Final answer" in prompt:
            mock_response = "Mock answer: This is a placeholder response generated by the mock LLM."
        else:
            mock_response = "Mock answer: " + prompt.strip().replace("\n", " ")[:250]

        prompt_tokens = len(prompt.split()) * 2
        completion_tokens = len(mock_response.split()) * 2
        total_tokens = prompt_tokens + completion_tokens

        with self._lock:
            self.api_calls += 1
            self.prompt_tokens += prompt_tokens
            self.completion_tokens += completion_tokens
            self.total_tokens += total_tokens

        call_usage = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
        }
        return mock_response, call_usage

    def _mock_generate(self, prompt: str) -> str:
        content, _ = self._mock_generate_with_usage(prompt)
        return content
