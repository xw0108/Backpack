"""
Runtime configuration for the gesture → drone bridge.

Everything is env-driven so the same tree runs on a developer's WSL2 box and on
the Linux machine that actually sits next to the drone.  No Windows paths.
"""

import os
from pathlib import Path

_THIS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _THIS_DIR.parent


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default).strip()


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _find_gesture_root() -> Path:
    """Locate the high_school_io_2025 checkout that owns the models + actions.json."""
    explicit = os.environ.get("GESTURE_ROOT")
    if explicit:
        return Path(explicit).expanduser().resolve()

    # Backpack/server -> Backpack -> "user portal" -> backpack/
    candidates = [
        _REPO_ROOT.parent.parent / "Gesture control" / "high_school_io_2025",
        _REPO_ROOT.parent / "Gesture control" / "high_school_io_2025",
        _REPO_ROOT / "high_school_io_2025",
        Path.home() / "high_school_io_2025",
    ]
    for candidate in candidates:
        if (candidate / "dynamic_gestures").is_dir():
            return candidate.resolve()
    # Fall back to the first candidate so the error message names a real path.
    return candidates[0].resolve()


GESTURE_ROOT: Path = _find_gesture_root()
DYNAMIC_GESTURES_DIR: Path = GESTURE_ROOT / "dynamic_gestures"
MODELS_DIR: Path = DYNAMIC_GESTURES_DIR / "models"
HAND_DETECTOR_ONNX: Path = MODELS_DIR / "hand_detector.onnx"
CROPS_CLASSIFIER_ONNX: Path = MODELS_DIR / "crops_classifier.onnx"

# actions.json is the single source of truth for gesture → drone command, shared
# with the standalone main.py.  Override to run the web UI off a different map.
ACTIONS_PATH: Path = Path(
    _env("ACTIONS_PATH", str(GESTURE_ROOT / "actions.json"))
).expanduser()

# ── Detector gateway (mirrors main.py) ───────────────────────────────────────
DETECTOR: str = _env("DETECTOR", "dynamic_gestures")
YOLO_MODEL_PATH: str = _env(
    "YOLO_MODEL_PATH", str(GESTURE_ROOT / "runs/detect/yolo_training/weights/best.pt")
)
YOLO_CONF: float = float(_env("YOLO_CONF", "0.3"))

# ── Drone ────────────────────────────────────────────────────────────────────
# "test" never imports SoftwarePilot and never touches the aircraft.
# "live" connects for real — but commands still require an explicit arm (below).
RUN_MODE: str = _env("RUN_MODE", "test")
DRONE_TYPE: str = _env("DRONE_TYPE", "parrot_anafi")
# AnafiController: 0/"physical" = drone's own wifi, 1/"controller" = SkyController
DRONE_CONNECTION: str = _env("DRONE_CONNECTION", "1")
DRONE_DOWNLOAD_DIR: str = _env("DRONE_DOWNLOAD_DIR", "None")

# Safety: with this on (the default) a freshly connected drone ignores gesture
# commands until the operator explicitly arms it from the web UI.
REQUIRE_ARM: bool = _env_bool("REQUIRE_ARM", True)

# ── Detection loop ───────────────────────────────────────────────────────────
COOLDOWN_SECONDS: float = float(_env("COOLDOWN_SECONDS", "2.0"))

# ── Camera ───────────────────────────────────────────────────────────────────
# "browser" — the page captures with getUserMedia and uploads JPEG frames over
#             WebSocket.  Works anywhere, including WSL2 with no /dev/video*.
# "server"  — this process opens a V4L2 device and serves annotated MJPEG.
CAMERA_SOURCE: str = _env("CAMERA_SOURCE", "browser")
CAMERA_INDEX: int = int(_env("CAMERA_INDEX", "0"))
CAMERA_WIDTH: int = int(_env("CAMERA_WIDTH", "640"))
CAMERA_HEIGHT: int = int(_env("CAMERA_HEIGHT", "480"))
CAMERA_FPS: int = int(_env("CAMERA_FPS", "30"))
# Server-camera mode flips horizontally to match main.py's mirror view.  Browser
# mode mirrors in CSS instead, so the uploaded frames are already un-mirrored.
CAMERA_FLIP: bool = _env_bool("CAMERA_FLIP", True)

HOST: str = _env("HOST", "0.0.0.0")
PORT: int = int(_env("PORT", "8000"))


#: Everything the detector needs that does not ship with this repo.
REQUIRED_ASSETS = (
    (DYNAMIC_GESTURES_DIR / "utils", "gesture vocabulary (dynamic_gestures/utils)"),
    (DYNAMIC_GESTURES_DIR / "main_controller.py", "tracker (dynamic_gestures)"),
    (HAND_DETECTOR_ONNX, "hand detector model"),
    (CROPS_CLASSIFIER_ONNX, "gesture classifier model"),
    (ACTIONS_PATH, "gesture → command map (actions.json)"),
)


def missing_assets() -> list:
    """Paths from REQUIRED_ASSETS that are not on disk."""
    return [(p, what) for p, what in REQUIRED_ASSETS if not p.exists()]


def missing_assets_message() -> str:
    """
    An actionable error for the most common first-run failure.

    high_school_io_2025/ is gitignored — it is cloned by install.sh, so it is
    absent from a fresh clone or a downloaded ZIP.  Without it the detector
    dies on `No module named 'utils'`, which says nothing useful.
    """
    missing = missing_assets()
    if not missing:
        return ""
    lines = [
        "The gesture project is missing, so the detector cannot start.",
        "",
        f"Looked for it in: {GESTURE_ROOT}",
        "",
        "Not found:",
    ]
    lines += [f"  - {what}: {path}" for path, what in missing]
    lines += [
        "",
        "This directory is gitignored and is NOT part of a clone or a downloaded",
        "ZIP — install.sh clones it, along with the pretrained ONNX models.",
        "",
        "Fix:  ./install.sh --live       (safe to re-run; finished steps are skipped)",
        "",
        "If the project lives elsewhere, point at it instead:",
        "      GESTURE_ROOT=/path/to/high_school_io_2025 ./start.sh",
    ]
    return "\n".join(lines)


def describe() -> dict:
    """Config snapshot for /api/status and startup logging."""
    return {
        "gesture_root": str(GESTURE_ROOT),
        "actions_path": str(ACTIONS_PATH),
        "detector": DETECTOR,
        "run_mode": RUN_MODE,
        "camera_source": CAMERA_SOURCE,
        "require_arm": REQUIRE_ARM,
        "cooldown_seconds": COOLDOWN_SECONDS,
        "drone_type": DRONE_TYPE,
        "drone_connection": DRONE_CONNECTION,
    }
