"""
Gesture engine — the decision logic of high_school_io_2025/main.py, lifted out
of its cv2.imshow loop so it can be driven by any frame source.

The behaviour is a faithful port and is meant to stay that way:

  * actions.json is the only gesture → command map (no second hard-coded table)
  * one *global* cooldown shared by all gestures, exactly as in main.py
  * per-gesture max_executions
  * "balance" groups: bounded travel with optional auto_reverse, so `like`
    can only climb until vertical hits its max, `peace`/`fist` share the
    forward_back budget, and so on
  * a command that fails to execute advances nothing — not the counter, not the
    balance position, not the cooldown

feed(frame) returns one JSON-ready event describing what was seen and what,
if anything, was sent to the aircraft.
"""

import copy
import json
import threading
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

import config
from detector import Detector, label_for


# ── actions.json ─────────────────────────────────────────────────────────────
def load_actions() -> Dict[str, Any]:
    try:
        with open(config.ACTIONS_PATH, "r") as handle:
            return json.load(handle)
    except FileNotFoundError:
        print(f"actions.json not found at {config.ACTIONS_PATH}! Please create it.")
        return {}


# ── pure helpers, ported verbatim in behaviour from main.py ──────────────────
def action_limit(action_config: Dict[str, Any]) -> Optional[int]:
    max_executions = action_config.get("max_executions")
    if max_executions is None:
        return None
    return int(max_executions)


def action_limit_text(action_config: Dict[str, Any]) -> str:
    max_executions = action_limit(action_config)
    if max_executions is not None:
        return str(max_executions)

    balance = action_config.get("balance")
    if isinstance(balance, dict):
        min_pos = float(balance.get("min", 0))
        max_pos = float(balance.get("max", 0))
        bounded_limit = int(max(abs(min_pos), abs(max_pos)))
        return "2" if bounded_limit == 2 else f"bounded:{bounded_limit}"

    return "unlimited"


def bounded_progress_for_display(
    action_config: Dict[str, Any], balance_positions: Dict[str, float]
) -> Optional[Tuple[int, int]]:
    balance = action_config.get("balance")
    if not isinstance(balance, dict):
        return None

    group = balance.get("group")
    delta = float(balance.get("delta", 0))
    min_pos = float(balance.get("min", 0))
    max_pos = float(balance.get("max", 0))
    if not group:
        return None

    pos = float(balance_positions[group])
    progress = None
    limit = int(max(abs(min_pos), abs(max_pos)))

    if group == "vertical":
        progress = pos if delta > 0 else max_pos - pos
        limit = int(max_pos - min_pos)
    elif group == "forward_back":
        if delta > 0:
            progress = pos if pos >= 0 else max_pos + pos
        else:
            progress = -pos if pos <= 0 else max_pos - pos
        limit = int(max_pos)

    if progress is None:
        return None
    progress = int(max(0, min(limit, progress)))
    return progress, max(1, limit)


def resolve_balanced_command(
    action_config: Dict[str, Any],
    balance_positions: Dict[str, float],
    balance_directions: Dict[str, float],
) -> Tuple[Optional[Dict[str, Any]], Optional[str], float]:
    balance = action_config.get("balance")
    if not isinstance(balance, dict):
        return action_config, None, 0

    group = balance.get("group")
    delta = float(balance.get("delta", 0))
    min_pos = float(balance.get("min", -float("inf")))
    max_pos = float(balance.get("max", float("inf")))
    arg_index = int(balance.get("arg_index", 0))
    auto_reverse = bool(balance.get("auto_reverse", False))
    if not group or delta == 0:
        return None, None, 0

    current_pos = balance_positions[group]
    direction = balance_directions[group]
    step = delta

    if auto_reverse:
        if current_pos >= max_pos and direction > 0:
            direction = -1
        elif current_pos <= min_pos and direction < 0:
            direction = 1
        balance_directions[group] = direction
        step = abs(delta) * direction

    new_pos = current_pos + step
    if new_pos < min_pos or new_pos > max_pos:
        return None, group, step

    command = copy.deepcopy(action_config)
    args = list(command.get("args", []))
    if arg_index < 0 or arg_index >= len(args):
        return None, group, step
    args[arg_index] = step
    command["args"] = args
    return command, group, step


