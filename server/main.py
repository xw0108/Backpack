"""
FastAPI backend — gesture control bridge.

One process, one detector.  The desktop script's logic lives in gesture_engine
(decisions) and drone (execution); this module only moves frames in and events
out.  Run it with the gesture-control virtualenv's Python:

    RUN_MODE=live ./server/run.sh

Frame sources
  CAMERA_SOURCE=browser  the page captures with getUserMedia and pushes JPEG
                         frames over WS /api/ws/frames.  Works on WSL2, where
                         /dev/video* does not exist.
  CAMERA_SOURCE=server   this process opens the V4L2 device and serves an
                         annotated MJPEG stream at /api/video_feed.

REST
  GET  /api/config              static config snapshot
  GET  /api/actions             actions.json rendered for the UI
  GET  /api/status              session + drone + engine state
  POST /api/start               load models, reset counters, begin a session
  POST /api/stop                end the session
  POST /api/drone/connect       connect / disconnect (live mode)
  POST /api/drone/disconnect
  POST /api/drone/arm           arm / disarm the flight-command gate
  POST /api/drone/disarm
  POST /api/drone/takeoff       primitives actions.json does not cover
  POST /api/drone/land
  POST /api/drone/rth
  POST /api/drone/emergency     cancel current move, land, disarm

WS
  /api/ws                       event stream (detections, executions, state)
  /api/ws/frames                binary JPEG upload, browser capture mode
"""

import asyncio
import json
import sys
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, Optional, Set

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

import config
from camera_source import ServerCamera
from drone import DroneController
from gesture_engine import GestureEngine

app = FastAPI(title="Backpack Gesture → Drone API", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# ── Global state ─────────────────────────────────────────────────────────────
_drone = DroneController()
_engine = GestureEngine(_drone)
_ws_clients: Set[WebSocket] = set()
_event_loop: Optional[asyncio.AbstractEventLoop] = None

# Inference is CPU-bound and stateful (the tracker needs ordered frames), so it
# runs on exactly one thread and never concurrently with itself.
_inference_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="inference")
_load_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="modelload")
# The panic button gets its own thread so it can never sit in _load_pool's queue
# behind a takeoff or a landing that is still running.
_emergency_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="emergency")

_session_state: str = "stopped"  # stopped | starting | ready | error
_session_error: Optional[str] = None
_server_camera: Optional[ServerCamera] = None


# ── Broadcasting ─────────────────────────────────────────────────────────────
async def _broadcast(payload: Dict[str, Any]) -> None:
    if not _ws_clients:
        return
    message = json.dumps(payload)
    dead: Set[WebSocket] = set()
    for ws in list(_ws_clients):
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)
    _ws_clients.difference_update(dead)


def _broadcast_threadsafe(payload: Dict[str, Any]) -> None:
    """Publish from a worker thread (ServerCamera) onto the event loop."""
    loop = _event_loop
    if loop is None:
        return
    loop.call_soon_threadsafe(asyncio.ensure_future, _broadcast(payload))


def _status_payload() -> Dict[str, Any]:
    return {
        "session": _session_state,
        "session_error": _session_error,
        "ready": _engine.ready,
        "clients": len(_ws_clients),
        "camera_source": config.CAMERA_SOURCE,
        "server_camera_running": bool(_server_camera and _server_camera.running),
        "drone": _drone.status(),
        "engine": _engine.state() if _engine.ready else None,
    }


async def _broadcast_status() -> None:
    await _broadcast({"type": "status", **_status_payload()})


# ── Lifecycle ────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def _startup() -> None:
    global _event_loop
    _event_loop = asyncio.get_running_loop()
    print("── Backpack gesture bridge ──", file=sys.stderr)
    for key, value in config.describe().items():
        print(f"  {key:18} {value}", file=sys.stderr)
    if config.RUN_MODE == "live":
        # Don't await this.  olympe spends ~16s failing to discover an absent
        # aircraft, and blocking startup on that means the port is not even
        # bound yet — the web UI is unreachable exactly when the operator wants
        # it to tell them what went wrong.  Connect in the background and let
        # the page's Connect button retry.
        asyncio.create_task(_connect_drone_background())


