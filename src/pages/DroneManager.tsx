/**
 * DroneManager — the MVP's Control Center.
 *
 * One aircraft, one sub-unit (its onboard camera). The canvas on the right is
 * no longer a speculative site map: it renders the drone's tracked position
 * from the same engine state the Gesture Control page drives, polled from
 * /api/status. Nothing here is invented — when a value is not available yet it
 * says so rather than showing a plausible number.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Battery,
  Camera,
  Compass,
  Cpu,
  Hand,
  Plane,
  Radio,
  RefreshCw,
  Satellite,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Page } from '../App';
import { DroneUnit } from '../types';
import { StatusPayload, api } from '@/src/lib/gestureApi';

interface DroneManagerProps {
  drone: DroneUnit;
  setDrone: React.Dispatch<React.SetStateAction<DroneUnit>>;
  onNavigate: (page: Page) => void;
}

/** actions.json bounds — the sandbox axes mirror them exactly. */
const X_RANGE: [number, number] = [-2, 2]; // forward / back  (move_by arg 0)
const Y_RANGE: [number, number] = [0, 2]; //  right / left    (move_by arg 1)

export default function DroneManager({ drone, setDrone, onNavigate }: DroneManagerProps) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<'drone' | 'camera'>('drone');

  // Poll the backend for real state. This is the same endpoint the control
  // page uses, so the two views can never disagree.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await api.status();
        if (!cancelled) {
          setStatus(s);
          setReachable(true);
        }
      } catch {
        if (!cancelled) setReachable(false);
      }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const backendDrone = status?.drone ?? null;
  const balance = status?.engine?.balance ?? {};
  const posX = balance.forward_back?.position ?? 0;
  const posY = balance.vertical?.position ?? 0;

  const linkState: DroneUnit['status'] = backendDrone?.connected
    ? 'online'
    : reachable
      ? 'connecting'
      : 'offline';

  return (
    <div className="flex flex-col xl:flex-row h-[calc(100vh-64px)] overflow-hidden bg-stone-900 text-stone-100">
      {/* ── LEFT: the unit and its sub-unit ── */}
      <aside className="w-full xl:w-[420px] bg-stone-950 border-r border-stone-800 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-5 border-b border-stone-800 bg-stone-900/40">
          <span className="text-[10px] uppercase font-mono font-black tracking-widest text-emerald-400">
            Deployed Unit
          </span>
          <h2 className="text-base font-black text-white leading-tight mt-0.5">Drone Manager</h2>
        </div>

        {/* Link state */}
        <div className="p-4 border-b border-stone-800">
          <div
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold',
              linkState === 'online' && 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400',
              linkState === 'connecting' && 'bg-amber-950/40 border-amber-500/40 text-amber-400',
              linkState === 'offline' && 'bg-stone-800/60 border-stone-700 text-stone-400'
            )}
          >
            {linkState === 'online' ? <Wifi size={16} /> : linkState === 'connecting' ? <Radio size={16} className="animate-pulse" /> : <WifiOff size={16} />}
            <span>
              {linkState === 'online'
                ? 'Aircraft connected'
                : linkState === 'connecting'
                  ? 'Backend up — aircraft not connected'
                  : 'Backend unreachable'}
            </span>
          </div>
          {reachable === false && (
            <p className="mt-2 text-[10px] font-mono text-stone-500 leading-relaxed">
              Start it with <code className="text-emerald-400">./start.sh</code> (or
              <code className="text-emerald-400"> --live</code> to fly).
            </p>
          )}
        </div>

        {/* Unit tree: drone → camera */}
        <div className="p-4 border-b border-stone-800">
          <span className="text-[9px] uppercase font-mono tracking-widest text-stone-400 font-bold block mb-3">
            Unit
          </span>

          <button
            onClick={() => setSelected('drone')}
            className={cn(
              'w-full text-left p-3.5 rounded-xl border transition-all',
              selected === 'drone'
                ? 'bg-emerald-950/40 border-emerald-500/50'
                : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-stone-950 border border-stone-700 text-emerald-400">
                <Plane size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-white text-sm leading-none truncate">{drone.name}</p>
                <p className="text-[10px] font-mono text-stone-500 mt-1 truncate">
                  {drone.model} · {drone.serial}
                </p>
              </div>
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  linkState === 'online' ? 'bg-emerald-400' : 'bg-stone-600'
                )}
              />
            </div>
          </button>

          {/* Sub-unit */}
          <div className="pl-4 mt-2 border-l border-stone-800 ml-4">
            <button
              onClick={() => setSelected('camera')}
              className={cn(
                'w-full text-left p-3 rounded-xl border transition-all',
                selected === 'camera'
                  ? 'bg-sky-950/40 border-sky-500/50'
                  : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-stone-950 border border-stone-700 text-sky-400">
                  <Camera size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-stone-100 text-xs leading-none truncate">
                    {drone.camera.name}
                  </p>
                  <p className="text-[9px] font-mono text-stone-500 mt-1">
                    {backendDrone?.has_camera ? 'reachable' : 'not connected'}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Selection detail */}
        <div className="p-4 border-b border-stone-800">
          <span className="text-[9px] uppercase font-mono tracking-widest text-stone-400 font-bold block mb-3">
            {selected === 'drone' ? 'Aircraft' : 'Camera sub-unit'}
          </span>

          {selected === 'drone' ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[10px] font-mono text-stone-500">Display name</span>
                <input
                  value={drone.name}
                  onChange={e => setDrone(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <Cell label="mode" value={backendDrone?.mode ?? '—'} />
                <Cell label="flight state" value={backendDrone?.flying_state ?? '—'} />
                <Cell label="armed" value={backendDrone?.armed ? 'yes' : 'no'} />
                <Cell
                  label="piloting"
                  value={backendDrone?.piloting_source ?? (backendDrone?.via_skycontroller ? '—' : 'n/a')}
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-[10px] font-mono">
                <Satellite size={12} className="text-stone-500 shrink-0" />
                <span className="text-stone-500">GPS</span>
                <span className="ml-auto text-stone-200 truncate">
                  {backendDrone?.gps
                    ? backendDrone.gps.slice(0, 2).map(n => n.toFixed(5)).join(', ')
                    : 'no fix'}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-[10px] font-mono">
                <Battery size={12} className="text-stone-500 shrink-0" />
                <span className="text-stone-500">Battery</span>
                <span className="ml-auto text-stone-500">not polled yet</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-stone-400 leading-relaxed">
                The aircraft carries one gimbal camera. The backend can already reach it —
                stills, recording, an RTSP stream and gimbal/zoom control are all available
                through the flight library.
              </p>
              <div className="px-3 py-2.5 rounded-lg bg-amber-950/25 border border-amber-800/40 text-[10px] font-mono text-amber-300/90 leading-relaxed">
                Not wired into this interface yet. The Gesture Control page shows your
                own webcam, which is what drives recognition — this is a separate feed.
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <Cell label="unit id" value={drone.camera.id} />
                <Cell label="reachable" value={backendDrone?.has_camera ? 'yes' : 'no'} />
              </div>
            </div>
          )}
        </div>

        {/* Jump to the thing that actually flies */}
        <div className="p-4 mt-auto">
          <button
            onClick={() => onNavigate('control')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-violet-500/50 bg-violet-950/40 text-violet-300 text-sm font-black hover:bg-violet-900/60 active:scale-95 transition-all"
          >
            <Hand size={16} />
            Open Gesture Control
          </button>
        </div>
      </aside>

      {/* ── RIGHT: position sandbox ── */}
      <main className="flex-grow flex flex-col min-w-0 bg-stone-950">
        <div className="shrink-0 px-5 py-4 border-b border-stone-800 flex items-center gap-3 flex-wrap">
          <div className="p-2 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-xl">
            <Compass size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] uppercase font-mono font-black tracking-widest text-emerald-400">
              Position Sandbox
            </span>
            <h2 className="text-base font-black text-white leading-tight">Tracked Displacement</h2>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-700 bg-stone-900 text-[10px] font-mono text-stone-400">
              <RefreshCw size={11} className={reachable ? 'animate-spin [animation-duration:3s]' : ''} />
              {reachable ? 'live · 2s' : 'offline'}
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center p-6">
          <Sandbox x={posX} y={posY} active={!!status?.engine} />
        </div>

        <div className="shrink-0 border-t border-stone-800 p-5">
          <div className="grid sm:grid-cols-3 gap-3">
            <Readout
              label="forward / back"
              value={posX}
              range={X_RANGE}
              note="move_by arg 0 (x)"
              tone="emerald"
            />
            <Readout
              label="right / left"
              value={posY}
              range={Y_RANGE}
              note="move_by arg 1 (y)"
              tone="sky"
            />
            <div className="p-3.5 rounded-2xl border border-stone-800 bg-stone-900/60">
              <p className="text-[9px] uppercase font-mono tracking-widest text-stone-500 font-bold">
                What this shows
              </p>
              <p className="text-[10px] text-stone-400 mt-1.5 leading-relaxed">
                Displacement the flight engine has tracked from the gesture commands it
                sent — not a GPS position. Bounds come straight from actions.json.
              </p>
            </div>
          </div>

          <p className="mt-3 text-[10px] font-mono text-stone-600 leading-relaxed">
            Note: actions.json labels the second axis <span className="text-stone-400">vertical</span>,
            but arg 1 of move_by is the lateral axis in the aircraft's frame — so it moves
            right/left, not up/down. Shown here as it actually behaves.
          </p>
        </div>
      </main>
    </div>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-stone-900 border border-stone-800">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-200 font-bold truncate ml-2">{value}</span>
    </div>
  );
}

