"""
FastAPI backend — gesture control bridge.

POST /api/start  launch gesture_worker subprocess
POST /api/stop   kill it
GET  /api/status current state
WS   /api/ws     real-time gesture stream
"""

import asyncio
import json
import subprocess
import sys
import threading
import traceback
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

_THIS_DIR      = Path(__file__).parent
_WORKER_SCRIPT = _THIS_DIR / "gesture_worker.py"
_GESTURE_ROOT  = Path(r"C:\Users\wangx\OneDrive\Desktop\backpack\Gesture control\high_school_io_2025")
_VENV_PYTHON   = _GESTURE_ROOT / ".venv" / "Scripts" / "python.exe"

app = FastAPI(title="Backpack Gesture API", version="0.3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Global state ─────────────────────────────────────────────────────────────
_ws_clients:     set[WebSocket]             = set()
_worker_proc:    Optional[subprocess.Popen] = None
_reader_thread:  Optional[threading.Thread] = None
_stderr_thread:  Optional[threading.Thread] = None
_detector_ready: bool                       = False
_stop_event:     threading.Event            = threading.Event()
_event_loop:     Optional[asyncio.AbstractEventLoop] = None


# ── WebSocket broadcaster ────────────────────────────────────────────────────
async def _broadcast(payload: dict) -> None:
    global _ws_clients
    if not _ws_clients:
        return
    msg = json.dumps(payload)
    dead: set[WebSocket] = set()
    for ws in list(_ws_clients):
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    _ws_clients -= dead


# ── Frame handler (runs on the event loop, scheduled by reader thread) ───────
async def _handle_frame(data: dict) -> None:
    global _detector_ready
    if data.get("status") == "ready":
        _detector_ready = True
        await _broadcast({"status": "detector_ready"})
    elif "error" in data:
        await _broadcast({"status": "detector_error", "message": data["error"]})
    elif data.get("_stopped"):
        await _broadcast({"status": "detector_stopped"})
    elif data.get("label"):          # gesture frame — only forward real gestures
        await _broadcast(data)
    # else: unknown payload, silently drop


# ── Stdout reader thread ──────────────────────────────────────────────────────
def _stdout_reader(proc: subprocess.Popen, loop: asyncio.AbstractEventLoop) -> None:
    """
    Reads JSON lines from worker stdout and schedules _handle_frame on the
    event loop via call_soon_threadsafe (no asyncio.Queue, no loop-binding
    issues with Python 3.9).
    """
    def dispatch(data: dict) -> None:
        loop.call_soon_threadsafe(asyncio.ensure_future, _handle_frame(data))

    try:
        for raw in proc.stdout:              # type: ignore[union-attr]
            if _stop_event.is_set():
                break
            line = raw.decode(errors="replace").strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict):
                dispatch(data)
    except Exception as e:
        dispatch({"error": str(e)})
    finally:
        dispatch({"_stopped": True})


# ── Stderr drainer thread ─────────────────────────────────────────────────────
def _stderr_drainer(proc: subprocess.Popen) -> None:
    """Drains subprocess stderr so ONNX/cv2 logs never block the pipe."""
    try:
        for line in proc.stderr:             # type: ignore[union-attr]
            if _stop_event.is_set():
                break
            decoded = line.decode(errors="replace").rstrip()
            if decoded:
                print(f"[worker] {decoded}", file=sys.stderr, flush=True)
    except Exception:
        pass


# ── Startup / shutdown ────────────────────────────────────────────────────────
@app.on_event("startup")
async def _startup():
    global _event_loop
    _event_loop = asyncio.get_running_loop()


@app.on_event("shutdown")
async def _shutdown():
    await _do_stop()


# ── REST endpoints ────────────────────────────────────────────────────────────
@app.post("/api/start")
async def start_detector():
    global _worker_proc, _reader_thread, _stderr_thread, _detector_ready

    if _worker_proc is not None and _worker_proc.poll() is None:
        return JSONResponse({"status": "already_running"})

    if not _VENV_PYTHON.exists():
        return JSONResponse(
            {"status": "error", "message": f".venv Python not found at {_VENV_PYTHON}"},
            status_code=500,
        )

    _detector_ready = False
    _stop_event.clear()

    try:
        _worker_proc = subprocess.Popen(
            [str(_VENV_PYTHON), str(_WORKER_SCRIPT), str(_GESTURE_ROOT)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr, flush=True)
        return JSONResponse({"status": "error", "message": f"{type(e).__name__}: {e}"}, status_code=500)

    loop = asyncio.get_running_loop()

    _reader_thread = threading.Thread(
        target=_stdout_reader, args=(_worker_proc, loop), daemon=True
    )
    _reader_thread.start()

    _stderr_thread = threading.Thread(
        target=_stderr_drainer, args=(_worker_proc,), daemon=True
    )
    _stderr_thread.start()

    await _broadcast({"status": "detector_starting"})
    return JSONResponse({"status": "starting", "pid": _worker_proc.pid})


async def _do_stop() -> None:
    global _worker_proc, _reader_thread, _stderr_thread, _detector_ready
    _stop_event.set()
    if _worker_proc is not None:
        try:
            _worker_proc.terminate()
            _worker_proc.wait(timeout=3)
        except Exception:
            try:
                _worker_proc.kill()
            except Exception:
                pass
    _worker_proc    = None
    _reader_thread  = None
    _stderr_thread  = None
    _detector_ready = False


@app.post("/api/stop")
async def stop_detector():
    if _worker_proc is None or _worker_proc.poll() is not None:
        return JSONResponse({"status": "not_running"})
    await _do_stop()
    await _broadcast({"status": "detector_stopped"})
    return JSONResponse({"status": "stopped"})


@app.get("/api/status")
async def get_status():
    running = _worker_proc is not None and _worker_proc.poll() is None
    return JSONResponse({
        "running": running,
        "ready":   _detector_ready,
        "clients": len(_ws_clients),
        "pid":     _worker_proc.pid if running else None,
    })


# ── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/api/ws")
async def gesture_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    _ws_clients.add(websocket)
    running = _worker_proc is not None and _worker_proc.poll() is None
    if running and _detector_ready:
        await websocket.send_text(json.dumps({"status": "detector_ready"}))
    elif running:
        await websocket.send_text(json.dumps({"status": "detector_starting"}))
    else:
        await websocket.send_text(json.dumps({"status": "detector_stopped"}))
    try:
        while True:
            await asyncio.sleep(10)
            await websocket.send_text(json.dumps({"ping": True}))
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        _ws_clients.discard(websocket)


# ── Static files (production build) ──────────────────────────────────────────
_dist_dir = _THIS_DIR.parent / "dist"
if _dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(_dist_dir), html=True), name="static")
