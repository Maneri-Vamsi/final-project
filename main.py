from __future__ import annotations

import json
import time
from pathlib import Path
from queue import Empty, Queue
from threading import Thread
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from config.config import GDMADSettings
from workflow.pipeline import DebatePipeline

app = FastAPI(title="G-DMAD Debate API")
settings = GDMADSettings()
pipeline = DebatePipeline(settings)
base_dir = Path(__file__).resolve().parent

app.mount("/static", StaticFiles(directory=base_dir / "static"), name="static")


class QuestionRequest(BaseModel):
    question: str


class DebateResponse(BaseModel):
    leader_answer: str
    leader_synthesis: str = ""
    total_rounds: int = 0
    elapsed_seconds: float = 0.0
    groups: list[dict[str, Any]] = Field(default_factory=list)
    rounds: list[dict[str, Any]] = Field(default_factory=list)


@app.get("/", response_class=FileResponse)
def root() -> FileResponse:
    return FileResponse(base_dir / "templates" / "index.html")


@app.post("/debate", response_model=None)
def debate(request: QuestionRequest, http_request: Request):
    accepts_stream = "application/x-ndjson" in http_request.headers.get("accept", "")
    started_at = time.perf_counter()

    if not accepts_stream:
        result = pipeline.run_with_trace(request.question)
        result["elapsed_seconds"] = round(time.perf_counter() - started_at, 3)
        return DebateResponse(**result)

    event_queue: Queue[dict[str, Any] | None] = Queue()

    def emit(event: dict[str, Any]) -> None:
        event_queue.put(event)

    def run_pipeline() -> None:
        try:
            result = pipeline.run_with_trace(request.question, emit)
            event_queue.put(
                {
                    "type": "complete",
                    "result": result,
                    "elapsed_seconds": round(time.perf_counter() - started_at, 3),
                }
            )
        except Exception as exc:  # pragma: no cover - surfaced to the client stream
            event_queue.put(
                {
                    "type": "error",
                    "message": str(exc),
                    "elapsed_seconds": round(time.perf_counter() - started_at, 3),
                }
            )
        finally:
            event_queue.put(None)

    worker = Thread(target=run_pipeline, daemon=True)
    worker.start()

    def event_stream():
        while True:
            try:
                event = event_queue.get(timeout=0.25)
            except Empty:
                continue

            if event is None:
                break

            yield json.dumps(event) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