async def _connect_drone_background() -> None:
    print("  RUN_MODE=live — connecting to drone in background…", file=sys.stderr)
    loop = asyncio.get_running_loop()
    ok, err = await loop.run_in_executor(_load_pool, _drone.connect)
    print(f"  drone connect      {'ok' if ok else err}", file=sys.stderr)
    await _broadcast({"type": "drone", "ok": ok, "message": err, **_drone.status()})


@app.on_event("shutdown")
async def _shutdown() -> None:
    await _stop_session()
    _drone.disconnect()


# ── Session control ──────────────────────────────────────────────────────────
async def _stop_session() -> None:
    global _session_state, _server_camera
    if _server_camera is not None:
        await asyncio.get_running_loop().run_in_executor(_load_pool, _server_camera.stop)
        _server_camera = None
    _session_state = "stopped"


@app.post("/api/start")
async def start_session():
    global _session_state, _session_error, _server_camera

    if _session_state in {"starting", "ready"}:
        return JSONResponse({"status": "already_running", **_status_payload()})

    _session_state = "starting"
    _session_error = None
    await _broadcast({"type": "session", "state": "starting"})

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(_load_pool, _engine.load)
    except Exception as exc:
        traceback.print_exc()
        _session_state = "error"
        _session_error = f"{type(exc).__name__}: {exc}"
        await _broadcast({"type": "session", "state": "error", "message": _session_error})
        return JSONResponse(
            {"status": "error", "message": _session_error}, status_code=500
        )

    _engine.reset_state()

    if config.CAMERA_SOURCE == "server":
        _server_camera = ServerCamera(_engine, _broadcast_threadsafe)
        _server_camera.start()

    _session_state = "ready"
    await _broadcast({"type": "session", "state": "ready"})
    await _broadcast_status()
    return JSONResponse({"status": "ready", **_status_payload()})


@app.post("/api/stop")
async def stop_session():
    if _session_state == "stopped":
        return JSONResponse({"status": "not_running", **_status_payload()})
    await _stop_session()
    await _broadcast({"type": "session", "state": "stopped"})
    await _broadcast_status()
    return JSONResponse({"status": "stopped", **_status_payload()})


# ── Introspection ────────────────────────────────────────────────────────────
@app.get("/api/config")
async def get_config():
    return JSONResponse(config.describe())


@app.get("/api/actions")
async def get_actions():
    return JSONResponse(
        {
            "actions": _engine.catalogue(),
            "cooldown_seconds": _engine.cooldown_seconds,
            "source": str(config.ACTIONS_PATH),
        }
    )


@app.get("/api/status")
async def get_status():
    return JSONResponse(_status_payload())


# ── Drone control ────────────────────────────────────────────────────────────
async def _drone_call(fn, *args, pool: Optional[ThreadPoolExecutor] = None):
    """Run a blocking olympe call off the event loop and report the result."""
    loop = asyncio.get_running_loop()
    ok, err = await loop.run_in_executor(pool or _load_pool, fn, *args)
    await _broadcast({"type": "drone", "ok": ok, "message": err, **_drone.status()})
    status = 200 if ok else 409
    return JSONResponse({"ok": ok, "message": err, "drone": _drone.status()}, status_code=status)


@app.post("/api/drone/connect")
async def drone_connect():
    return await _drone_call(_drone.connect)


@app.post("/api/drone/disconnect")
async def drone_disconnect():
    await asyncio.get_running_loop().run_in_executor(_load_pool, _drone.disconnect)
    await _broadcast({"type": "drone", "ok": True, "message": None, **_drone.status()})
    return JSONResponse({"ok": True, "drone": _drone.status()})


@app.post("/api/drone/arm")
async def drone_arm():
    return await _drone_call(_drone.arm)


