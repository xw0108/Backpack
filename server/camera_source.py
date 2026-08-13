"""
Server-side camera source (CAMERA_SOURCE=server).

For the deployment the project actually targets — a Linux box sitting next to
the drone with the webcam plugged into it — the browser is just a display, so
the frames come from /dev/videoN here and go out as MJPEG.

The browser-capture path does not use any of this; see main.py's frame socket.

Note for WSL2: /dev/video* does not exist unless the webcam has been attached
with usbipd-win.  Without that, use CAMERA_SOURCE=browser.
"""

import threading
import time
from typing import Callable, Optional

import cv2
import numpy as np

import config


def open_camera(indices=(0, 1, 2, 3, 4)) -> Optional[cv2.VideoCapture]:
    """main.py's camera probe, preferring the configured index."""
    ordered = [config.CAMERA_INDEX] + [i for i in indices if i != config.CAMERA_INDEX]
    for idx in ordered:
        cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            print(f"Camera opened on index {idx}.")
            return cap
        cap.release()
    return None


def annotate(frame: np.ndarray, detections, state) -> np.ndarray:
    """Draw the same overlay main.py drew, for the MJPEG stream."""
    out = frame
    for det in detections:
        if not det.get("configured"):
            continue
        x1, y1, x2, y2 = det["bbox"]
        cv2.rectangle(out, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(
            out, det["label"] or "", (x1, max(y1 - 10, 12)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2,
        )

    y_offset = 25
    for name, info in state.get("gestures", {}).items():
        cv2.putText(
            out, f"{name}: {info['executed']}/{info['limit_text']}",
            (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 0), 2,
        )
        y_offset += 24

    balance = state.get("balance", {})
    if "vertical" in balance:
        b = balance["vertical"]
        cv2.putText(
            out,
            f"vertical position={b['position']} | up_left={b['up_left']} down_left={b['down_left']}",
            (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 200, 120), 1,
        )
        y_offset += 20
    if "forward_back" in balance:
        b = balance["forward_back"]
        cv2.putText(
            out,
            f"forward_back position={b['position']} | forward_left={b['forward_left']} backward_left={b['backward_left']}",
            (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (120, 255, 220), 1,
        )
        y_offset += 20

    return out


class ServerCamera:
    """
    Capture thread: grabs frames, runs them through the engine, publishes both
    the JSON event (via on_event) and an annotated JPEG (via latest_jpeg()).
    """

    def __init__(self, engine, on_event: Callable[[dict], None]) -> None:
        self.engine = engine
        self.on_event = on_event
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._jpeg: Optional[bytes] = None
        self._jpeg_lock = threading.Lock()
        self.error: Optional[str] = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self.error = None
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        thread = self._thread
        if thread and thread.is_alive():
            thread.join(timeout=3)
        self._thread = None

    @property
    def running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def latest_jpeg(self) -> Optional[bytes]:
        with self._jpeg_lock:
            return self._jpeg

    def _run(self) -> None:
        cap = open_camera()
        if cap is None:
            self.error = (
                "Could not open any camera index (0-4). On WSL2 you must attach the "
                "webcam with usbipd-win first, or set CAMERA_SOURCE=browser."
            )
            self.on_event({"type": "error", "message": self.error})
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.CAMERA_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.CAMERA_HEIGHT)
        cap.set(cv2.CAP_PROP_FPS, config.CAMERA_FPS)

        self.on_event({"type": "camera_ready", "source": "server"})

        try:
            while not self._stop.is_set():
                ret, frame = cap.read()
                if not ret:
                    self.error = "Camera read failed."
                    self.on_event({"type": "error", "message": self.error})
                    break
                if config.CAMERA_FLIP:
                    frame = cv2.flip(frame, 1)

                try:
                    result = self.engine.feed(frame)
                except Exception as exc:
                    self.on_event({"type": "error", "message": f"Inference error: {exc}"})
                    time.sleep(0.05)
                    continue

                self.on_event({"type": "frame", **result})

                annotated = annotate(frame, result["detections"], result["state"])
                ok, buf = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
                if ok:
                    with self._jpeg_lock:
                        self._jpeg = buf.tobytes()
        finally:
            cap.release()
            self.on_event({"type": "camera_stopped"})
