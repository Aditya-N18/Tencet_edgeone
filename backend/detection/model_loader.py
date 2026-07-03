"""
YOLO model loader.

Decision: use Ultralytics YOLOv8 *pose* model for MVP fall heuristics.

Why pose instead of a generic object detector?
  - COCO person detection tells you *where* someone is, not *how* they're oriented.
  - Pose keypoints (shoulders, hips, ankles) let us estimate if a person is
    horizontal / on the ground — a common proxy for fall detection.

Why yolov8n-pose (nano)?
  - Runs on CPU for dev laptops and edge devices like Raspberry Pi / Jetson.
  - Swap to yolov8s-pose or a custom fine-tuned fall .pt when accuracy matters.

Later upgrade path:
  - Train custom YOLO on fall / lying / distress classes (Roboflow, custom dataset).
  - Point YOLO_MODEL at your weights file in models/.
"""

from pathlib import Path
from typing import Optional

from ultralytics import YOLO

from config.settings import settings


class ModelLoader:
    _instance: Optional["ModelLoader"] = None

    def __init__(self, model_path: Optional[str] = None, device: Optional[str] = None):
        self.model_path = model_path or settings.yolo_model
        self.device = device or settings.yolo_device
        self._model: Optional[YOLO] = None

    @classmethod
    def get(cls) -> "ModelLoader":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self) -> YOLO:
        if self._model is None:
            path = self._resolve_model_path(self.model_path)
            self._model = YOLO(str(path))
        return self._model

    def _resolve_model_path(self, model_path: str) -> Path:
        local = Path("models") / model_path
        if local.exists():
            return local
        # Ultralytics auto-downloads official weights on first use
        return Path(model_path)

    @property
    def model(self) -> YOLO:
        return self.load()