@app.post("/api/drone/disarm")
async def drone_disarm():
    _drone.disarm()
    await _broadcast({"type": "drone", "ok": True, "message": None, **_drone.status()})
    return JSONResponse({"ok": True, "drone": _drone.status()})


@app.post("/api/drone/takeoff")
async def drone_takeoff():
    return await _drone_call(_drone.takeoff)


@app.post("/api/drone/land")
async def drone_land():
    return await _drone_call(_drone.land)


@app.post("/api/drone/rth")
async def drone_rth():
    return await _drone_call(_drone.return_home)


@app.post("/api/drone/emergency")
async def drone_emergency():
    return await _drone_call(_drone.emergency, pool=_emergency_pool)


# ── Event WebSocket ──────────────────────────────────────────────────────────
@app.websocket("/api/ws")
async def event_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    _ws_clients.add(websocket)
    try:
        await websocket.send_text(
            json.dumps({"type": "hello", "config": config.describe(), **_status_payload()})
        )
        while True:
            await asyncio.sleep(10)
            await websocket.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        _ws_clients.discard(websocket)


# ── Frame WebSocket (browser capture) ────────────────────────────────────────
def _decode(payload: bytes) -> Optional[np.ndarray]:
    buffer = np.frombuffer(payload, dtype=np.uint8)
    return cv2.imdecode(buffer, cv2.IMREAD_COLOR)


@app.websocket("/api/ws/frames")
async def frame_socket(websocket: WebSocket) -> None:
    """
    Binary JPEG frames in, detection events out on the same socket.

    Frames that arrive while the previous one is still being processed are
    dropped rather than queued: a backlog would make the drone react to gestures
    the operator made seconds ago, which is worse than a lower frame rate.
    """
    await websocket.accept()
    loop = asyncio.get_running_loop()

    # One slot, always holding the newest frame.  Receiving and inference run as
    # separate tasks so that a frame arriving mid-inference overwrites the slot
    # instead of queueing behind it.
    pending: Dict[str, Optional[bytes]] = {"frame": None}
    closed = asyncio.Event()

    async def process_latest() -> None:
        while not closed.is_set():
            payload = pending["frame"]
            if (
                payload is None
                or not _engine.ready
                or _session_state != "ready"
                or config.CAMERA_SOURCE != "browser"
            ):
                await asyncio.sleep(0.005)
                continue
            pending["frame"] = None

            frame = _decode(payload)
            if frame is None:
                continue

            try:
                result = await loop.run_in_executor(_inference_pool, _engine.feed, frame)
            except Exception as exc:
                traceback.print_exc()
                await websocket.send_text(
                    json.dumps({"type": "error", "message": f"Inference error: {exc}"})
                )
                continue

            await websocket.send_text(json.dumps({"type": "frame", **result}))
            # Executions also go to the event socket so side panels stay in sync
            # even if they are not the ones uploading frames.
            if result["executions"]:
                await _broadcast(
                    {
                        "type": "executions",
                        "executions": result["executions"],
                        "state": result["state"],
                        "drone": _drone.status(),
                    }
                )

    worker = asyncio.create_task(process_latest())
    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
            payload = message.get("bytes")
            if payload is not None:
                pending["frame"] = payload
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        closed.set()
        worker.cancel()


# ── MJPEG (server capture) ───────────────────────────────────────────────────
@app.get("/api/video_feed")
async def video_feed():
    if config.CAMERA_SOURCE != "server":
        return JSONResponse(
            {"error": "CAMERA_SOURCE is not 'server'; the browser owns the camera."},
            status_code=409,
        )

    async def stream():
        boundary = b"--frame\r\n"
        while _server_camera is not None and _server_camera.running:
            jpeg = _server_camera.latest_jpeg()
            if jpeg is not None:
                yield boundary + b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
            await asyncio.sleep(1 / 30)

    return StreamingResponse(
        stream(), media_type="multipart/x-mixed-replace; boundary=frame"
    )


# ── Static files (production build) ──────────────────────────────────────────
_dist_dir = Path(__file__).resolve().parent.parent / "dist"
if _dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(_dist_dir), html=True), name="static")
