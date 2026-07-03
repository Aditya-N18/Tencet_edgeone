"""
Run YOLO inference on a single frame.

Decision: one function per frame keeps the pipeline testable — pass a numpy
array in, get structured detections out.
"""

from typing import Optional

import numpy as np

from config.settings import settings
from detection.fall_detector import DetectionEvent, FallDetector
from detection.model_loader import ModelLoader
from detection.postprocessor import FrameDetections, parse_yolo_pose_results
from detection.preprocessor import preprocess_frame


class InferenceEngine:
    def __init__(self):
        self.loader = ModelLoader.get()
        self.fall_detector = FallDetector()
        self._warmed_up = False

    def warm_up(self) -> None:
        """Load YOLO weights before the camera loop starts."""
        if self._warmed_up:
            return
        self.loader.load()
        self._warmed_up = True
        print("[Inference] YOLO model loaded and ready")

    def process_frame(self, frame: np.ndarray) -> tuple[Optional[FrameDetections], DetectionEvent]:
        cleaned = preprocess_frame(frame)
        if cleaned is None:
            from detection.fall_detector import EventType

            return None, DetectionEvent(
                event_type=EventType.NO_PERSON,
                confidence=0.0,
                reason="Empty frame",
            )

        model = self.loader.model
        results = model.predict(
            cleaned,
            conf=settings.yolo_confidence,
            device=settings.yolo_device,
            verbose=False,
        )

        detections = parse_yolo_pose_results(results[0], cleaned.shape)
        event = self.fall_detector.analyze(detections)
        return detections, event
