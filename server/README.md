# Gesture → Drone bridge

Turns the standalone desktop script `high_school_io_2025/main.py` into something
an operator drives entirely from the web page: camera in the browser, gesture
recognition and real flight commands on the backend.

Target platform is **Linux x86_64**, because `parrot-olympe` — which
SoftwarePilot wraps — ships no Windows or macOS build.

---

## What runs where

```
browser                          backend (one Python process)
────────────────────────────     ──────────────────────────────────────────────
<video> getUserMedia
  │  mirror → canvas → JPEG
  └──► WS /api/ws/frames ──────► cv2.imdecode
                                   │
                                 detector.py    ONNX hand detect + classify
                                   │            (dynamic_gestures, unchanged)
                                 gesture_engine.py
                                   │            actions.json, cooldown, limits,
                                   │            balance budgets  ← ported from
                                   │            main.py, behaviour-identical
                                 drone.py
                                   │            SoftwarePilot → olympe → aircraft
  ◄──── detections + executions ───┘
```

`actions.json` from the gesture-control checkout is the **only** gesture →
command map. The web UI fetches it from `/api/actions` and renders whatever it
finds, so the page and the desktop script cannot drift apart.

| File | Role |
| --- | --- |
| `config.py` | every knob, all env-driven |
| `detector.py` | detector gateway — `dynamic_gestures` (default) or `yolo` |
| `gesture_engine.py` | the decision logic ported from `main.py` |
| `drone.py` | SoftwarePilot wrapper: test/live, arm gate, emergency |
| `camera_source.py` | server-side V4L2 capture + MJPEG (optional mode) |
| `main.py` | FastAPI: REST + WebSockets |

---

## Setup

From the repo root:

```bash
./install.sh --live   # everything, including real flight support
./start.sh --live     # → http://localhost:8000
```

`install.sh` also clones the two upstream repos this backend depends on. That
matters more than it looks: `high_school_io_2025` records `dynamic_gestures` as
a gitlink but ships **no `.gitmodules`**, so a plain clone leaves that directory
empty and `git submodule update --init` cannot fix it. The installer clones
`ai-forever/dynamic_gestures` at the pinned commit instead, which is where the
two `.onnx` files actually live.

The venv lands in `~/.venvs/backpack-gesture`. Under WSL2 keep it off `/mnt/c` —
pip on a 9p mount is slow enough to look hung.

### The dependency conflict this resolves

Three pins in the gesture-control checkout cannot all hold at once:

| Source | Pin | Problem |
| --- | --- | --- |
| `requirements.txt` | `numpy==2.2.6` | `filterpy` 1.4.5 uses numpy APIs deleted in 2.x |
| `dynamic_gestures/requirements.txt` | `onnxruntime==1.13.1` | no cp310/cp311 wheels exist |
| `dynamic_gestures/requirements.txt` | `numpy==1.23.5` | too old for the rest |

`server/requirements.txt` settles on **numpy 1.26 / onnxruntime ≥1.16**. Newer
ONNX runtimes read the old opsets in `hand_detector.onnx` fine. Do not "upgrade"
numpy past 2.0 — `filterpy` breaks immediately.

You will see this on startup, from `dynamic_gestures/onnx_models.py`:

```
EP Error 'providers' and 'provider_options' should be the same length …
Falling back to ['CPUExecutionProvider'] and retrying.
```

Harmless. That file was written against the onnxruntime 1.13 provider API; the
fallback path is the one you want anyway.

---

## Running

```bash
./start.sh                            # test mode, browser camera
./start.sh --live                     # real aircraft
```

One process serves both the built web UI and the API. Open
**http://localhost:8000** → Simulator → Drone Control.

For frontend work, `npm run dev` gives you HMR on :3000 and proxies `/api` to
:8000 — run `./start.sh` alongside it.

