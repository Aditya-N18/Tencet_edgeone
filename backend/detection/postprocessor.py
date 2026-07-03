"""
Post-processing of raw YOLO pose results.

Decision: convert tensor output into simple Python structures the fall
detector can reason about without importing Ultralytics types everywhere.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np


@dataclass
class PersonPose:
    """One detected person with bounding box and COCO-17 keypoints."""

    confidence: float
    bbox: Tuple[float, float, float, float]  # x1, y1, x2, y2
    keypoints: np.ndarray  # shape (17, 3) => x, y, conf per joint

    @property
    def width(self) -> float:
        return self.bbox[2] - self.bbox[0]

    @property
    def height(self) -> float:
        return self.bbox[3] - self.bbox[1]

    @property
    def center_y(self) -> float:
        return (self.bbox[1] + self.bbox[3]) / 2

    @property
    def aspect_ratio(self) -> float:
        """Width / height. Lying down tends to increase this ratio."""
        h = max(self.height, 1.0)
        return self.width / h


@dataclass
class FrameDetections:
    frame_width: int
    frame_height: int
    persons: List[PersonPose] = field(default_factory=list)


def parse_yolo_pose_results(result, frame_shape) -> FrameDetections:
    """Extract PersonPose list from a single Ultralytics Results object."""
    h, w = frame_shape[:2]
    detections = FrameDetections(frame_width=w, frame_height=h)

    if result.keypoints is None or result.boxes is None:
        return detections

    boxes = result.boxes
    keypoints = result.keypoints

    for i in range(len(boxes)):
        conf = float(boxes.conf[i].item()) if boxes.conf is not None else 0.0
        xyxy = boxes.xyxy[i].cpu().numpy().tolist()
        kpts = keypoints.data[i].cpu().numpy()  # (17, 3)

        detections.persons.append(
            PersonPose(confidence=conf, bbox=tuple(xyxy), keypoints=kpts)
        )

    return detections
