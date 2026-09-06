# G-DMAD: Group-Based Diverse Multi-Agent Debate

This repository implements the G-DMAD framework from the paper "G-DMAD: Group-Based Diverse Multi-Agent Debate for Robust Reasoning".

## Features

- Multi-Agent Debate
- Group-Based Debate
- IO Agent
- CCoT Agent
- DDCoT Agent
- Multi-round reasoning
- Meta Evaluator
- Cross-group leader selection
- Leader propagation
- Final answer aggregation

## Project Structure

- `config/` - environment and system configuration
- `agents/` - IO, CCoT, DDCoT agents
- `group/` - group manager implementation
- `debate/` - debate engine orchestration
- `leader/` - leader selection and propagation
- `memory/` - group context storage
- `models/` - LLM API wrapper
- `workflow/` - pipeline orchestration
- `prompts/` - prompt templates for each agent and evaluator
- `utils/` - helper utilities
- `main.py` - FastAPI entry point

## Configuration

Create a `.env` file at the project root with the following values:

```env
GROQ_API_KEY=
USE_MOCK_LLM=false
MODEL_NAME=llama-3.1-8b-instant
API_BASE=https://api.groq.com/openai/v1
TEMPERATURE=0.3
ROUNDS=3
GROUPS=2
AGENTS_PER_GROUP=3
MAX_TOKENS=2048
```

The app now accepts `EXPERIENTIALLABS_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, or `OPENROUTER_API_KEY`. If no key is set, it can still run in mock mode when `USE_MOCK_LLM` is `true`.

## Install Dependencies

```bash
pip install -r requirements.txt
```

## Run the API

```bash
uvicorn main:app --reload
```

## Example Request

Send a POST to `/debate` with JSON:

```json
{
  "question": "Explain why the sky is blue."
}
```
