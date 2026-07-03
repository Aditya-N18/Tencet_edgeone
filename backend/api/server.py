"""
Lightweight HTTP API for health checks and manual testing.

Decision: separate small API from the detection loop so you can:
  - Hit GET /health from a process supervisor (systemd, Docker healthcheck)
  - Trigger test alerts without simulating a fall on camera
"""

from datetime import datetime, timezone

import asyncio
import cv2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from config.settings import settings
from pipeline.alert_manager import AlertManager
from pipeline.frame_buffer import get_latest_frame

app = FastAPI(title="Senior Guardian Vision Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_pipeline_status = {
    "running": False,
    "model_ready": False,
    "frames_processed": 0,
    "last_event": "idle",
}


def update_pipeline_status(
    running: bool,
    frames: int,
    last_event: str,
    *,
    model_ready: bool | None = None,
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


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "senior-guardian-vision",
        "version": "0.2.0",
        "model": settings.yolo_model,
        "pipeline": _pipeline_status,
    }


@app.get("/stream/mjpeg")
async def stream_mjpeg():
    """MJPEG stream — only sends frames while the pipeline is running."""

    async def generate():
        while True:
            if not _pipeline_status["running"]:
                await asyncio.sleep(0.25)
                continue

            frame = get_latest_frame()
            if frame is not None:
                ok, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if ok:
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n"
                        + jpeg.tobytes()
                        + b"\r\n"
                    )
            await asyncio.sleep(1 / max(settings.camera_fps, 1))

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/frame/latest")
def latest_frame():
    """Single JPEG snapshot — works reliably through the Vite dev proxy."""
    if not _pipeline_status["running"]:
        return Response(status_code=204)

    frame = get_latest_frame()
    if frame is None:
        return Response(status_code=204)

    ok, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    if not ok:
        return Response(status_code=204)

    return Response(content=jpeg.tobytes(), media_type="image/jpeg")


@app.get("/pipeline/status")
def pipeline_status():
    from pipeline.manager import is_running

    return {
        "running": is_running(),
        "pipeline": _pipeline_status,
    }


@app.post("/pipeline/start")
def pipeline_start():
    from pipeline.manager import start_pipeline

    result = start_pipeline()
    result["pipeline"] = _pipeline_status
    return result


@app.post("/pipeline/stop")
def pipeline_stop():
    from pipeline.manager import stop_pipeline

    result = stop_pipeline()
    result["pipeline"] = _pipeline_status
    return result


class TestAlertBody(BaseModel):
    reason: str = "Manual test alert"


@app.post("/test-alert")
def test_alert(body: TestAlertBody):
    """Fire a test webhook without YOLO — useful for Butterbase integration testing."""
    manager = AlertManager()
    payload = {
        "event_type": "fall_suspected",
        "confidence": 1.0,
        "reason": body.reason,
        "senior_id": settings.senior_id,
        "device_id": settings.device_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "snapshot_path": None,
        "test": True,
    }
    ok = manager.send_alert_sync(payload)
    return {"sent": ok, "payload": payload}
