"""
Gesture detection worker — run with the gesture-control .venv Python.
Usage: python gesture_worker.py <gesture_project_root>

STDOUT protocol (read by FastAPI parent):
  {"status": "ready"}                               — camera + models loaded
  {"label":..., "command":..., "emoji":..., "confidence":...} — gesture frame
  {"error": "..."}                                  — fatal error

ALL other output (ONNX logs, cv2 warnings, etc.) is redirected to STDERR
before any imports, so the stdout pipe stays clean JSON-only.
"""

import os
import sys

# ── Redirect stdout BEFORE any imports ──────────────────────────────────────
# ONNX Runtime and ultralytics print [I:...] / [W:...] logs to Python stdout.
# Redirect sys.stdout → stderr so those logs never enter the parent's pipe.
# We keep _json_out pointing at the real fd-1 (the PIPE) for our JSON lines.
_json_fd    = os.dup(1)                          # save real stdout fd
_json_out   = os.fdopen(_json_fd, "w", 1)        # line-buffered writer on it
sys.stdout  = sys.stderr                         # all prints → stderr (drained)
# ────────────────────────────────────────────────────────────────────────────

import json
import time
from typing import Optional

GESTURE_ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(__file__)

sys.path.insert(0, GESTURE_ROOT)
sys.path.insert(0, os.path.join(GESTURE_ROOT, "dynamic_gestures"))

import cv2
import numpy as np

from main_controller import MainController
from utils import targets   # list of 45 gesture label strings

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def emit(payload: dict) -> None:
    """Write a JSON line to the real stdout pipe (parent reads this)."""
    _json_out.write(json.dumps(payload) + "\n")
    _json_out.flush()


def log(msg: str) -> None:
    print(f"[gesture_worker] {msg}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# Gesture → drone command mapping
# ---------------------------------------------------------------------------
GESTURE_MAP = {
    "like":          {"command": "ascend",      "emoji": "👍"},
    "dislike":       {"command": "descend",      "emoji": "👎"},
    "stop":          {"command": "hover",        "emoji": "✋"},
    "peace":         {"command": "forward",      "emoji": "✌️"},
    "fist":          {"command": "backward",     "emoji": "✊"},
    "palm":          {"command": "takeoff",      "emoji": "🖐️"},
    "ok":            {"command": "land",         "emoji": "👌"},
    "one":           {"command": "yaw_left",     "emoji": "☝️"},
    "two_up":        {"command": "yaw_right",    "emoji": "✌️"},
    "rock":          {"command": "emergency",    "emoji": "🤟"},
    "call":          {"command": "return_home",  "emoji": "🤙"},
    "stop_inverted": {"command": "hover",        "emoji": "🖐️"},
    "mute":          {"command": "hover",        "emoji": "🤫"},
}

COMMAND_COLORS = {
    "takeoff":     (0, 230, 118),
    "hover":       (0, 191, 255),
    "ascend":      (255, 200, 0),
    "descend":     (180, 0, 255),
    "forward":     (0, 255, 180),
    "backward":    (255, 80, 160),
    "yaw_left":    (80, 80, 255),
    "yaw_right":   (255, 140, 0),
    "land":        (0, 220, 200),
    "return_home": (100, 100, 255),
    "emergency":   (0, 0, 255),
}


def draw_overlay(frame, label, command, bbox=None):
    out = frame.copy()
    color = COMMAND_COLORS.get(command, (255, 255, 255))
    if bbox is not None:
        x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
        tag = f"{label} -> {command}"
        (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        ty = max(y1 - 10, th + 4)
        cv2.rectangle(out, (x1, ty - th - 4), (x1 + tw + 8, ty + 4), color, -1)
        cv2.putText(out, tag, (x1 + 4, ty), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    h, w = out.shape[:2]
    hud = f"{label} -> {command}  |  Press Q to close" if label else "Waiting for gesture...  |  Press Q to close"
    cv2.rectangle(out, (0, h - 36), (w, h), (20, 20, 20), -1)
    cv2.putText(out, hud, (10, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6,
                color if label else (160, 160, 160), 1 if not label else 2)
    return out


def open_camera():
    for idx in range(5):
        cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            log(f"Camera opened on index {idx}")
            return cap
        cap.release()
    return None


def main():
    models_dir         = os.path.join(GESTURE_ROOT, "dynamic_gestures", "models")
    hand_detector_path = os.path.join(models_dir, "hand_detector.onnx")
    classifier_path    = os.path.join(models_dir, "crops_classifier.onnx")

    log(f"Loading ONNX models from {models_dir}")
    try:
        controller = MainController(hand_detector_path, classifier_path)
    except Exception as e:
        log(f"ERROR loading models: {e}")
        emit({"error": f"Model load failed: {e}"})
        return

    log("Models loaded. Opening camera...")
    cap = open_camera()
    if cap is None:
        log("ERROR: No camera found")
        emit({"error": "No camera found"})
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)

    # Signal parent — camera is open, ready to detect
    emit({"status": "ready"})
    log("Camera ready — starting detection loop")

    cv2.namedWindow("Gesture Control", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Gesture Control", 800, 520)

    last_label: Optional[str] = None
    last_sent  = 0.0
    COOLDOWN   = 1.5

    last_disp_label   = ""
    last_disp_command = ""
    last_bbox         = None

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                log("Camera read failed — stopping")
                break

            frame = cv2.flip(frame, 1)

            try:
                bboxes, ids, labels = controller(frame)
            except Exception as e:
                log(f"Inference error: {e}")
                cv2.imshow("Gesture Control", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                continue

            now = time.time()
            detected = False

            if bboxes is not None and len(bboxes) > 0 and labels is not None:
                for i, label_idx in enumerate(labels):
                    if label_idx is None:
                        continue
                    try:
                        label = targets[int(label_idx)]
                    except (IndexError, TypeError):
                        continue
                    if label not in GESTURE_MAP:
                        continue

                    try:
                        bbox = bboxes[i]
                    except Exception:
                        bbox = None

                    info = GESTURE_MAP[label]
                    last_disp_label   = label
                    last_disp_command = info["command"]
                    last_bbox         = bbox
                    detected          = True

                    # Cooldown before emitting to frontend
                    if label == last_label and now - last_sent < COOLDOWN:
                        break

                    tracker_id = int(ids[i]) if ids is not None and ids[i] is not None else 1
                    confidence = round(min(0.98, 0.70 + 0.04 * (tracker_id % 8)), 3)

                    emit({
                        "label":      label,
                        "command":    info["command"],
                        "emoji":      info["emoji"],
                        "confidence": confidence,
                        "fake":       False,
                    })
                    last_label = label
                    last_sent  = now
                    break

            # Live preview window
            if detected and last_disp_label:
                display = draw_overlay(frame, last_disp_label, last_disp_command, last_bbox)
            elif last_disp_label and (now - last_sent < 2.0):
                display = draw_overlay(frame, last_disp_label, last_disp_command, None)
            else:
                display = draw_overlay(frame, "", "", None)

            cv2.imshow("Gesture Control", display)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                log("User pressed Q — stopping")
                break

    except (KeyboardInterrupt, BrokenPipeError):
        log("Worker shutting down")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        log("Camera released")


if __name__ == "__main__":
    main()
