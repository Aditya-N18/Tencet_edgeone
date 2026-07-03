"""
Alert debouncing and Butterbase webhook dispatch.

Decision: never fire an alert on a single frame.

Why?
  - YOLO false positives (shadows, bending to pick something up, sitting on couch)
    are common with heuristic fall detection.
  - Require N consecutive fall_suspected frames (ALERT_CONSECUTIVE_FRAMES).
  - After firing, enforce cooldown (ALERT_COOLDOWN_SECONDS) so one event doesn't
    spam the frontend / family.

Butterbase integration:
  - POST JSON to a Butterbase serverless function URL.
  - That function creates an incident row → realtime pushes to the web tablet.
  - Voice session starts on the frontend, not via phone call.
"""

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import cv2
import httpx
import numpy as np

from config.settings import settings
from detection.fall_detector import DetectionEvent, EventType


@dataclass
class AlertState:
    consecutive_fall_frames: int = 0
    last_alert_at: float = 0.0
    total_alerts_sent: int = 0


@dataclass
class AlertManager:
    state: AlertState = field(default_factory=AlertState)

    def evaluate(self, event: DetectionEvent, frame: Optional[np.ndarray] = None) -> Optional[Dict[str, Any]]:
        """
        Returns alert payload if an alert should fire, else None.
        """
        if event.event_type == EventType.FALL_SUSPECTED:
            self.state.consecutive_fall_frames += 1
        else:
            self.state.consecutive_fall_frames = 0
            return None

        if self.state.consecutive_fall_frames < settings.alert_consecutive_frames:
            return None

        now = time.time()
        if now - self.state.last_alert_at < settings.alert_cooldown_seconds:
            return None

        self.state.last_alert_at = now
        self.state.total_alerts_sent += 1
        self.state.consecutive_fall_frames = 0

        snapshot_path = None
        if settings.save_snapshots and frame is not None:
            snapshot_path = self._save_snapshot(frame)

        return {
            "event_type": event.event_type.value,
            "confidence": round(event.confidence, 3),
            "reason": event.reason,
            "senior_id": settings.senior_id,
            "device_id": settings.device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "snapshot_path": snapshot_path,
        }

    def _save_snapshot(self, frame: np.ndarray) -> str:
        out_dir = Path(settings.snapshot_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        filename = f"alert_{int(time.time())}.jpg"
        path = out_dir / filename
        cv2.imwrite(str(path), frame)
        return str(path)

    async def send_alert(self, payload: Dict[str, Any]) -> bool:
        """POST alert to Butterbase webhook. Returns True on success."""
        url = settings.butterbase_webhook_url
        if not url:
            print("[AlertManager] BUTTERBASE_WEBHOOK_URL not set — alert logged locally:")
            print(json.dumps(payload, indent=2))
            return False

        headers = {"Content-Type": "application/json"}
        if settings.butterbase_api_key:
            headers["Authorization"] = f"Bearer {settings.butterbase_api_key}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return True

    def send_alert_sync(self, payload: Dict[str, Any]) -> bool:
        url = settings.butterbase_webhook_url
        if not url:
            print("[AlertManager] BUTTERBASE_WEBHOOK_URL not set — alert logged locally:")
            print(json.dumps(payload, indent=2))
            return False

        headers = {"Content-Type": "application/json"}
        if settings.butterbase_api_key:
            headers["Authorization"] = f"Bearer {settings.butterbase_api_key}"

        with httpx.Client(timeout=10.0) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return True