function Readout({
  label,
  value,
  range,
  note,
  tone,
}: {
  label: string;
  value: number;
  range: [number, number];
  note: string;
  tone: 'emerald' | 'sky';
}) {
  const [min, max] = range;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="p-3.5 rounded-2xl border border-stone-800 bg-stone-900/60">
      <div className="flex justify-between items-baseline">
        <p className="text-[9px] uppercase font-mono tracking-widest text-stone-500 font-bold">
          {label}
        </p>
        <span className="font-mono font-black text-white text-sm">
          {value > 0 ? `+${value}` : value}
          <span className="text-stone-600 text-[10px] font-bold"> m</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 bg-stone-800 rounded-full relative overflow-hidden">
        <motion.div
          className={cn(
            'absolute top-0 bottom-0 w-1.5 rounded-full',
            tone === 'emerald' ? 'bg-emerald-400' : 'bg-sky-400'
          )}
          animate={{ left: `calc(${Math.max(0, Math.min(100, pct))}% - 3px)` }}
          transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        />
      </div>
      <p className="mt-1.5 text-[9px] font-mono text-stone-600">
        {note} · [{min}, {max}]
      </p>
    </div>
  );
}

/** Top-down view. x is forward/back, y is right/left — the aircraft's own frame. */
function Sandbox({ x, y, active }: { x: number; y: number; active: boolean }) {
  const SIZE = 400;
  const PAD = 46;
  const span = SIZE - PAD * 2;

  // Screen: forward (+x) is up, right (+y) is right.
  const toPx = (v: number, [min, max]: [number, number]) =>
    PAD + ((v - min) / (max - min)) * span;
  const cx = toPx(y, Y_RANGE);
  const cy = SIZE - toPx(x, X_RANGE);
  const originX = toPx(0, Y_RANGE);
  const originY = SIZE - toPx(0, X_RANGE);

  return (
    <div className="relative w-full h-full max-h-full max-w-full aspect-square flex items-center justify-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full max-h-full">
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#292524" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={SIZE} height={SIZE} fill="#0c0a09" rx="16" />
        <rect width={SIZE} height={SIZE} fill="url(#grid)" rx="16" />

        {/* Bounds allowed by actions.json */}
        <rect
          x={toPx(Y_RANGE[0], Y_RANGE)}
          y={SIZE - toPx(X_RANGE[1], X_RANGE)}
          width={span}
          height={span}
          fill="none"
          stroke="#44403c"
          strokeDasharray="4 4"
          rx="6"
        />

        {/* Origin — where the aircraft started */}
        <line x1={PAD} y1={originY} x2={SIZE - PAD} y2={originY} stroke="#44403c" strokeWidth="1" />
        <line x1={originX} y1={PAD} x2={originX} y2={SIZE - PAD} stroke="#44403c" strokeWidth="1" />
        <circle cx={originX} cy={originY} r="4" fill="#57534e" />
        <text x={originX + 8} y={originY - 8} fill="#57534e" fontSize="10" fontFamily="monospace">
          start
        </text>

        {/* Travel from origin to current position */}
        <line
          x1={originX}
          y1={originY}
          x2={cx}
          y2={cy}
          stroke={active ? '#10b981' : '#44403c'}
          strokeWidth="2"
          strokeDasharray="3 3"
        />

        {/* The aircraft */}
        <circle cx={cx} cy={cy} r="15" fill={active ? '#10b98122' : '#44403c22'} />
        <circle
          cx={cx}
          cy={cy}
          r="7"
          fill={active ? '#10b981' : '#57534e'}
          stroke="#0c0a09"
          strokeWidth="2"
        />

        {/* Axis labels in the aircraft's own frame */}
        <text x={SIZE / 2} y={22} fill="#57534e" fontSize="10" fontFamily="monospace" textAnchor="middle">
          forward +x
        </text>
        <text x={SIZE / 2} y={SIZE - 10} fill="#57534e" fontSize="10" fontFamily="monospace" textAnchor="middle">
          back −x
        </text>
        <text x={SIZE - 8} y={SIZE / 2} fill="#57534e" fontSize="10" fontFamily="monospace" textAnchor="end">
          right +y
        </text>
        <text x={8} y={SIZE / 2} fill="#57534e" fontSize="10" fontFamily="monospace">
          left −y
        </text>
      </svg>

      {!active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <AlertTriangle size={22} className="text-stone-600" />
          <p className="text-[11px] font-mono text-stone-500">
            No session — start one from Gesture Control
          </p>
        </div>
      )}
    </div>
  );
}