> Browsers only hand out the camera on a secure origin. `http://localhost` counts;
> `http://192.168.x.x` does not. To drive it from another machine, serve the built
> `dist/` over https, or tunnel the port.

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `RUN_MODE` | `test` | `test` never touches hardware; `live` connects and flies |
| `CAMERA_SOURCE` | `browser` | or `server` — backend opens `/dev/videoN` |
| `GESTURE_ROOT` | auto-detected | path to the `high_school_io_2025` checkout |
| `ACTIONS_PATH` | `$GESTURE_ROOT/actions.json` | the gesture → command map |
| `DETECTOR` | `dynamic_gestures` | or `yolo` (also needs `pip install ultralytics`) |
| `REQUIRE_ARM` | `true` | refuse gesture commands until armed from the UI |
| `COOLDOWN_SECONDS` | `2.0` | global cooldown, as in `main.py` |
| `DRONE_CONNECTION` | `1` | `0` = drone wifi (192.168.42.1), `1` = SkyController (192.168.53.1) |

---

## Safety model

A web page can now move a real aircraft, so `live` is gated:

1. **`RUN_MODE=test` is the default.** Gestures are recognised and the full
   command is resolved and logged, but nothing reaches the drone.
2. **Connected ≠ armed.** With `REQUIRE_ARM=true`, gesture commands are refused
   until the operator arms from the UI and confirms a dialog. A stray hand in
   frame while someone sets up the page cannot fly anything.
3. **Emergency** cancels the move in flight, lands, and disarms. It deliberately
   does *not* call olympe's `Emergency()`, which cuts the motors and drops the
   aircraft.
4. Frames that arrive mid-inference are **dropped, not queued** — a backlog
   would make the drone act on gestures made seconds ago.

---

## Camera modes

**`browser` (default).** The page captures with `getUserMedia`, mirrors each
frame onto a canvas, and uploads JPEG at ~12 fps. Works anywhere — including
WSL2, where `/dev/video*` does not exist without `usbipd-win`.

**`server`.** The backend opens the V4L2 device and serves an annotated MJPEG
stream at `/api/video_feed`, reproducing `main.py`'s overlay. This is the mode
for a headless Linux box wired to both the camera and the drone.

For `server` mode under WSL2 you must attach the webcam from an admin PowerShell
on Windows first:

```powershell
usbipd list
usbipd bind --busid <BUSID>
usbipd attach --wsl --busid <BUSID>
```

…and the WSL kernel needs UVC support compiled in, which the stock kernel lacks.
On real Linux it just works.

---

## Piloting authority (SkyController links)

The single most confusing failure mode, and the reason a first flight looks like
the web UI does nothing:

> When the drone is reached **through a SkyController**, the physical sticks own
> the aircraft. olympe accepts `moveBy` from the app, returns no error, logs
> nothing — and **discards it before it reaches the device**. Takeoff/land fail
> with a bare `AssertionError`. The handset keeps working perfectly, so it looks
> like a bug in the gesture pipeline.

Authority is therefore tied to arming:

| Action | Piloting source becomes | Who flies |
| --- | --- | --- |
| **Arm** | `Controller` | this page |
| **Disarm** | `SkyController` | the handset's sticks |
| **Emergency** | `SkyController` | the handset's sticks |

`/api/status` reports `drone.piloting_source`, and the UI shows it as a banner,
so "who has the aircraft" is never something you have to guess. If the sticks
still hold it, gesture commands are **refused with a reason** rather than
reported as sent.

Connecting over the drone's own wifi (`DRONE_CONNECTION=0`) has no SkyController
in the path and skips all of this.

## Known quirk in `actions.json`

`actions.json` calls one balance group `"vertical"` but points it at
`arg_index: 1`. In olympe's `moveBy(x, y, z, angle)` the body frame is
**+x forward, +y right, +z down** — so index 1 is the *lateral* axis, not
altitude. `like` therefore flies the drone 1 m to the **right**, not up.

This was already true of the desktop script and has been left alone: changing it
changes real flight behaviour, which is the operator's call, not a refactor. The
UI shows the decoded axis for every gesture (`right 1 m (y)`) so the mismatch is
visible before anything takes off.

To make `like` actually climb, set `args` to `[0, 0, -1, 0]` and `arg_index` to
`2` (negative z is up).
