"""
Frame preprocessing before YOLO inference.

Decision: keep preprocessing minimal for latency.

Steps:
  1. Validate frame is non-empty
  2. Optionally resize if camera sends huge frames (saves CPU on edge devices)

We do NOT normalize color space here — Ultralytics expects BGR numpy arrays
from OpenCV, matching our camera pipeline.
"""

from typing import Optional, Tuple

import cv2
import numpy as np


def preprocess_frame(
    frame: np.ndarray,
    target_size: Optional[Tuple[int, int]] = None,
) -> Optional[np.ndarray]:
    if frame is None or frame.size == 0:
        return None

    if target_size is not None:
        frame = cv2.resize(frame, target_size, interpolation=cv2.INTER_LINEAR)

    return frame
