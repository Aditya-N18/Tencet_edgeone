"""Thread-safe store for the latest camera frame / JPEG (shared with the HTTP stream)."""

import threading
from typing import Optional, Tuple

import cv2
import numpy as np

_lock = threading.Lock()
_latest_frame: Optional[np.ndarray] = None
_latest_jpeg: Optional[bytes] = None


def set_latest_frame(frame: np.ndarray) -> None:
    global _latest_frame, _latest_jpeg
    ok, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    jpeg_bytes = jpeg.tobytes() if ok else None
    with _lock:
        _latest_frame = frame
        _latest_jpeg = jpeg_bytes


def get_latest_frame() -> Optional[np.ndarray]:
    with _lock:
        if _latest_frame is None:
            return None
        return _latest_frame


def get_latest_jpeg() -> Optional[bytes]:
    with _lock:
        return _latest_jpeg


def clear_latest_frame() -> None:
    global _latest_frame, _latest_jpeg
    with _lock:
        _latest_frame = None
        _latest_jpeg = None

