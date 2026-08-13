/**
 * DroneControlPanel — real gesture detection via gesture_worker subprocess.
 *
 * Flow:
 *   1. User clicks "Start Camera" → POST /api/start
 *   2. Backend spawns .venv Python subprocess (opens camera + ONNX)
 *   3. Worker prints JSON lines → backend broadcasts via WS /api/ws
 *   4. Frames appear here in real time
 *   5. "Stop" → POST /api/stop, subprocess killed, camera released
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio,
  Wifi,
  WifiOff,
  AlertTriangle,
  Hand,
  Plane,
  Play,
  Square,
  Loader2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GestureFrame {
  label: string;
  command: string;
  emoji: string;
  confidence: number;
  fake?: boolean;
  ping?: boolean;
  status?: string;
  message?: string;
}

type ConnState    = 'connecting' | 'open' | 'closed' | 'error';
type DetectorState = 'off' | 'starting' | 'active' | 'stopping' | 'error';

// ---------------------------------------------------------------------------
// Gesture catalogue — mirrors gesture_worker.py GESTURE_MAP
// ---------------------------------------------------------------------------
const GESTURE_MAP: Array<{ label: string; emoji: string; command: string; description: string }> = [
  { label: 'palm',    emoji: '🖐️', command: 'takeoff',     description: 'Open palm facing camera' },
  { label: 'stop',    emoji: '✋', command: 'hover',       description: 'Stop hand' },
  { label: 'like',    emoji: '👍', command: 'ascend',      description: 'Thumbs up' },
  { label: 'dislike', emoji: '👎', command: 'descend',     description: 'Thumbs down' },
  { label: 'one',     emoji: '☝️', command: 'yaw_left',    description: 'One finger up' },
  { label: 'two_up',  emoji: '✌️', command: 'yaw_right',   description: 'Two fingers up' },
  { label: 'peace',   emoji: '✌️', command: 'forward',     description: 'Peace / V sign' },
  { label: 'fist',    emoji: '✊', command: 'backward',    description: 'Closed fist' },
  { label: 'ok',      emoji: '👌', command: 'land',        description: 'OK sign' },
  { label: 'call',    emoji: '🤙', command: 'return_home', description: 'Call me sign' },
  { label: 'rock',    emoji: '🤟', command: 'emergency',   description: 'Rock on' },
  { label: 'mute',    emoji: '🤫', command: 'hover',       description: 'Shush / mute' },
];

const COMMAND_COLOR: Record<string, string> = {
  takeoff:     'text-emerald-400 border-emerald-500/40 bg-emerald-950/40',
  hover:       'text-amber-400  border-amber-500/40  bg-amber-950/40',
  ascend:      'text-sky-400    border-sky-500/40    bg-sky-950/40',
  descend:     'text-violet-400 border-violet-500/40 bg-violet-950/40',
  yaw_left:    'text-rose-400   border-rose-500/40   bg-rose-950/40',
  yaw_right:   'text-orange-400 border-orange-500/40 bg-orange-950/40',
  forward:     'text-teal-400   border-teal-500/40   bg-teal-950/40',
  backward:    'text-pink-400   border-pink-500/40   bg-pink-950/40',
  land:        'text-teal-400   border-teal-500/40   bg-teal-950/40',
  return_home: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/40',
  emergency:   'text-red-400    border-red-500/40    bg-red-950/40',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DroneControlPanel() {
  const [connState,     setConnState]     = useState<ConnState>('connecting');
  const [detectorState, setDetectorState] = useState<DetectorState>('off');
  const [frame,         setFrame]         = useState<GestureFrame | null>(null);
  const [history,       setHistory]       = useState<GestureFrame[]>([]);
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const wsUrl = `ws://${location.host}/api/ws`;

  // ── WebSocket lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    let ws: WebSocket;
    let cancelled = false;

    function connect() {
      setConnState('connecting');
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => { if (!cancelled) setConnState('open'); };

      ws.onmessage = (evt) => {
        if (cancelled) return;
        try {
          const data: GestureFrame = JSON.parse(evt.data);

          // Handle control messages (no label = not a gesture frame)
          if (data.status) {
            if (data.status === 'detector_ready')   setDetectorState('active');
            if (data.status === 'detector_starting') setDetectorState('starting');
            if (data.status === 'detector_stopped')  setDetectorState('off');
            if (data.status === 'detector_error') {
              setDetectorState('error');
              setErrorMsg(data.message ?? 'Unknown error');
            }
            return;
          }
          if (data.ping) return;

          // Gesture frame
          if (data.label) {
            setFrame(data);
            setHistory(prev => [data, ...prev].slice(0, 10));
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => { if (!cancelled) setConnState('error'); };

      ws.onclose = () => {
        if (!cancelled) {
          setConnState('closed');
          setTimeout(() => { if (!cancelled) connect(); }, 2000);
        }
      };
    }

    connect();
    return () => {
      cancelled = true;
      ws?.close();
    };
  }, [wsUrl]);

  // ── Start / Stop handlers ────────────────────────────────────────────────
  async function handleStart() {
    setErrorMsg(null);
    setDetectorState('starting');
    try {
      const res = await fetch('/api/start', { method: 'POST' });
      const body = await res.json();
      if (!res.ok || body.status === 'error') {
        setDetectorState('error');
        setErrorMsg(body.message ?? `HTTP ${res.status}`);
      }
      // State transitions handled via WS messages from server
    } catch (e) {
      setDetectorState('error');
      setErrorMsg(String(e));
    }
  }

  async function handleStop() {
    setDetectorState('stopping');
    try {
      await fetch('/api/stop', { method: 'POST' });
    } catch { /* ignore */ }
  }

  const currentEntry = frame
    ? GESTURE_MAP.find(g => g.label === frame.label) ?? null
    : null;

  const isRunning  = detectorState === 'active';
  const isStarting = detectorState === 'starting' || detectorState === 'stopping';

  return (
    <div className="flex flex-col xl:flex-row h-[calc(100vh-64px)] overflow-hidden bg-stone-900 text-stone-100">

      {/* ── LEFT PANEL ── */}
      <aside className="w-full xl:w-[400px] bg-stone-950 border-r border-stone-800 flex flex-col shrink-0">

        {/* Header */}
        <div className="p-5 border-b border-stone-800 bg-stone-900/40">
          <span className="text-[10px] uppercase font-mono font-black tracking-widest text-violet-400">
            Gesture Control
          </span>
          <h2 className="text-base font-black text-white leading-tight mt-0.5">Drone Control</h2>
        </div>

        {/* Connection status */}
        <div className="p-4 border-b border-stone-800">
          <div className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold',
            connState === 'open'       && 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400',
            connState === 'connecting' && 'bg-amber-950/40  border-amber-500/40  text-amber-400',
            connState === 'closed'     && 'bg-stone-800/60  border-stone-700      text-stone-400',
            connState === 'error'      && 'bg-rose-950/40   border-rose-500/40    text-rose-400',
          )}>
            {connState === 'open'       && <Wifi size={16} />}
            {connState === 'connecting' && <Radio size={16} className="animate-pulse" />}
            {connState === 'closed'     && <WifiOff size={16} />}
            {connState === 'error'      && <AlertTriangle size={16} />}
            <span className="capitalize">WS {connState}</span>
          </div>
        </div>

        {/* Start / Stop */}
        <div className="p-4 border-b border-stone-800 space-y-3">
          <span className="text-[9px] uppercase font-mono tracking-widest text-stone-400 font-bold block">
            Camera Control
          </span>
          <div className="flex gap-3">
            <button
              onClick={handleStart}
              disabled={isRunning || isStarting || connState !== 'open'}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-black transition-all',
                isRunning || isStarting
                  ? 'opacity-40 cursor-not-allowed border-stone-700 text-stone-500'
                  : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/60 active:scale-95'
              )}
            >
              {isStarting && detectorState === 'starting'
                ? <Loader2 size={16} className="animate-spin" />
                : <Play size={16} />}
              Start Camera
            </button>
            <button
              onClick={handleStop}
              disabled={detectorState === 'off' || detectorState === 'stopping'}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-black transition-all',
                detectorState === 'off' || detectorState === 'stopping'
                  ? 'opacity-40 cursor-not-allowed border-stone-700 text-stone-500'
                  : 'bg-rose-950/40 border-rose-500/50 text-rose-400 hover:bg-rose-900/60 active:scale-95'
              )}
            >
              {detectorState === 'stopping'
                ? <Loader2 size={16} className="animate-spin" />
                : <Square size={16} />}
              Stop
            </button>
          </div>

          {/* Detector status pill */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-mono font-bold',
            detectorState === 'active'   && 'bg-emerald-950/40 border-emerald-600/40 text-emerald-400',
            detectorState === 'starting' && 'bg-amber-950/40  border-amber-600/40  text-amber-400',
            detectorState === 'stopping' && 'bg-amber-950/40  border-amber-600/40  text-amber-400',
            detectorState === 'off'      && 'bg-stone-900     border-stone-700      text-stone-500',
            detectorState === 'error'    && 'bg-rose-950/40   border-rose-600/40   text-rose-400',
          )}>
            {detectorState === 'active'   && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            {detectorState === 'starting' && <Loader2 size={12} className="animate-spin" />}
            {detectorState === 'stopping' && <Loader2 size={12} className="animate-spin" />}
            {detectorState === 'off'      && <span className="w-2 h-2 rounded-full bg-stone-600" />}
            {detectorState === 'error'    && <AlertTriangle size={12} />}
            <span className="capitalize">{detectorState === 'active' ? 'Camera active — detecting gestures' : detectorState}</span>
          </div>

          {errorMsg && (
            <p className="text-[10px] font-mono text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Live gesture readout */}
        <div className="p-4 border-b border-stone-800 space-y-4">
          <span className="text-[9px] uppercase font-mono tracking-widest text-stone-400 font-bold block">
            Live Recognition
          </span>
          <AnimatePresence mode="wait">
            {frame && frame.label ? (
              <motion.div
                key={frame.label + frame.confidence}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-4">
                  <span className="text-5xl select-none">{currentEntry?.emoji ?? '❓'}</span>
                  <div className="min-w-0">
                    <p className="text-lg font-black text-white leading-none">
                      {frame.label.replace(/_/g, ' ')}
                    </p>
                    <span className={cn(
                      'mt-1.5 inline-block px-2.5 py-0.5 rounded-lg border text-[11px] font-black uppercase tracking-wider font-mono',
                      COMMAND_COLOR[frame.command] ?? 'text-stone-400 border-stone-700 bg-stone-900'
                    )}>
                      → {frame.command.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono font-bold text-stone-400">
                    <span>Confidence</span>
                    <span className="text-white">{(frame.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-violet-500 rounded-full"
                      animate={{ width: `${frame.confidence * 100}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-6 text-center text-stone-500 italic text-xs"
              >
                {detectorState === 'off'      && 'Press Start Camera to begin'}
                {detectorState === 'starting' && 'Opening camera and loading model…'}
                {detectorState === 'active'   && 'Show a gesture to the camera'}
                {detectorState === 'stopping' && 'Stopping…'}
                {detectorState === 'error'    && 'Detector error — see above'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* History */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-stone-800">
            <span className="text-[9px] uppercase font-mono tracking-widest text-stone-400 font-bold">
              Recent Gestures
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
            <AnimatePresence initial={false}>
              {history.map((h, i) => (
                <motion.div
                  key={`${h.label}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2.5 p-2.5 bg-stone-900 rounded-lg border border-stone-800"
                >
                  <span className="text-lg leading-none">
                    {GESTURE_MAP.find(g => g.label === h.label)?.emoji ?? '❓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="block text-stone-200 font-bold truncate">{h.label}</span>
                    <span className="text-stone-500 text-[9px]">{h.command}</span>
                  </div>
                  <span className="text-[10px] text-violet-400 font-bold shrink-0">
                    {(h.confidence * 100).toFixed(0)}%
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* ── RIGHT PANEL: gesture reference grid ── */}
      <main className="flex-grow overflow-y-auto p-6 md:p-8 bg-stone-950">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-950 border border-violet-800 text-violet-400 rounded-xl">
              <Hand size={20} />
            </div>
            <div>
              <span className="text-[9px] uppercase font-mono font-black tracking-widest text-violet-400">
                Gesture Reference
              </span>
              <h2 className="text-lg font-black text-white leading-tight mt-0.5">
                Gesture → Drone Command Map
              </h2>
            </div>
            <div className="ml-auto flex items-center gap-2 text-[9px] font-mono text-stone-500 bg-stone-900 border border-stone-800 px-3 py-2 rounded-lg">
              <Plane size={12} className="text-violet-400" />
              No hardware — display only
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {GESTURE_MAP.map((g) => {
              const isActive = frame?.label === g.label && isRunning;
              return (
                <motion.div
                  key={g.label}
                  animate={isActive ? { scale: 1.04 } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className={cn(
                    'p-4 rounded-2xl border transition-colors',
                    isActive
                      ? cn('ring-2 ring-violet-500', COMMAND_COLOR[g.command])
                      : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl leading-none select-none">{g.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-white text-sm leading-none">
                        {g.label.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-1 leading-relaxed">
                        {g.description}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    'mt-3 px-2.5 py-1 rounded-lg border inline-block text-[10px] font-black uppercase tracking-wider font-mono',
                    COMMAND_COLOR[g.command] ?? 'text-stone-400 border-stone-700 bg-stone-900'
                  )}>
                    {g.command.replace(/_/g, ' ')}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="p-4 bg-stone-900/60 border border-stone-800 rounded-2xl text-xs text-stone-400 leading-relaxed">
            <strong className="text-stone-300">How it works:</strong> clicking <em>Start Camera</em> spawns a
            Python subprocess using the gesture-control project's <code className="text-violet-400">.venv</code>,
            which loads the ONNX hand-detection + classification models and streams detected gestures
            over WebSocket in real time. The active card highlights on each detection.
          </div>
        </div>
      </main>
    </div>
  );
}
