"""
Lightweight HTTP API for health checks and manual testing.

Decision: separate small API from the detection loop so you can:
  - Hit GET /health from a process supervisor (systemd, Docker healthcheck)
  - Trigger test alerts without simulating a fall on camera
"""

from datetime import datetime, timezone

import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from config.settings import settings
from pipeline.alert_manager import AlertManager
from pipeline.frame_buffer import get_latest_jpeg
from pipeline.status_store import get_pipeline_status, set_model_ready, update_pipeline_status

app = FastAPI(title="Senior Guardian Vision Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://senior-guardian.edgeone.dev",
        "https://senior-guardian.butterbase.dev",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.edgeone\.dev|https://.*\.butterbase\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Re-export for any legacy imports
__all__ = ["app", "update_pipeline_status", "set_model_ready"]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "senior-guardian-vision",
        "version": "0.2.0",
        "model": settings.yolo_model,
        "pipeline": get_pipeline_status(),
    }


@app.get("/stream/mjpeg")
async def stream_mjpeg():
    """MJPEG stream — only sends frames while the pipeline is running."""

    async def generate():
        while True:
            status = get_pipeline_status()
            if not status["running"]:
                await asyncio.sleep(0.25)
                continue

            jpeg = get_latest_jpeg()
            if jpeg is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + jpeg
                    + b"\r\n"
                )
            await asyncio.sleep(1 / max(settings.camera_fps, 1))

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/frame/latest")
def latest_frame():
    """Single JPEG snapshot — pre-encoded by the pipeline thread."""
    status = get_pipeline_status()
    if not status["running"]:
        return Response(status_code=204)

    jpeg = get_latest_jpeg()
    if jpeg is None:
        return Response(status_code=204)

    return Response(content=jpeg, media_type="image/jpeg")


@app.get("/pipeline/status")
def pipeline_status():
    from pipeline.manager import is_running

    return {
        "running": is_running(),
        "pipeline": get_pipeline_status(),
    }


@app.post("/pipeline/start")
def pipeline_start():
    from pipeline.manager import start_pipeline

    result = start_pipeline()
    result["pipeline"] = get_pipeline_status()
    return result


@app.post("/pipeline/stop")
def pipeline_stop():
    from pipeline.manager import stop_pipeline

    result = stop_pipeline()
    result["pipeline"] = get_pipeline_status()
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
