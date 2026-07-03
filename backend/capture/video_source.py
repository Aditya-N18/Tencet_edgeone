"""
Video source abstraction.

Decision: separate capture from inference so you can swap:
  - USB webcam (development)
  - RTSP IP camera (production)
  - pre-recorded video file (testing / tuning thresholds)
without touching detection logic.
"""

from abc import ABC, abstractmethod
from typing import Generator, Optional, Tuple

import cv2
import numpy as np


class VideoSource(ABC):
    @abstractmethod
    def open(self) -> None:
        ...

    @abstractmethod
    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        ...

    @abstractmethod
    def release(self) -> None:
        ...

    @abstractmethod
    def is_opened(self) -> bool:
        ...


class CameraSource(VideoSource):
    """Read frames from a local camera index (default: built-in or USB webcam)."""

    def __init__(
        self,
        index: int = 0,
        width: int = 640,
        height: int = 480,
        fps: int = 15,
    ):
        self.index = index
        self.width = width
        self.height = height
        self.fps = fps
        self._cap: Optional[cv2.VideoCapture] = None

    def open(self) -> None:
        self._cap = cv2.VideoCapture(self.index)
        if not self._cap.isOpened():
            raise RuntimeError(f"Could not open camera index {self.index}")

        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self._cap.set(cv2.CAP_PROP_FPS, self.fps)

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        if self._cap is None:
            return False, None
        return self._cap.read()

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def is_opened(self) -> bool:
        return self._cap is not None and self._cap.isOpened()


class FileSource(VideoSource):
    """Replay a video file — useful for tuning fall thresholds without a live camera."""

    def __init__(self, path: str):
        self.path = path
        self._cap: Optional[cv2.VideoCapture] = None

    def open(self) -> None:
        self._cap = cv2.VideoCapture(self.path)
        if not self._cap.isOpened():
            raise RuntimeError(f"Could not open video file: {self.path}")

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        if self._cap is None:
            return False, None
        return self._cap.read()

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def is_opened(self) -> bool:
        return self._cap is not None and self._cap.isOpened()


def frame_generator(source: VideoSource) -> Generator[np.ndarray, None, None]:
    """Yield BGR frames until the source is exhausted or fails."""
    source.open()
    try:
        while source.is_opened():
            ok, frame = source.read()
            if not ok or frame is None:
                break
            yield frame
    finally:
        source.release()
