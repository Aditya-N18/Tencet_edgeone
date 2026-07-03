"""
Main detection loop: camera → YOLO → fall analysis → alert.

Decision: synchronous loop for clarity on edge devices.
Async webhook sends can be added later; sync is fine for MVP volume.
"""

import time
from typing import Optional

from capture.video_source import CameraSource, VideoSource
from config.settings import settings
from detection.inference import InferenceEngine
from pipeline.alert_manager import AlertManager
from pipeline.frame_buffer import set_latest_frame

try:
    from api.server import set_model_ready, update_pipeline_status
except ImportError:
    def set_model_ready(ready: bool = True) -> None:
        pass

    def update_pipeline_status(running, frames, last_event, *, model_ready=None):
        pass


class DetectionPipeline:
    def __init__(
        self,
        source: Optional[VideoSource] = None,
        engine: Optional[InferenceEngine] = None,
        alert_manager: Optional[AlertManager] = None,
    ):
        self.source = source or CameraSource(
            index=settings.camera_index,
            width=settings.camera_width,
            height=settings.camera_height,
            fps=settings.camera_fps,
        )
        self.engine = engine or InferenceEngine()
        self.alerts = alert_manager or AlertManager()
        self._running = False
        self.frames_processed = 0
        self.last_event_summary = "idle"

    def run(self, max_frames: Optional[int] = None) -> None:
        """
        Process frames until interrupted or max_frames reached.

        max_frames=None → run forever (production mode).
        max_frames=100  → useful for tests.
        """
        self._running = True
        update_pipeline_status(True, 0, "loading_model", model_ready=False)

        print("[Pipeline] Loading YOLO model…")
        self.engine.warm_up()
        set_model_ready(True)
        update_pipeline_status(True, 0, "model_ready", model_ready=True)
        print("[Pipeline] Model ready — starting camera")

        self.source.open()

        try:
            while self._running:
                ok, frame = self.source.read()
                if not ok or frame is None:
                    print("[Pipeline] Camera read failed — retrying in 1s")
                    time.sleep(1)
                    continue

                set_latest_frame(frame)

                _, event = self.engine.process_frame(frame)
                self.frames_processed += 1
                self.last_event_summary = f"{event.event_type.value}: {event.reason}"
                update_pipeline_status(
                    True,
                    self.frames_processed,
                    self.last_event_summary,
                    model_ready=True,
                )

                payload = self.alerts.evaluate(event, frame)
                if payload:
                    print(f"[Pipeline] ALERT triggered: {payload}")
                    self.alerts.send_alert_sync(payload)

                if max_frames is not None and self.frames_processed >= max_frames:
                    break

                # Small sleep to cap CPU if camera delivers faster than needed
                time.sleep(1 / max(settings.camera_fps, 1))
        finally:
            self.source.release()
            self._running = False
            set_model_ready(False)
            update_pipeline_status(
                False,
                self.frames_processed,
                self.last_event_summary,
                model_ready=False,
            )

    def stop(self) -> None:
        self._running = False
