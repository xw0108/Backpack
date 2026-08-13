"""
Detector gateway — same two engines as high_school_io_2025/main.py.

  "dynamic_gestures"  ONNX hand detector + crop classifier, with OCSort tracking
                      (this is the one that recognises *dynamic* gestures, so it
                      needs to be fed consecutive frames from a single thread).
  "yolo"              a locally trained ultralytics .pt model.

detect(frame) -> (bboxes: np.ndarray[N,4], ids: list, label_indices: list)
Indices are positions in dynamic_gestures.utils.targets, matching main.py.
"""

import sys
from typing import List, Optional, Tuple

import numpy as np

import config

# dynamic_gestures does flat intra-package imports ("from ocsort import ...",
# "from utils import targets"), so both it and its parent must be importable.
for _path in (str(config.GESTURE_ROOT), str(config.DYNAMIC_GESTURES_DIR)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

from utils import targets  # noqa: E402  — shared gesture vocabulary (45 labels)

__all__ = ["Detector", "targets"]

_EMPTY = (np.empty((0, 4), dtype=np.float32), [], [])


class Detector:
    """Wraps whichever engine config.DETECTOR selects. Not thread-safe by design."""

    def __init__(self) -> None:
        self.kind = config.DETECTOR
        self._tracker_errors = 0
        if self.kind == "dynamic_gestures":
            self._init_dynamic_gestures()
        elif self.kind == "yolo":
            self._init_yolo()
        else:
            raise ValueError(
                f"Unknown DETECTOR: {self.kind!r}. Use 'dynamic_gestures' or 'yolo'."
            )

    # ── engines ──────────────────────────────────────────────────────────────
    def _init_dynamic_gestures(self) -> None:
        missing = [
            str(p)
            for p in (config.HAND_DETECTOR_ONNX, config.CROPS_CLASSIFIER_ONNX)
            if not p.is_file()
        ]
        if missing:
            raise FileNotFoundError("ONNX model(s) not found: " + ", ".join(missing))

        from main_controller import MainController

        self._controller = MainController(
            str(config.HAND_DETECTOR_ONNX),
            str(config.CROPS_CLASSIFIER_ONNX),
        )

    def _init_yolo(self) -> None:
        from ultralytics import YOLO as _YOLO

        self._yolo = _YOLO(config.YOLO_MODEL_PATH)
        # Map YOLO class ids straight onto target labels by name, so a model
        # trained with the standard label set needs no hand-written table.
        self._label_to_idx = {label: i for i, label in enumerate(targets)}
        self._names = getattr(self._yolo, "names", {}) or {}

    # ── inference ────────────────────────────────────────────────────────────
    def __call__(self, frame) -> Tuple[np.ndarray, List, List[Optional[int]]]:
        if self.kind == "dynamic_gestures":
            try:
                bboxes, ids, labels = self._controller(frame)
            except Exception as exc:
                # dynamic_gestures' vendored OCSort/filterpy occasionally throws
                # while re-acquiring a lost track ("only 0-dimensional arrays can
                # be converted to Python scalars" in kalmanfilter.unfreeze, a
                # numpy-version incompatibility upstream).  One bad frame is not
                # worth tearing down the session or spamming the operator, so
                # treat it as a frame with no detections.
                self._tracker_errors += 1
                if self._tracker_errors in (1, 10) or self._tracker_errors % 100 == 0:
                    print(
                        f"[detector] tracker error #{self._tracker_errors} "
                        f"(frame dropped): {type(exc).__name__}: {exc}",
                        file=sys.stderr,
                        flush=True,
                    )
                return _EMPTY
            # MainController returns (None, None, None) when nothing is tracked.
            if bboxes is None or len(bboxes) == 0:
                return _EMPTY
            bboxes = np.asarray(bboxes, dtype=np.float32)[:, :4]
            ids = list(ids) if ids is not None else [None] * len(bboxes)
            labels = list(labels) if labels is not None else [None] * len(bboxes)
            return bboxes, ids, labels

        results = self._yolo(frame, conf=config.YOLO_CONF, verbose=False)[0]
        boxes = results.boxes
        if boxes is None or len(boxes) == 0:
            return _EMPTY
        bboxes = boxes.xyxy.cpu().numpy().astype(np.float32)
        label_indices = [
            self._label_to_idx.get(self._names.get(int(cls)))
            for cls in boxes.cls.cpu().numpy()
        ]
        return bboxes, [None] * len(bboxes), label_indices


def label_for(index: Optional[int]) -> Optional[str]:
    """targets[index] with the bounds/None handling main.py does inline."""
    if index is None:
        return None
    try:
        return targets[int(index)]
    except (IndexError, TypeError, ValueError):
        return None
