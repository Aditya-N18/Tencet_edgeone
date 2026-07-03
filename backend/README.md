# Senior Guardian — YOLO Vision Backend

Edge service that watches a camera, runs YOLO pose inference, detects possible falls, and notifies Butterbase so the web tablet can start a voice session.

## Architecture

```
Camera (OpenCV)
    ↓
Preprocessor        ← validate / resize frame
    ↓
YOLO Pose Model     ← Ultralytics (yolov8n-pose.pt)
    ↓
Postprocessor       ← bbox + 17 keypoints per person
    ↓
FallDetector        ← heuristics (horizontal, low in frame, pose)
    ↓
AlertManager        ← N consecutive frames + cooldown
    ↓
Butterbase webhook  ← creates incident → realtime → frontend mic
```

## Folder structure

| Path | Purpose |
|------|---------|
| `config/settings.py` | All tunables from `.env` |
| `capture/video_source.py` | Camera or video file input |
| `detection/model_loader.py` | Load YOLO weights (local or auto-download) |
| `detection/preprocessor.py` | Frame cleanup before inference |
| `detection/postprocessor.py` | Parse YOLO tensors → Python dataclasses |
| `detection/fall_detector.py` | Fall heuristics on pose data |
| `detection/inference.py` | Single-frame pipeline glue |
| `pipeline/alert_manager.py` | Debounce + webhook + snapshots |
| `pipeline/runner.py` | Main loop |
| `api/server.py` | Health + test alert endpoints |
| `main.py` | CLI entry point |

## Setup

**PowerShell** (use `;` not `&&` on older Windows):

```powershell
cd c:\Users\adity\betaXantler\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
```

Or activate the venv first:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
# Live camera (runs until Ctrl+C)
.\.venv\Scripts\python.exe main.py

# Dev: process 30 frames only
.\.venv\Scripts\python.exe main.py --frames 30

# Test with a video file
.\.venv\Scripts\python.exe main.py --video path\to\fall_sample.mp4

# Health API + detection together
.\.venv\Scripts\python.exe main.py --with-api

# API only (for webhook testing)
.\.venv\Scripts\python.exe main.py --api
# GET  http://localhost:8080/health
# POST http://localhost:8080/test-alert
```

---

## Design decisions (step by step)

### Step 1 — Video capture (`capture/`)

**Decision:** Abstract `VideoSource` with `CameraSource` and `FileSource`.

**Why:** Fall detection tuning requires replaying the same footage dozens of times. A file source lets you iterate on thresholds without performing falls on camera.

**Config:** `CAMERA_INDEX`, `CAMERA_WIDTH`, `CAMERA_HEIGHT`, `CAMERA_FPS`.

640×480 @ 15 FPS is a practical default — enough detail for pose, light on CPU.

---

### Step 2 — Model selection (`detection/model_loader.py`)

**Decision:** Start with `yolov8n-pose.pt` (nano pose model).

**Why pose, not plain object detection?**
- Person detection only gives a bounding box.
- Pose adds 17 body keypoints — we can tell if shoulders/hips are near the floor.

**Why nano?**
- Runs on CPU for development.
- Upgrade to `yolov8s-pose.pt` or a custom `models/fall_v1.pt` when you have labeled data.

**Custom model path:** Drop weights in `models/` and set `YOLO_MODEL=fall_v1.pt`.

---

### Step 3 — Preprocessing (`detection/preprocessor.py`)

**Decision:** Minimal preprocessing — pass OpenCV BGR frames directly to Ultralytics.

**Why:** Extra color conversion or heavy augmentation adds latency on edge devices. Resize only if your camera sends 1080p+ and CPU struggles.

---

### Step 4 — Postprocessing (`detection/postprocessor.py`)

**Decision:** Convert YOLO output to `PersonPose` dataclass (bbox + keypoints + confidence).

**Why:** Keeps fall logic free of PyTorch/Ultralytics types — easier to unit test with fake keypoints.

---

### Step 5 — Fall detection (`detection/fall_detector.py`)

**Decision:** Three heuristic signals (MVP, no custom training yet):

| Signal | Logic | Weight |
|--------|-------|--------|
| Horizontal bbox | `width/height >= 1.4` | 0.35 |
| Low in frame | bbox center Y ≥ 55% of frame height | 0.35 |
| Pose collapse | shoulders/hips within 80px of ankles | 0.35 |

Combined score ≥ 0.65 → `fall_suspected`.

**Why heuristics first?**
- Shipping fast beats perfect accuracy in week one.
- Sitting on a couch or tying shoes can trigger false positives — that's why Step 6 exists.

**Tune via `.env`:**
- `FALL_HORIZONTAL_RATIO`
- `FALL_LOW_IN_FRAME`
- `YOLO_CONFIDENCE`

---

### Step 6 — Alert debouncing (`pipeline/alert_manager.py`)

**Decision:** Require 3 consecutive fall frames + 120s cooldown.

**Why:**
- One noisy frame should not panic the senior or family.
- Cooldown prevents alert storms during a single prolonged event.

**On alert:**
1. Optionally save JPEG snapshot to `data/snapshots/`
2. POST JSON to `BUTTERBASE_WEBHOOK_URL`

**Payload shape:**
```json
{
  "event_type": "fall_suspected",
  "confidence": 0.72,
  "reason": "horizontal bbox; low in frame",
  "senior_id": "senior_001",
  "device_id": "device_living_room",
  "timestamp": "2026-06-19T12:00:00+00:00",
  "snapshot_path": "./data/snapshots/alert_1718798400.jpg"
}
```

Butterbase function should insert an `incidents` row → realtime → frontend `/voice` auto-activates mic.

---

### Step 7 — Butterbase webhook (not implemented here)

Next step on Butterbase side:
1. `manage_schema` — `incidents`, `seniors`, `emergency_contacts`
2. `manage_function` — `POST /yolo-alert` validates payload, inserts incident
3. `manage_realtime` — enable on `incidents` table
4. Frontend subscribes and starts Vapi Web SDK session

---

### Step 8 — Health API (`api/server.py`)

**Decision:** Small FastAPI app for ops.

- `GET /health` — is the service alive? what model? pipeline stats?
- `POST /test-alert` — fire webhook without camera (integration testing)

Run alongside detection: `python main.py --with-api`

---

## Upgrade path

1. **Record home footage** → tune heuristics in `.env`
2. **Label falls** (Roboflow) → train custom YOLO classifier
3. **Deploy on Jetson / NPU** → set `YOLO_DEVICE=cuda` or `0`
4. **Wire Butterbase** → set `BUTTERBASE_WEBHOOK_URL`
5. **Connect frontend realtime** → tablet auto-starts voice on incident

## Privacy note

Video processing is intended to run **on-device**. Only alert metadata (+ optional snapshot) should leave the home network unless you explicitly choose otherwise.
