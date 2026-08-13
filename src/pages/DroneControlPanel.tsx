/**
 * DroneControlPanel — in-page camera, real gesture recognition, real flight.
 *
 * Flow (CAMERA_SOURCE=browser, the default):
 *   1. "Start" → POST /api/start loads the ONNX models and resets counters
 *   2. getUserMedia opens the webcam straight into the <video> on this page
 *   3. each frame is mirrored onto an offscreen canvas, JPEG-encoded and sent
 *      over WS /api/ws/frames — the backend runs the same detector the desktop
 *      main.py uses, and drives the drone through actions.json
 *   4. detections come back on the same socket and are drawn on the overlay
 *
 * With CAMERA_SOURCE=server the backend owns /dev/videoN instead and this page
 * shows its annotated MJPEG stream; everything else is identical.
 *
 * The gesture → command map is never hard-coded here.  It is fetched from
 * /api/actions so this page and high_school_io_2025/actions.json cannot drift.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Ban,
  CircleDot,
  Hand,
  Loader2,
  Lock,
  LockOpen,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Play,
  Radio,
  Home as HomeIcon,
  Square,
  Wifi,
  WifiOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  ActionEntry,
  BackendConfig,
  Detection,
  DroneStatus,
  EngineState,
  Execution,
  StatusPayload,
  api,
  describeCommand,
  presentation,
  wsUrl,
} from '@/src/lib/gestureApi';

const CAPTURE_FPS = 12;
const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;
const JPEG_QUALITY = 0.6;

type ConnState = 'connecting' | 'open' | 'closed' | 'error';

export default function DroneControlPanel() {
  const [connState, setConnState] = useState<ConnState>('connecting');
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [frameSize, setFrameSize] = useState<[number, number]>([CAPTURE_WIDTH, CAPTURE_HEIGHT]);
  const [engine, setEngine] = useState<EngineState | null>(null);
  const [log, setLog] = useState<Execution[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const uploadCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameSocketRef = useRef<WebSocket | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const inFlightSinceRef = useRef(0);

  const drone: DroneStatus | null = status?.drone ?? null;
  const sessionReady = status?.session === 'ready';
  const isLive = config?.run_mode === 'live';
  const serverCamera = config?.camera_source === 'server';

  // ── Event socket ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let retry: number | undefined;

    const connect = () => {
      setConnState('connecting');
      socket = new WebSocket(wsUrl('/api/ws'));

      socket.onopen = () => !cancelled && setConnState('open');
      socket.onerror = () => !cancelled && setConnState('error');
      socket.onclose = () => {
        if (cancelled) return;
        setConnState('closed');
        retry = window.setTimeout(connect, 2000);
      };

      socket.onmessage = evt => {
        if (cancelled) return;
        let data: any;
        try {
          data = JSON.parse(evt.data);
        } catch {
          return;
        }

        switch (data.type) {
          case 'hello':
            setConfig(data.config);
            setStatus(data);
            break;
          case 'status':
            setStatus(data);
            if (data.engine) setEngine(data.engine);
            break;
          case 'session':
            if (data.state === 'error') setErrorMsg(data.message ?? 'Detector failed to start');
            if (data.state === 'ready') setErrorMsg(null);
            setStatus(prev => (prev ? { ...prev, session: data.state } : prev));
            break;
          case 'executions':
            setEngine(data.state);
            setLog(prev => [...data.executions, ...prev].slice(0, 40));
            setStatus(prev => (prev ? { ...prev, drone: data.drone } : prev));
            break;
          case 'drone':
            setStatus(prev =>
              prev
                ? {
                    ...prev,
                    drone: {
                      mode: data.mode,
                      connected: data.connected,
                      armed: data.armed,
                      require_arm: data.require_arm,
                      flying: data.flying,
                      last_error: data.last_error,
                      last_command: data.last_command,
                    },
                  }
                : prev
            );
            if (!data.ok && data.message) setErrorMsg(data.message);
            break;
          case 'frame':
            // Server-camera mode: detections arrive here rather than on the
            // frame socket, because this page never uploads anything.
            setDetections(data.detections);
            setEngine(data.state);
            setFrameSize(data.frame_size);
            if (data.executions?.length) setLog(prev => [...data.executions, ...prev].slice(0, 40));
            break;
          case 'error':
            setErrorMsg(data.message);
            break;
          default:
            break;
        }
      };
    };

    connect();
    api.config().then(setConfig).catch(() => undefined);
    api.actions().then(r => setActions(r.actions)).catch(() => undefined);

    return () => {
      cancelled = true;
      if (retry) window.clearTimeout(retry);
      socket?.close();
    };
  }, []);

  // ── Overlay drawing ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const [fw, fh] = frameSize;
    const sx = canvas.width / fw;
    const sy = canvas.height / fh;

    for (const det of detections) {
      const [x1, y1, x2, y2] = det.bbox;
      const x = x1 * sx;
      const y = y1 * sy;
      const w = (x2 - x1) * sx;
      const h = (y2 - y1) * sy;

      // Green for a gesture actions.json actually maps, grey for anything else.
      ctx.strokeStyle = det.configured ? '#22c55e' : '#78716c';
      ctx.lineWidth = det.configured ? 3 : 1.5;
      ctx.strokeRect(x, y, w, h);

      if (det.label) {
        ctx.font = 'bold 15px ui-monospace, monospace';
        const text = det.label;
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = det.configured ? '#22c55e' : '#78716c';
        ctx.fillRect(x, Math.max(0, y - 22), tw + 12, 22);
        ctx.fillStyle = '#0c0a09';
        ctx.fillText(text, x + 6, Math.max(15, y - 6));
      }
    }
  }, [detections, frameSize]);

  // ── Camera capture ───────────────────────────────────────────────────────
  const stopCapture = useCallback(() => {
    if (captureTimerRef.current !== null) {
      window.clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    frameSocketRef.current?.close();
    frameSocketRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    inFlightRef.current = false;
    setCapturing(false);
    setDetections([]);
  }, []);

  const startCapture = useCallback(async () => {
    setCameraError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: CAPTURE_WIDTH }, height: { ideal: CAPTURE_HEIGHT } },
        audio: false,
      });
    } catch (err: any) {
      setCameraError(
        `${err?.name ?? 'Error'}: ${err?.message ?? err}. ` +
          'Browsers only allow camera access from localhost or an https origin.'
      );
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play().catch(() => undefined);
    }

    const socket = new WebSocket(wsUrl('/api/ws/frames'));
    socket.binaryType = 'arraybuffer';
    frameSocketRef.current = socket;

    socket.onmessage = evt => {
      let data: any;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (data.type === 'frame') {
        setDetections(data.detections);
        setEngine(data.state);
        setFrameSize(data.frame_size);
        if (data.executions?.length) {
          setLog(prev => [...data.executions, ...prev].slice(0, 40));
        }
      } else if (data.type === 'error') {
        setErrorMsg(data.message);
      }
      inFlightRef.current = false;
    };
    socket.onerror = () => setCameraError('Frame socket error — is the backend running?');

    await new Promise<void>(resolve => {
      if (socket.readyState === WebSocket.OPEN) return resolve();
      socket.onopen = () => resolve();
    });

    const canvas =
      uploadCanvasRef.current ?? (uploadCanvasRef.current = document.createElement('canvas'));
    canvas.width = CAPTURE_WIDTH;
    canvas.height = CAPTURE_HEIGHT;
    const ctx = canvas.getContext('2d');

    captureTimerRef.current = window.setInterval(() => {
      const v = videoRef.current;
      const ws = frameSocketRef.current;
      if (!v || !ctx || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (v.readyState < 2) return;
      // Don't pile frames onto a backend that is still thinking about the last
      // one — a backlog would make the drone act on stale gestures.  The
      // backend stays silent about frames it drops (session not ready yet), so
      // release the latch on its own after a beat rather than stalling forever.
      if (inFlightRef.current) {
        if (Date.now() - inFlightSinceRef.current < 2000) return;
        inFlightRef.current = false;
      }

      // Mirror while encoding so the uploaded frame matches the mirrored
      // <video> the operator sees; bboxes then land in the right place.
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      canvas.toBlob(
        blob => {
          if (!blob || !frameSocketRef.current) return;
          if (frameSocketRef.current.readyState !== WebSocket.OPEN) return;
          inFlightRef.current = true;
          inFlightSinceRef.current = Date.now();
          blob.arrayBuffer().then(buf => frameSocketRef.current?.send(buf));
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    }, Math.round(1000 / CAPTURE_FPS));

    setCapturing(true);
  }, []);

  useEffect(() => stopCapture, [stopCapture]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const run = useCallback(
    async (name: string, fn: () => Promise<{ ok: boolean; message?: string | null }>) => {
      setBusy(name);
      setErrorMsg(null);
      try {
        const res = await fn();
        if (!res.ok && res.message) setErrorMsg(res.message);
        return res.ok;
      } catch (err) {
        setErrorMsg(String(err));
        return false;
      } finally {
        setBusy(null);
        api.status().then(setStatus).catch(() => undefined);
      }
    },
    []
  );

  const handleStart = async () => {
    const ok = await run('start', api.start);
    if (ok && !serverCamera) await startCapture();
    api.actions().then(r => setActions(r.actions)).catch(() => undefined);
  };

  const handleStop = async () => {
    stopCapture();
    await run('stop', api.stop);
    setLog([]);
  };

  const confirmThen = (message: string, fn: () => Promise<any>) => () => {
    if (isLive && !window.confirm(message)) return;
    fn();
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const armed = !!drone?.armed;
  const gateBlocking = isLive && drone?.require_arm && !armed;

  return (
    <div className="flex flex-col xl:flex-row h-[calc(100vh-64px)] overflow-hidden bg-stone-900 text-stone-100">
      {/* ── CAMERA ── */}
      <main className="flex-grow flex flex-col min-w-0 bg-stone-950">
        <div className="px-5 py-4 border-b border-stone-800 flex items-center gap-3 flex-wrap">
          <div className="p-2 bg-violet-950 border border-violet-800 text-violet-400 rounded-xl">
            <Hand size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] uppercase font-mono font-black tracking-widest text-violet-400">
              Gesture Control
            </span>
            <h2 className="text-base font-black text-white leading-tight">Live Drone Control</h2>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <ModeBadge live={isLive} />
            <Pill
              tone={connState === 'open' ? 'ok' : connState === 'error' ? 'bad' : 'warn'}
              icon={
                connState === 'open' ? <Wifi size={12} /> :
                connState === 'closed' ? <WifiOff size={12} /> :
                <Radio size={12} className="animate-pulse" />
              }
            >
              WS {connState}
            </Pill>
            <Pill
              tone={capturing || status?.server_camera_running ? 'ok' : 'idle'}
              icon={capturing || status?.server_camera_running ? <Video size={12} /> : <VideoOff size={12} />}
            >
              {serverCamera ? 'server camera' : capturing ? 'browser camera' : 'camera off'}
            </Pill>
          </div>
        </div>

        {/* Video surface */}
        <div className="flex-grow flex items-center justify-center p-5 min-h-0">
          <div className="relative w-full max-w-3xl aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-stone-800">
            {serverCamera ? (
              sessionReady ? (
                <img
                  src="/api/video_feed"
                  alt="Drone gesture camera"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              ) : null
            ) : (
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="absolute inset-0 w-full h-full object-contain -scale-x-100"
              />
            )}

            {!serverCamera && (
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
            )}

            {!capturing && !status?.server_camera_running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-500">
                <VideoOff size={40} />
                <p className="text-xs font-mono">
                  {status?.session === 'starting'
                    ? 'Loading detector…'
                    : 'Press Start to open the camera'}
                </p>
              </div>
            )}

            {gateBlocking && (capturing || status?.server_camera_running) && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/80 border border-amber-600/50 text-amber-300 text-[11px] font-mono font-bold backdrop-blur">
                <Lock size={12} /> DISARMED — gestures recognised, not flown
              </div>
            )}

            {engine && engine.cooldown_remaining > 0 && (
              <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-stone-900/80 border border-stone-700 text-[11px] font-mono text-stone-300 backdrop-blur">
                cooldown {engine.cooldown_remaining.toFixed(1)}s
              </div>
            )}
          </div>
        </div>

        {cameraError && (
          <p className="mx-5 mb-4 text-[11px] font-mono text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2">
            {cameraError}
          </p>
        )}

        {/* Gesture reference — driven entirely by actions.json */}
        <div className="border-t border-stone-800 p-5 overflow-y-auto max-h-[38%]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[9px] uppercase font-mono font-black tracking-widest text-violet-400">
              actions.json
            </span>
            <span className="text-[10px] font-mono text-stone-500">
              {actions.length} gestures mapped · cooldown {config?.cooldown_seconds ?? 2}s
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {actions.map(entry => {
              const active = detections.some(d => d.label === entry.label);
              const stateInfo = engine?.gestures?.[entry.label];
              const pres = presentation(entry.label);
              return (
                <motion.div
                  key={entry.label}
                  animate={active ? { scale: 1.03 } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className={cn(
                    'p-3.5 rounded-2xl border transition-colors',
                    active
                      ? 'bg-emerald-950/40 border-emerald-500/50 ring-2 ring-emerald-500/40'
                      : 'bg-stone-900/60 border-stone-800'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none select-none">{pres.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-white text-sm leading-none">
                        {entry.label.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-1">{pres.description}</p>
                    </div>
                    {stateInfo && (
                      <span className="text-[10px] font-mono font-bold text-violet-400 shrink-0">
                        {stateInfo.executed}/{stateInfo.limit_text}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 text-[10px] font-mono text-teal-300 leading-relaxed">
                    {describeCommand(entry.component, entry.action, entry.args)}
                  </p>
                  <p className="mt-1 text-[9px] font-mono text-stone-600 truncate">
                    {entry.component}.{entry.action}({entry.args.join(', ')})
                    {entry.balance ? ` · ${entry.balance.group}` : ''}
                  </p>
                </motion.div>
              );
            })}
            {actions.length === 0 && (
              <p className="text-xs text-stone-500 italic">
                No actions loaded — check that actions.json exists at the path the backend reports.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* ── CONTROLS ── */}
      <aside className="w-full xl:w-[400px] bg-stone-950 border-l border-stone-800 flex flex-col shrink-0 overflow-y-auto">
        {/* Session */}
        <Section title="Session">
          <div className="flex gap-3">
            <button
              onClick={handleStart}
              disabled={sessionReady || busy === 'start' || connState !== 'open'}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-black transition-all',
                sessionReady || busy === 'start' || connState !== 'open'
                  ? 'opacity-40 cursor-not-allowed border-stone-700 text-stone-500'
                  : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/60 active:scale-95'
              )}
            >
              {busy === 'start' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Start
            </button>
            <button
              onClick={handleStop}
              disabled={!sessionReady || busy === 'stop'}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-black transition-all',
                !sessionReady || busy === 'stop'
                  ? 'opacity-40 cursor-not-allowed border-stone-700 text-stone-500'
                  : 'bg-rose-950/40 border-rose-500/50 text-rose-400 hover:bg-rose-900/60 active:scale-95'
              )}
            >
              {busy === 'stop' ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
              Stop
            </button>
          </div>
          <div className="mt-3 text-[10px] font-mono text-stone-500 space-y-0.5">
            <p>detector: {config?.detector ?? '—'}</p>
            <p>camera: {config?.camera_source ?? '—'}</p>
            <p className="truncate" title={config?.actions_path}>actions: {config?.actions_path ?? '—'}</p>
          </div>
          {errorMsg && (
            <p className="mt-3 text-[10px] font-mono text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}
        </Section>

        {/* Drone */}
        <Section title="Drone">
          {!isLive && (
            <p className="mb-3 text-[10px] font-mono text-amber-400/90 bg-amber-950/25 border border-amber-800/40 rounded-lg px-3 py-2 leading-relaxed">
              RUN_MODE=test — gestures are recognised and the full command is
              resolved, but nothing is sent to an aircraft. Restart the backend
              with RUN_MODE=live to fly.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mb-3">
            <StateCell label="connected" ok={!!drone?.connected} />
            <StateCell label="armed" ok={armed} />
            <StateCell label="flying" ok={!!drone?.flying} />
            <StateCell label="mode" text={drone?.mode ?? '—'} />
          </div>

          {isLive && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <SmallButton
                  onClick={() => run('connect', api.droneConnect)}
                  disabled={!!drone?.connected || busy === 'connect'}
                  busy={busy === 'connect'}
                  tone="sky"
                  icon={<Plane size={13} />}
                >
                  Connect
                </SmallButton>
                <SmallButton
                  onClick={() => run('disconnect', api.droneDisconnect)}
                  disabled={!drone?.connected}
                  tone="stone"
                  icon={<Ban size={13} />}
                >
                  Disconnect
                </SmallButton>
              </div>

              <div className="flex gap-2">
                <SmallButton
                  onClick={confirmThen(
                    'Arm the drone?\n\nOnce armed, a recognised gesture will move the aircraft for real. Make sure the area is clear.',
                    () => run('arm', api.arm)
                  )}
                  disabled={!drone?.connected || armed || busy === 'arm'}
                  busy={busy === 'arm'}
                  tone="amber"
                  icon={<LockOpen size={13} />}
                >
                  Arm
                </SmallButton>
                <SmallButton
                  onClick={() => run('disarm', api.disarm)}
                  disabled={!armed}
                  tone="stone"
                  icon={<Lock size={13} />}
                >
                  Disarm
                </SmallButton>
              </div>

              <div className="flex gap-2">
                <SmallButton
                  onClick={confirmThen('Take off now?', () => run('takeoff', api.takeoff))}
                  disabled={!armed || busy === 'takeoff'}
                  busy={busy === 'takeoff'}
                  tone="emerald"
                  icon={<PlaneTakeoff size={13} />}
                >
                  Take off
                </SmallButton>
                <SmallButton
                  onClick={() => run('land', api.land)}
                  disabled={!drone?.connected || busy === 'land'}
                  busy={busy === 'land'}
                  tone="teal"
                  icon={<PlaneLanding size={13} />}
                >
                  Land
                </SmallButton>
              </div>

              <SmallButton
                onClick={confirmThen('Return to home?', () => run('rth', api.returnHome))}
                disabled={!drone?.connected || busy === 'rth'}
                busy={busy === 'rth'}
                tone="indigo"
                icon={<HomeIcon size={13} />}
                full
              >
                Return to home
              </SmallButton>
            </div>
          )}

          <button
            onClick={() => run('emergency', api.emergency)}
            className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-red-500/70 bg-red-950/60 text-red-300 text-sm font-black tracking-wide hover:bg-red-900/70 active:scale-95 transition-all"
          >
            <AlertTriangle size={16} />
            EMERGENCY — CANCEL &amp; LAND
          </button>
          <p className="mt-1.5 text-[9px] font-mono text-stone-600 leading-relaxed">
            Cancels the move in flight, lands, and disarms. Does not cut the
            motors — the aircraft descends under control rather than falling.
          </p>
        </Section>

        {/* Travel budgets */}
        {engine && Object.keys(engine.balance).length > 0 && (
          <Section title="Travel budget">
            <p className="text-[9px] font-mono text-stone-500 mb-3 leading-relaxed">
              actions.json bounds how far each axis may travel. A gesture is
              recognised but refused once its direction is exhausted.
            </p>
            {engine.balance.vertical && (
              <AxisMeter
                name="vertical (arg y)"
                position={engine.balance.vertical.position}
                min={0}
                max={2}
                left={[
                  ['like ↑', engine.balance.vertical.up_left ?? 0],
                  ['dislike ↓', engine.balance.vertical.down_left ?? 0],
                ]}
              />
            )}
            {engine.balance.forward_back && (
              <AxisMeter
                name="forward_back (arg x)"
                position={engine.balance.forward_back.position}
                min={-2}
                max={2}
                left={[
                  ['peace fwd', engine.balance.forward_back.forward_left ?? 0],
                  ['fist back', engine.balance.forward_back.backward_left ?? 0],
                ]}
              />
            )}
          </Section>
        )}

        {/* Execution log */}
        <div className="flex-1 flex flex-col min-h-[220px]">
          <div className="px-5 py-3 border-b border-stone-800">
            <span className="text-[9px] uppercase font-mono tracking-widest text-stone-400 font-bold">
              Command log
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
            <AnimatePresence initial={false}>
              {log.map((entry, i) => (
                <motion.div
                  key={`${entry.label}-${entry.at ?? i}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    'p-2.5 rounded-lg border',
                    entry.executed
                      ? 'bg-emerald-950/25 border-emerald-800/50'
                      : 'bg-stone-900 border-stone-800'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{presentation(entry.label).emoji}</span>
                    <span className="font-bold text-stone-200">{entry.label}</span>
                    <span
                      className={cn(
                        'ml-auto text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded',
                        entry.executed
                          ? 'text-emerald-300 bg-emerald-950/60'
                          : 'text-amber-300 bg-amber-950/50'
                      )}
                    >
                      {entry.executed ? 'sent' : 'refused'}
                    </span>
                  </div>
                  {entry.executed && entry.component && entry.action && entry.args ? (
                    <p className="mt-1 text-[10px] text-teal-300">
                      {describeCommand(entry.component, entry.action, entry.args)}
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] text-stone-500">{entry.reason ?? '—'}</p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {log.length === 0 && (
              <p className="text-stone-600 italic text-[11px]">
                Nothing sent yet. Gestures appear here the moment a command resolves.
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── Small presentational pieces ────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 border-b border-stone-800">
      <span className="text-[9px] uppercase font-mono tracking-widest text-stone-400 font-bold block mb-3">
        {title}
      </span>
      {children}
    </div>
  );
}

function ModeBadge({ live }: { live: boolean }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-black uppercase tracking-wider',
        live
          ? 'bg-red-950/50 border-red-500/60 text-red-300'
          : 'bg-stone-900 border-stone-700 text-stone-400'
      )}
    >
      <CircleDot size={11} className={live ? 'animate-pulse' : ''} />
      {live ? 'LIVE — drone armed path' : 'TEST — no hardware'}
    </span>
  );
}

function Pill({
  children,
  tone,
  icon,
}: {
  children: React.ReactNode;
  tone: 'ok' | 'warn' | 'bad' | 'idle';
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold',
        tone === 'ok' && 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400',
        tone === 'warn' && 'bg-amber-950/40 border-amber-600/40 text-amber-400',
        tone === 'bad' && 'bg-rose-950/40 border-rose-600/40 text-rose-400',
        tone === 'idle' && 'bg-stone-900 border-stone-700 text-stone-500'
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function StateCell({ label, ok, text }: { label: string; ok?: boolean; text?: string }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-stone-900 border border-stone-800">
      <span className="text-stone-500">{label}</span>
      {text !== undefined ? (
        <span className="text-stone-200 font-bold">{text}</span>
      ) : (
        <span className={cn('font-bold', ok ? 'text-emerald-400' : 'text-stone-600')}>
          {ok ? 'yes' : 'no'}
        </span>
      )}
    </div>
  );
}

function AxisMeter({
  name,
  position,
  min,
  max,
  left,
}: {
  name: string;
  position: number;
  min: number;
  max: number;
  left: Array<[string, number]>;
}) {
  const pct = ((position - min) / (max - min)) * 100;
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-[10px] font-mono font-bold mb-1.5">
        <span className="text-stone-400">{name}</span>
        <span className="text-white">
          {position} <span className="text-stone-600">/ [{min}, {max}]</span>
        </span>
      </div>
      <div className="h-2 bg-stone-800 rounded-full relative overflow-hidden">
        <motion.div
          className="absolute top-0 bottom-0 w-1.5 bg-violet-400 rounded-full"
          animate={{ left: `calc(${Math.max(0, Math.min(100, pct))}% - 3px)` }}
          transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        />
      </div>
      <div className="flex gap-3 mt-1.5">
        {left.map(([label, value]) => (
          <span key={label} className="text-[9px] font-mono text-stone-500">
            {label}: <span className={value > 0 ? 'text-emerald-400' : 'text-rose-400'}>{value}</span> left
          </span>
        ))}
      </div>
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
  busy,
  tone,
  icon,
  full,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone: 'sky' | 'amber' | 'emerald' | 'teal' | 'indigo' | 'stone';
  icon?: React.ReactNode;
  full?: boolean;
}) {
  const tones: Record<string, string> = {
    sky: 'bg-sky-950/40 border-sky-600/50 text-sky-300 hover:bg-sky-900/60',
    amber: 'bg-amber-950/40 border-amber-600/50 text-amber-300 hover:bg-amber-900/60',
    emerald: 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/60',
    teal: 'bg-teal-950/40 border-teal-600/50 text-teal-300 hover:bg-teal-900/60',
    indigo: 'bg-indigo-950/40 border-indigo-600/50 text-indigo-300 hover:bg-indigo-900/60',
    stone: 'bg-stone-900 border-stone-700 text-stone-300 hover:bg-stone-800',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-[11px] font-black transition-all active:scale-95',
        full ? 'w-full' : 'flex-1',
        disabled ? 'opacity-35 cursor-not-allowed border-stone-800 text-stone-600 bg-stone-900' : tones[tone]
      )}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
