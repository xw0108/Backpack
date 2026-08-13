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
  * piloting-authority handover.  When the drone is reached through a
    SkyController, the physical sticks own the aircraft and olympe silently
    discards every moveBy the app sends — the command never even reaches the
    device.  Arming now takes authority, disarming gives it straight back.
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
        # True when the link goes through a SkyController rather than the
        # drone's own wifi — only then does piloting authority need handing over.
        self._via_skycontroller: bool = False

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
            self._via_skycontroller = connection in (1, "controller")
            self.last_error = None
            return True, None

    # ── olympe escape hatches ────────────────────────────────────────────────
    # SoftwarePilot exposes only a handful of wrapped calls, but the underlying
    # olympe.Drone hangs off it — piloting authority and flight state have to be
    # read and written there.
    @property
    def _olympe_drone(self):
        return getattr(self._drone, "drone", None)

    def piloting_source(self) -> Optional[str]:
        """
        Who currently owns the aircraft: 'SkyController' (the physical sticks)
        or 'Controller' (this program).  None when not applicable or unknown.
        """
        if self.mode == "test" or not self._via_skycontroller:
            return None
        drone = self._olympe_drone
        if drone is None:
            return None
        try:
            from olympe.messages.skyctrl.CoPilotingState import pilotingSource

            source = drone.get_state(pilotingSource)["source"]
            return getattr(source, "name", str(source))
        except Exception:
            return None

    def flying_state(self) -> Optional[str]:
        """'landed' | 'hovering' | 'flying' | 'landing' | … or None if unknown."""
        if self.mode == "test":
            return None
        drone = self._olympe_drone
        if drone is None:
            return None
        try:
            from olympe.messages.ardrone3.PilotingState import FlyingStateChanged

            state = drone.get_state(FlyingStateChanged)["state"]
            return getattr(state, "name", str(state))
        except Exception:
            return None

    def _set_piloting_source(self, source: str) -> Tuple[bool, Optional[str]]:
        """
        Hand the aircraft between the physical sticks and this program.

        Without this, every moveBy is dropped by olympe before it reaches the
        device — no error, no log line, nothing moves.
        """
        if self.mode == "test" or not self._via_skycontroller:
            return True, None
        drone = self._olympe_drone
        if drone is None:
            return False, "Drone is not connected."
        try:
            from olympe.messages.skyctrl.CoPiloting import setPilotingSource

            if not drone(setPilotingSource(source=source)).wait().success():
                return False, f"SkyController refused to hand piloting to '{source}'."
        except Exception as exc:
            return False, f"setPilotingSource({source}) failed: {exc}"
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
        """
        Arming is the handover: this program takes the aircraft, and the
        SkyController's sticks stop flying it.  If that handover fails we stay
        disarmed rather than pretending — the previous behaviour was to report
        success and then silently drop every command.
        """
        with self._lock:
            if self.mode == "live" and not self.connected:
                return False, "Drone is not connected."

            ok, err = self._set_piloting_source("Controller")
            if not ok:
                self.armed = False
                self.last_error = err
                return False, err

            self.armed = True
            self.last_error = None
            return True, None

    def disarm(self) -> Tuple[bool, Optional[str]]:
        """Give the sticks back. Always disarms locally, even if handback fails."""
        with self._lock:
            self.armed = False
            ok, err = self._set_piloting_source("SkyController")
            if not ok:
                self.last_error = err
            return ok, err

    def _refusal(self) -> Optional[str]:
        """Why a flight command must not be sent right now, or None if it may be."""
        if self.mode == "test":
            return None
        if not self.connected:
            return "Drone is not connected."
        if config.REQUIRE_ARM and not self.armed:
            return "Drone is disarmed — arm it before sending flight commands."
        # Last line of defence against the failure that makes the UI lie: if the
        # sticks still hold the aircraft, olympe will drop whatever we send
        # without raising, and we would report it as delivered.
        source = self.piloting_source()
        if source is not None and source != "Controller":
            return (
                f"The SkyController's sticks still hold the aircraft "
                f"(piloting source is '{source}'). Commands sent now would be "
                f"discarded before reaching the drone — re-arm to take control."
            )
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
    # SoftwarePilot implements these as bare `assert drone(...).wait().success()`,
    # so anything the aircraft declines arrives as an AssertionError carrying no
    # message.  Check the flying state first, both to no-op when the request is
    # already satisfied and to be able to say why it failed.
    AIRBORNE = {"takingoff", "hovering", "flying", "usertakeoff", "motor_ramping"}

    def takeoff(self) -> Tuple[bool, Optional[str]]:
        state = self.flying_state()
        if state in self.AIRBORNE:
            self.flying = True
            return True, None
        ok, err = self._piloting("takeoff")
        if ok:
            self.flying = True
        elif err and "AssertionError" in err:
            err = (
                "The aircraft declined takeoff. Common causes: it is not on a "
                "flat surface, the propellers are obstructed, GPS/calibration is "
                "not ready, or the battery is too low. Current flying state: "
                f"{state or 'unknown'}."
            )
        return ok, err

    def land(self) -> Tuple[bool, Optional[str]]:
        # Landing an aircraft that is already down is a no-op, not a failure.
        # Reporting 409 here is what made the UI look dead after the first
        # emergency stop.
        if self.flying_state() == "landed":
            self.flying = False
            return True, None
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

        state = self.flying_state()

        # Best-effort: cancelling a move that is not running, or landing an
        # aircraft that is already down, both raise here.  Neither means the
        # emergency stop failed, and reporting failure would leave the operator
        # mashing a button that returns 409 forever.
        try:
            drone.piloting.cancel_move_by()
        except Exception:
            pass

        landed = state == "landed"
        if not landed:
            try:
                drone.piloting.land()
                landed = True
            except Exception as exc:
                self.last_error = f"Emergency landing was declined: {exc}"
        self.flying = not landed

        # Hand the aircraft back to the physical sticks so the human pilot has
        # authority the moment the web side gives up.
        self._set_piloting_source("SkyController")

        if not landed:
            return False, self.last_error
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
            flying_state = self.flying_state()
            return {
                "mode": self.mode,
                "connected": self.connected,
                "armed": self.armed,
                "require_arm": config.REQUIRE_ARM,
                "flying": self.flying,
                # Surfaced so the operator can see who actually holds the
                # aircraft, rather than inferring it from things not moving.
                "piloting_source": self.piloting_source(),
                "via_skycontroller": self._via_skycontroller,
                "flying_state": flying_state,
                "last_error": self.last_error,
                "last_command": self.last_command,
            }
