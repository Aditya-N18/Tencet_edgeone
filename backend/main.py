#!/usr/bin/env python3
"""
Senior Guardian — YOLO vision service entry point.

Usage:
  python main.py                  # API server only (camera starts from Monitor UI)
  python main.py --run              # Auto-start camera pipeline (legacy)
  python main.py --frames 50      # Process 50 frames then exit (dev test)
  python main.py --video path.mp4 # Replay file instead of camera
"""

import argparse
import threading

import uvicorn

from api.server import app
from pipeline.status_store import update_pipeline_status
from capture.video_source import CameraSource, FileSource
from config.settings import settings
from pipeline.runner import DetectionPipeline


def parse_args():
    parser = argparse.ArgumentParser(description="Senior Guardian YOLO detection service")
    parser.add_argument("--run", action="store_true", help="Auto-start camera pipeline on launch")
    parser.add_argument("--frames", type=int, default=None, help="Max frames to process")
    parser.add_argument("--video", type=str, default=None, help="Video file path instead of camera")
    return parser.parse_args()


def run_pipeline(max_frames, video_path):
    source = FileSource(video_path) if video_path else CameraSource(
        index=settings.camera_index,
        width=settings.camera_width,
        height=settings.camera_height,
        fps=settings.camera_fps,
    )
    pipeline = DetectionPipeline(source=source)

    try:
        pipeline.run(max_frames=max_frames)
    finally:
        update_pipeline_status(
            False,
            pipeline.frames_processed,
            pipeline.last_event_summary,
            model_ready=False,
        )


def run_api():
    uvicorn.run(app, host=settings.api_host, port=settings.api_port, log_level="info")


def main():
    args = parse_args()

    # CLI test modes: run pipeline directly in this process
    if args.frames is not None or args.video is not None:
        api_thread = threading.Thread(target=run_api, daemon=True)
        api_thread.start()
        run_pipeline(args.frames, args.video)
        return

    if args.run:
        api_thread = threading.Thread(target=run_api, daemon=True)
        api_thread.start()
        print(f"  Health API: http://localhost:{settings.api_port}/health")
        run_pipeline(None, None)
        return

    # Default: API only — camera starts when frontend POST /pipeline/start
    print("Senior Guardian API starting…")
    print(f"  Health:  http://localhost:{settings.api_port}/health")
    print(f"  Monitor: open frontend → click Start monitoring")
    print(f"  Model:   {settings.yolo_model} (loads when monitoring starts)")
    run_api()


if __name__ == "__main__":
    main()
