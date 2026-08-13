"""
Drone controller — the "live" half of RUN_MODE, lifted from
high_school_io_2025/main.py and wrapped so a web request can drive it safely.

execute() is a faithful port of main.py's execute_action(): it resolves
{"component": ..., "action": ..., "args": [...], "kwargs": {...}} against the
SoftwarePilot drone object.  actions.json therefore keeps working unchanged.

What is new relative to the desktop script:

  * an ARM gate — connecting is not the same as consenting to fly.  Until the
    operator arms from the UI, gesture-driven commands are refused.  A stray
    hand in frame while someone sets up the page must not move the aircraft.
  * takeoff / land / return-to-home / emergency, which actions.json does not
    cover but a browser-only operator has no other way to trigger.
  * every call is serialised under a lock and every failure is captured, since
    calls now arrive from both the detection thread and HTTP handlers.
"""

import threading
import time
import traceback
from typing import Any, Dict, Optional, Tuple

import config


class DroneError(RuntimeError):
    pass


class DroneController:
    """
    Owns the SoftwarePilot connection.  In RUN_MODE=test nothing is imported and
    nothing is sent, but execute() still reports success so the whole gesture
    pipeline — counts, limits, balance bookkeeping — behaves identically.
    """

    def __init__(self) -> None:
        self.mode: str = config.RUN_MODE
        if self.mode not in {"test", "live"}:
            raise ValueError("RUN_MODE must be either 'test' or 'live'.")

        self._lock = threading.RLock()
        self._drone: Optional[Any] = None
        self.connected: bool = False
        self.armed: bool = False
        self.last_error: Optional[str] = None
        self.last_command: Optional[Dict[str, Any]] = None
        self.flying: bool = False

    # ── connection ───────────────────────────────────────────────────────────
    def connect(self) -> Tuple[bool, Optional[str]]:
        """Idempotent. In test mode this is a no-op that reports success."""
        with self._lock:
            if self.mode == "test":
                self.connected = False
                self.last_error = None
                return True, None
            if self.connected:
                return True, None

            try:
                from SoftwarePilot import SoftwarePilot
            except Exception as exc:  # olympe is Linux-only; say so clearly
                self.last_error = (
                    f"SoftwarePilot import failed ({type(exc).__name__}: {exc}). "
                    "RUN_MODE=live needs parrot-olympe, which only runs on Linux x86_64."
                )
                return False, self.last_error

            try:
                connection = config.DRONE_CONNECTION
                # AnafiController accepts 0/1 or "physical"/"controller".
                if connection.isdigit():
                    connection = int(connection)
                sp = SoftwarePilot()
                # Same call shape as main.py.  Note SoftwarePilot's own
                # setup_drone() ignores download_dir and always passes "None".
                self._drone = sp.setup_drone(
                    config.DRONE_TYPE, connection, config.DRONE_DOWNLOAD_DIR
                )
                self._drone.connect()
            except Exception as exc:
                self._drone = None
                self.connected = False
                self.last_error = self._explain_connect_failure(exc, connection)
                traceback.print_exc()
                return False, self.last_error

            self.connected = True
            self.armed = False
            self.last_error = None
            return True, None

    @staticmethod
    def _explain_connect_failure(exc: Exception, connection) -> str:
        """
        SoftwarePilot's connect() is `assert self.drone.connect(retry=3)`, so a
        failure to reach the aircraft surfaces as a bare AssertionError with no
        message at all.  Say what actually went wrong instead.
        """
        target = "192.168.53.1 (SkyController)" if connection in (1, "controller") \
            else "192.168.42.1 (drone's own wifi)"
        if isinstance(exc, AssertionError) and not str(exc):
            return (
                f"Could not reach {target}. The host running this backend has no "
                f"route to it. Check that the interface exists here — on Linux the "
                f"SkyController appears as a USB network device (rndis_host); under "
                f"WSL2 it does not, unless WSL networkingMode=mirrored is enabled and "
                f"Windows itself has the RNDIS driver bound."
            )
        return f"{type(exc).__name__}: {exc}"

    def disconnect(self) -> None:
        with self._lock:
            self.armed = False
            drone, self._drone = self._drone, None
            self.connected = False
            if drone is not None:
                try:
                    drone.disconnect()
                except Exception:
                    pass

    # ── arming ───────────────────────────────────────────────────────────────
    def arm(self) -> Tuple[bool, Optional[str]]:
        with self._lock:
            if self.mode == "live" and not self.connected:
                return False, "Drone is not connected."
            self.armed = True
            return True, None

    def disarm(self) -> None:
        with self._lock:
            self.armed = False

    def _refusal(self) -> Optional[str]:
        """Why a flight command must not be sent right now, or None if it may be."""
        if self.mode == "test":
            return None
        if not self.connected:
            return "Drone is not connected."
        if config.REQUIRE_ARM and not self.armed:
            return "Drone is disarmed — arm it before sending flight commands."
        return None

    # ── command execution ────────────────────────────────────────────────────
    def execute(self, command_config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Port of main.py execute_action().  Returns (success, error).

        In test mode this reports success without touching hardware, exactly as
        the desktop script does, so counts and balance positions still advance.
        """
        component_name = command_config.get("component")
        action_name = command_config.get("action")
        args = command_config.get("args", [])
        kwargs = command_config.get("kwargs", {})

        with self._lock:
            self.last_command = {
                "component": component_name,
                "action": action_name,
                "args": list(args),
                "kwargs": dict(kwargs),
                "at": time.time(),
            }

            refusal = self._refusal()
            if refusal:
                return False, refusal

            if self.mode == "test":
                return True, None

            drone = self._drone
            if drone is None:
                return False, "Drone is not connected."

            if not component_name or not hasattr(drone, component_name):
                return False, f"Component {component_name} not found on drone"
            component = getattr(drone, component_name)
            if not action_name or not hasattr(component, action_name):
                return False, f"Action {action_name} not found on {component_name}"

            try:
                getattr(component, action_name)(*args, **kwargs)
            except Exception as exc:
                err = f"Error executing {action_name}: {exc}"
                self.last_error = err
                traceback.print_exc()
                return False, err

            return True, None

    # ── flight primitives (not in actions.json) ──────────────────────────────
    def takeoff(self) -> Tuple[bool, Optional[str]]:
        ok, err = self._piloting("takeoff")
        if ok:
            self.flying = True
        return ok, err

    def land(self) -> Tuple[bool, Optional[str]]:
        ok, err = self._piloting("land")
        if ok:
            self.flying = False
        return ok, err

    def return_home(self) -> Tuple[bool, Optional[str]]:
        with self._lock:
            refusal = self._refusal()
            if refusal:
                return False, refusal
            if self.mode == "test":
                return True, None
            try:
                self._drone.rth.return_to_home()
            except Exception as exc:
                return False, f"{type(exc).__name__}: {exc}"
            return True, None

    def emergency(self) -> Tuple[bool, Optional[str]]:
        """
        Operator panic button.  Deliberately *not* olympe's Emergency(), which
        cuts the motors and drops the aircraft: cancel whatever move is in
        flight, land, and disarm so gestures stop being obeyed.

        This is the one call that must never wait in line.  Disarming happens
        under the lock (it is instant, and stops the detection thread from
        issuing anything further), but the olympe calls are made *outside* it —
        a takeoff or a landing already in progress can hold the lock for
        seconds, and olympe.Drone is itself safe to command from another
        thread.
        """
        with self._lock:
            self.armed = False
            drone = self._drone
            if self.mode == "test" or drone is None:
                self.flying = False
                return True, None

        problems = []
        try:
            drone.piloting.cancel_move_by()
        except Exception as exc:
            problems.append(f"cancel_move_by: {exc}")
        try:
            drone.piloting.land()
            self.flying = False
        except Exception as exc:
            problems.append(f"land: {exc}")

        if problems:
            err = "; ".join(problems)
            self.last_error = err
            return False, err
        return True, None

    def _piloting(self, method: str) -> Tuple[bool, Optional[str]]:
        with self._lock:
            refusal = self._refusal()
            if refusal:
                return False, refusal
            if self.mode == "test":
                return True, None
            try:
                getattr(self._drone.piloting, method)()
            except Exception as exc:
                err = f"{type(exc).__name__}: {exc}"
                self.last_error = err
                traceback.print_exc()
                return False, err
            return True, None

    # ── introspection ────────────────────────────────────────────────────────
    def coordinates(self) -> Optional[list]:
        with self._lock:
            if self.mode == "test" or self._drone is None:
                return None
            try:
                return self._drone.get_drone_coordinates()
            except Exception:
                return None

    def status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "mode": self.mode,
                "connected": self.connected,
                "armed": self.armed,
                "require_arm": config.REQUIRE_ARM,
                "flying": self.flying,
                "last_error": self.last_error,
                "last_command": self.last_command,
            }
