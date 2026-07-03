"""
Fall detection logic on top of YOLO pose output.

Decision: heuristic fall detection for MVP (no custom model yet).

Three signals combined (any can trigger a *candidate* fall):
  1. Horizontal bbox — width/height ratio above threshold (person appears wide)
  2. Low in frame — bbox center below fall_low_in_frame (person near floor)
  3. Pose collapse — shoulder/hip Y coords close to ankle Y (torso near ground)

Why heuristics first?
  - Lets you ship and tune on real home footage before labeling a dataset.
  - Custom YOLO fall classifiers still produce false positives; heuristics +
    temporal smoothing (see AlertManager) reduce noise.

Replace later with:
  - Dedicated fall-detection weights (e.g. yolov8 fall dataset)
  - Set detection_mode = "classifier" and check class id "fall"
"""

from dataclasses import dataclass
from enum import Enum
from typing import List, Optional

from config.settings import settings
from detection.postprocessor import FrameDetections, PersonPose


class EventType(str, Enum):
    FALL_SUSPECTED = "fall_suspected"
    PERSON_DETECTED = "person_detected"
    NO_PERSON = "no_person"


@dataclass
class DetectionEvent:
    event_type: EventType
    confidence: float
    reason: str
    person: Optional[PersonPose] = None


class FallDetector:
    def __init__(
        self,
        confidence_threshold: Optional[float] = None,
        horizontal_ratio: Optional[float] = None,
        low_in_frame: Optional[float] = None,
    ):
        self.confidence_threshold = confidence_threshold or settings.yolo_confidence
        self.horizontal_ratio = horizontal_ratio or settings.fall_horizontal_ratio
        self.low_in_frame = low_in_frame or settings.fall_low_in_frame

    def analyze(self, detections: FrameDetections) -> DetectionEvent:
        if not detections.persons:
            return DetectionEvent(
                event_type=EventType.NO_PERSON,
                confidence=0.0,
                reason="No person in frame",
            )

        # Focus on the highest-confidence person (single senior per room assumption)
        person = max(detections.persons, key=lambda p: p.confidence)

        if person.confidence < self.confidence_threshold:
            return DetectionEvent(
                event_type=EventType.NO_PERSON,
                confidence=person.confidence,
                reason="Person confidence below threshold",
                person=person,
            )

        fall_score, reason = self._score_fall(person, detections.frame_height)

        if fall_score >= 0.65:
            return DetectionEvent(
                event_type=EventType.FALL_SUSPECTED,
                confidence=fall_score,
                reason=reason,
                person=person,
            )

        return DetectionEvent(
            event_type=EventType.PERSON_DETECTED,
            confidence=person.confidence,
            reason="Person upright or normal activity",
            person=person,
        )

    def _score_fall(self, person: PersonPose, frame_height: int) -> tuple[float, str]:
        signals: List[str] = []
        score = 0.0

        # Signal 1: horizontal bounding box
        if person.aspect_ratio >= self.horizontal_ratio:
            score += 0.35
            signals.append(f"horizontal bbox (ratio={person.aspect_ratio:.2f})")

        # Signal 2: person low in frame (normalized 0–1)
        normalized_y = person.center_y / max(frame_height, 1)
        if normalized_y >= self.low_in_frame:
            score += 0.35
            signals.append(f"low in frame (y={normalized_y:.2f})")

        # Signal 3: pose — torso near ankles (simple fall proxy)
        if self._torso_near_ground(person):
            score += 0.35
            signals.append("torso near ground (pose)")

        score = min(score, 1.0)
        reason = "; ".join(signals) if signals else "no fall signals"
        return score, reason

    def _torso_near_ground(self, person: PersonPose, pixel_threshold: float = 80.0) -> bool:
        """
        COCO keypoint indices (subset):
          5,6 = shoulders  11,12 = hips  15,16 = ankles
        If shoulder/hip Y is within threshold of ankle Y, person may be lying.
        """
        kpts = person.keypoints
        if kpts.shape[0] < 17:
            return False

        def valid_y(idx: int) -> Optional[float]:
            if kpts[idx, 2] < 0.3:
                return None
            return float(kpts[idx, 1])

        ankles = [valid_y(15), valid_y(16)]
        ankles = [a for a in ankles if a is not None]
        if not ankles:
            return False

        ankle_y = max(ankles)  # lowest ankle in image coords
        torso_indices = [5, 6, 11, 12]
        torso_ys = [valid_y(i) for i in torso_indices]
        torso_ys = [y for y in torso_ys if y is not None]

        if not torso_ys:
            return False

        avg_torso_y = sum(torso_ys) / len(torso_ys)
        return abs(ankle_y - avg_torso_y) < pixel_threshold
