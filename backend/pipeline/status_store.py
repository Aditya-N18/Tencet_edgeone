"""Shared pipeline status — imported by API and detection threads (no circular imports)."""

from typing import Any, Dict, Optional

_pipeline_status: Dict[str, Any] = {
    "running": False,
    "model_ready": False,
    "frames_processed": 0,
    "last_event": "idle",
}


def get_pipeline_status() -> Dict[str, Any]:
    return dict(_pipeline_status)


def update_pipeline_status(
    running: bool,
    frames: int,
    last_event: str,
    *,
    model_ready: Optional[bool] = None,
) -> None:
    _pipeline_status["running"] = running
    _pipeline_status["frames_processed"] = frames
    _pipeline_status["last_event"] = last_event
    if model_ready is not None:
        _pipeline_status["model_ready"] = model_ready


def set_model_ready(ready: bool = True) -> None:
    _pipeline_status["model_ready"] = ready
    if ready:
        _pipeline_status["last_event"] = "model_ready"
