"""Thread-safe store for the latest camera frame (shared with the HTTP stream)."""

import threading
from typing import Optional

import numpy as np

_lock = threading.Lock()
_latest_frame: Optional[np.ndarray] = None


def set_latest_frame(frame: np.ndarray) -> None:
    global _latest_frame
    with _lock:
        _latest_frame = frame.copy()


def get_latest_frame() -> Optional[np.ndarray]:
    with _lock:
        if _latest_frame is None:
            return None
        return _latest_frame.copy()


def clear_latest_frame() -> None:
    global _latest_frame
    with _lock:
        _latest_frame = None
