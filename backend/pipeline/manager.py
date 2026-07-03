"""Start/stop the detection pipeline on demand (camera only active while running)."""

import threading
from typing import Optional

from capture.video_source import CameraSource
from config.settings import settings
from pipeline.frame_buffer import clear_latest_frame
from pipeline.runner import DetectionPipeline

try:
    from api.server import set_model_ready, update_pipeline_status
except ImportError:

    def set_model_ready(ready: bool = True) -> None:
        pass

    def update_pipeline_status(running, frames, last_event, *, model_ready=None):
        pass


_lock = threading.Lock()
_pipeline: Optional[DetectionPipeline] = None
_thread: Optional[threading.Thread] = None


def is_running() -> bool:
    with _lock:
        return _thread is not None and _thread.is_alive()


def start_pipeline() -> dict:
    global _pipeline, _thread

    with _lock:
        if _thread is not None and _thread.is_alive():
            return {"started": False, "reason": "already_running"}

        update_pipeline_status(True, 0, "starting", model_ready=False)
        _pipeline = DetectionPipeline(
            source=CameraSource(
                index=settings.camera_index,
                width=settings.camera_width,
                height=settings.camera_height,
                fps=settings.camera_fps,
            )
        )
        _thread = threading.Thread(target=_run_pipeline, daemon=True)
        _thread.start()
        return {"started": True}


def stop_pipeline() -> dict:
    global _pipeline, _thread

    with _lock:
        if _pipeline is not None:
            _pipeline.stop()

        if _thread is not None:
            _thread.join(timeout=8.0)

        _pipeline = None
        _thread = None
        clear_latest_frame()
        set_model_ready(False)
        update_pipeline_status(False, 0, "stopped", model_ready=False)
        return {"stopped": True}


def _run_pipeline() -> None:
    global _pipeline
    try:
        if _pipeline is not None:
            _pipeline.run()
    finally:
        clear_latest_frame()
        set_model_ready(False)
        if _pipeline is not None:
            update_pipeline_status(
                False,
                _pipeline.frames_processed,
                "stopped",
                model_ready=False,
            )
