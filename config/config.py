from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings


class GDMADSettings(BaseSettings):
    openai_api_key: str = Field("", env="OPENAI_API_KEY")
    openrouter_api_key: str = Field("", env="OPENROUTER_API_KEY")
    groq_api_key: str = Field("", env="GROQ_API_KEY")
    use_mock_llm: bool = Field(True, env="USE_MOCK_LLM")
    model_name: str = Field("inclusionai/ling-3.0-flash:free", env="MODEL_NAME")
    temperature: float = Field(0.3, env="TEMPERATURE")
    rounds: int = Field(3, env="ROUNDS")
    groups: int = Field(2, env="GROUPS")
    agents_per_group: int = Field(3, env="AGENTS_PER_GROUP")
    max_tokens: int = Field(2048, env="MAX_TOKENS")
    api_base: str | None = Field(None, env="API_BASE")
    api_type: str | None = Field(None, env="API_TYPE")
    api_version: str | None = Field(None, env="API_VERSION")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def api_key(self) -> str:
        return (
            self.openai_api_key.strip()
            or self.openrouter_api_key.strip()
            or self.groq_api_key.strip()
        )

    @property
    def has_api_key(self) -> bool:
        return bool(self.api_key)
