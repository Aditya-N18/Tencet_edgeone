"""Backend configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Camera
    camera_index: int = 0
    camera_width: int = 640
    camera_height: int = 480
    camera_fps: int = 15

    # YOLO
    yolo_model: str = "yolov8n-pose.pt"
    yolo_confidence: float = 0.5
    yolo_device: str = "cpu"

    # Alert debouncing
    alert_consecutive_frames: int = 3
    alert_cooldown_seconds: int = 120

    # Fall heuristics (pose-based)
    fall_horizontal_ratio: float = 1.4
    fall_low_in_frame: float = 0.55

    # Butterbase integration
    butterbase_webhook_url: str = ""
    butterbase_api_key: str = ""
    senior_id: str = "senior_001"
    device_id: str = "device_living_room"

    # Snapshots
    snapshot_dir: str = "./data/snapshots"
    save_snapshots: bool = True

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8080


settings = Settings()