# ── engine ───────────────────────────────────────────────────────────────────
class GestureEngine:
    """
    Stateful, single-threaded.  Frames must be fed in order from one thread
    because the dynamic-gesture detector tracks hands across frames.
    """

    def __init__(self, drone) -> None:
        self.drone = drone
        self.actions_config: Dict[str, Any] = load_actions()
        self.cooldown_seconds: float = config.COOLDOWN_SECONDS

        self._detector: Optional[Detector] = None
        self._lock = threading.Lock()

        self.last_action_time: float = 0.0
        self.action_counts: Dict[str, int] = {}
        self.balance_positions: Dict[str, float] = defaultdict(float)
        self.balance_directions: Dict[str, float] = defaultdict(lambda: 1)
        self.reset_state()

    # ── lifecycle ────────────────────────────────────────────────────────────
    def load(self) -> None:
        """Build the detector (slow: reads ONNX / .pt weights)."""
        if self._detector is None:
            self._detector = Detector()

    @property
    def ready(self) -> bool:
        return self._detector is not None

    def reset_state(self) -> None:
        """Clear counters and balance positions — called on each session start."""
        with self._lock:
            self.actions_config = load_actions()
            self.last_action_time = 0.0
            self.action_counts = {label: 0 for label in self.actions_config}
            self.balance_positions = defaultdict(float)
            self.balance_directions = defaultdict(lambda: 1)

    # ── per-frame ────────────────────────────────────────────────────────────
    def feed(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Run detection on one frame and act on it.

        Returns {"detections": [...], "executions": [...], "state": {...}}.
        Detections carry pixel bboxes in the frame's own coordinate space so the
        browser can draw them straight onto the video it is already showing.
        """
        if self._detector is None:
            raise RuntimeError("GestureEngine.load() must be called before feed().")

        bboxes, ids, label_indices = self._detector(frame)
        now = time.time()

        detections: List[Dict[str, Any]] = []
        executions: List[Dict[str, Any]] = []

        if bboxes is not None and len(bboxes) > 0:
            boxes_int = np.asarray(bboxes).astype(np.int32)
            for i in range(boxes_int.shape[0]):
                box = boxes_int[i]
                label = label_for(label_indices[i] if i < len(label_indices) else None)
                configured = bool(label and label in self.actions_config)

                detections.append(
                    {
                        "label": label,
                        "configured": configured,
                        "bbox": [int(box[0]), int(box[1]), int(box[2]), int(box[3])],
                        "track_id": (
                            int(ids[i])
                            if i < len(ids) and ids[i] is not None
                            else None
                        ),
                    }
                )

                if configured and now - self.last_action_time > self.cooldown_seconds:
                    execution = self._try_execute(label, now)
                    if execution is not None:
                        executions.append(execution)

        return {
            "detections": detections,
            "executions": executions,
            "state": self.state(),
            "frame_size": [int(frame.shape[1]), int(frame.shape[0])],
        }

    def _try_execute(self, label: str, now: float) -> Optional[Dict[str, Any]]:
        """
        One gesture, one decision.  Mirrors the inner block of main.py's loop:
        check the per-gesture limit, resolve the balanced command, execute, and
        only then advance counters / balance / cooldown.
        """
        with self._lock:
            cfg = self.actions_config[label]
            max_executions = action_limit(cfg)
            already_executed = self.action_counts.get(label, 0)

            if max_executions is not None and already_executed >= max_executions:
                return {
                    "label": label,
                    "executed": False,
                    "reason": f"limit reached ({already_executed}/{max_executions})",
                }

            command, balance_group, balance_step = resolve_balanced_command(
                cfg, self.balance_positions, self.balance_directions
            )
            if command is None:
                return {
                    "label": label,
                    "executed": False,
                    "reason": (
                        f"{balance_group} range exhausted"
                        if balance_group
                        else "no runnable command"
                    ),
                }

            success, error = self.drone.execute(command)

            if success:
                self.action_counts[label] = already_executed + 1
                if balance_group is not None:
                    self.balance_positions[balance_group] += balance_step
                self.last_action_time = now

            return {
                "label": label,
                "executed": bool(success),
                "reason": error,
                "count": self.action_counts.get(label, 0),
                "component": command.get("component"),
                "action": command.get("action"),
                "args": list(command.get("args", [])),
                "kwargs": dict(command.get("kwargs", {})),
                "balance_group": balance_group,
                "balance_step": balance_step,
                "at": now,
            }

    # ── state for the UI ─────────────────────────────────────────────────────
    def state(self) -> Dict[str, Any]:
        """
        The same numbers main.py paints onto the frame, as data instead of
        pixels: per-gesture progress, and the two bounded travel budgets.
        """
        gestures = {}
        for name, cfg in self.actions_config.items():
            bounded = bounded_progress_for_display(cfg, self.balance_positions)
            if bounded is not None:
                executed, limit = bounded
                gestures[name] = {
                    "executed": executed,
                    "limit_text": str(limit),
                    "bounded": True,
                    "limit": limit,
                }
            else:
                gestures[name] = {
                    "executed": self.action_counts.get(name, 0),
                    "limit_text": action_limit_text(cfg),
                    "bounded": False,
                    "limit": action_limit(cfg),
                }

        balance: Dict[str, Any] = {}
        if "vertical" in self.balance_positions:
            v_pos = int(self.balance_positions["vertical"])
            balance["vertical"] = {
                "position": v_pos,
                "up_left": max(0, 2 - v_pos),
                "down_left": max(0, v_pos),
            }
        if "forward_back" in self.balance_positions:
            fb_pos = int(self.balance_positions["forward_back"])
            balance["forward_back"] = {
                "position": fb_pos,
                "forward_left": max(0, 2 - fb_pos),
                "backward_left": max(0, fb_pos + 2),
            }

        cooldown_left = max(
            0.0, self.cooldown_seconds - (time.time() - self.last_action_time)
        )
        return {
            "gestures": gestures,
            "balance": balance,
            "cooldown_seconds": self.cooldown_seconds,
            "cooldown_remaining": round(cooldown_left, 2),
        }

    def catalogue(self) -> List[Dict[str, Any]]:
        """actions.json rendered for the UI's gesture reference grid."""
        entries = []
        for name, cfg in self.actions_config.items():
            balance = cfg.get("balance") if isinstance(cfg.get("balance"), dict) else None
            entries.append(
                {
                    "label": name,
                    "component": cfg.get("component"),
                    "action": cfg.get("action"),
                    "args": cfg.get("args", []),
                    "kwargs": cfg.get("kwargs", {}),
                    "max_executions": cfg.get("max_executions"),
                    "limit_text": action_limit_text(cfg),
                    "balance": balance,
                }
            )
        return entries
