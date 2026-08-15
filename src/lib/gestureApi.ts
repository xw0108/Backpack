/**
 * Client for the gesture → drone backend (server/main.py).
 *
 * Deliberately thin: the gesture → command map is NOT duplicated here.  It is
 * served from actions.json via /api/actions, so the web UI and the standalone
 * high_school_io_2025/main.py can never drift apart.
 */

export interface Detection {
  label: string | null;
  configured: boolean;
  bbox: [number, number, number, number];
  track_id: number | null;
}

export interface Execution {
  label: string;
  executed: boolean;
  reason?: string | null;
  count?: number;
  component?: string;
  action?: string;
  args?: number[];
  kwargs?: Record<string, unknown>;
  balance_group?: string | null;
  balance_step?: number;
  at?: number;
}

export interface BalanceAxis {
  position: number;
  up_left?: number;
  down_left?: number;
  forward_left?: number;
  backward_left?: number;
}

export interface EngineState {
  gestures: Record<
    string,
    { executed: number; limit_text: string; bounded: boolean; limit: number | null }
  >;
  balance: Record<string, BalanceAxis>;
  cooldown_seconds: number;
  cooldown_remaining: number;
}

export interface DroneStatus {
  mode: 'test' | 'live';
  connected: boolean;
  armed: boolean;
  require_arm: boolean;
  flying: boolean;
  /** 'Controller' = this app holds the aircraft, 'SkyController' = the sticks do. */
  piloting_source: string | null;
  via_skycontroller: boolean;
  /** 'landed' | 'hovering' | 'flying' | … straight from the aircraft. */
  flying_state: string | null;
  /** [lat, lon, alt] once the aircraft has a GPS fix. */
  gps: number[] | null;
  /** The onboard camera is reachable — not yet driven by any UI. */
  has_camera: boolean;
  last_error: string | null;
  last_command: {
    component: string;
    action: string;
    args: number[];
    kwargs: Record<string, unknown>;
    at: number;
  } | null;
}

export interface ActionEntry {
  label: string;
  component: string;
  action: string;
  args: number[];
  kwargs: Record<string, unknown>;
  max_executions: number | null;
  limit_text: string;
  balance: {
    group: string;
    delta: number;
    min: number;
    max: number;
    arg_index: number;
    auto_reverse?: boolean;
  } | null;
}

export interface BackendConfig {
  gesture_root: string;
  actions_path: string;
  detector: string;
  run_mode: 'test' | 'live';
  camera_source: 'browser' | 'server';
  require_arm: boolean;
  cooldown_seconds: number;
  drone_type: string;
  drone_connection: string;
}

export type ServerEvent =
  | ({ type: 'hello'; config: BackendConfig } & StatusPayload)
  | ({ type: 'status' } & StatusPayload)
  | { type: 'session'; state: 'starting' | 'ready' | 'stopped' | 'error'; message?: string }
  | { type: 'frame'; detections: Detection[]; executions: Execution[]; state: EngineState; frame_size: [number, number] }
  | { type: 'executions'; executions: Execution[]; state: EngineState; drone: DroneStatus }
  | ({ type: 'drone'; ok: boolean; message: string | null } & DroneStatus)
  | { type: 'error'; message: string }
  | { type: 'camera_ready'; source: string }
  | { type: 'camera_stopped' }
  | { type: 'ping' };

export interface StatusPayload {
  session: 'stopped' | 'starting' | 'ready' | 'error';
  session_error: string | null;
  ready: boolean;
  clients: number;
  camera_source: 'browser' | 'server';
  server_camera_running: boolean;
  drone: DroneStatus;
  engine: EngineState | null;
}

async function post(path: string): Promise<{ ok: boolean; message?: string | null; body: any }> {
  const res = await fetch(path, { method: 'POST' });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty body is fine */
  }
  return { ok: res.ok && body?.ok !== false, message: body?.message ?? body?.session_error, body };
}

export const api = {
  config: () => fetch('/api/config').then(r => r.json() as Promise<BackendConfig>),
  actions: () =>
    fetch('/api/actions').then(
      r => r.json() as Promise<{ actions: ActionEntry[]; cooldown_seconds: number; source: string }>
    ),
  status: () => fetch('/api/status').then(r => r.json() as Promise<StatusPayload>),
  start: () => post('/api/start'),
  stop: () => post('/api/stop'),
  droneConnect: () => post('/api/drone/connect'),
  droneDisconnect: () => post('/api/drone/disconnect'),
  arm: () => post('/api/drone/arm'),
  disarm: () => post('/api/drone/disarm'),
  takeoff: () => post('/api/drone/takeoff'),
  land: () => post('/api/drone/land'),
  returnHome: () => post('/api/drone/rth'),
  emergency: () => post('/api/drone/emergency'),
};

export function wsUrl(path: string): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}${path}`;
}

/**
 * Human-readable rendering of a SoftwarePilot piloting.move_by call.
 *
 * Olympe's moveBy uses the drone body frame: +x forward, +y RIGHT, +z DOWN,
 * angle in radians.  This is printed verbatim so an operator can see exactly
 * which axis a gesture drives — actions.json names one of its groups
 * "vertical" while pointing it at arg_index 1, which is the y (lateral) axis.
 */
export function describeCommand(component: string, action: string, args: number[]): string {
  if (component === 'piloting' && action === 'move_by' && args.length >= 4) {
    const [x, y, z, angle] = args;
    const parts: string[] = [];
    if (x) parts.push(`${x > 0 ? 'forward' : 'back'} ${Math.abs(x)} m (x)`);
    if (y) parts.push(`${y > 0 ? 'right' : 'left'} ${Math.abs(y)} m (y)`);
    if (z) parts.push(`${z > 0 ? 'down' : 'up'} ${Math.abs(z)} m (z)`);
    if (angle) parts.push(`yaw ${(angle * 180 / Math.PI).toFixed(0)}° (${angle.toFixed(3)} rad)`);
    return parts.length ? parts.join(', ') : 'no movement';
  }
  return `${component}.${action}(${args.join(', ')})`;
}

/** Presentation only — emoji/描述. The command itself always comes from actions.json. */
export const GESTURE_PRESENTATION: Record<string, { emoji: string; description: string }> = {
  like: { emoji: '👍', description: 'Thumbs up' },
  dislike: { emoji: '👎', description: 'Thumbs down' },
  stop: { emoji: '✋', description: 'Open hand, palm forward' },
  peace: { emoji: '✌️', description: 'Peace / V sign' },
  fist: { emoji: '✊', description: 'Closed fist' },
  palm: { emoji: '🖐️', description: 'Open palm' },
  ok: { emoji: '👌', description: 'OK sign' },
  one: { emoji: '☝️', description: 'One finger up' },
  two_up: { emoji: '✌️', description: 'Two fingers up' },
  rock: { emoji: '🤟', description: 'Rock on' },
  call: { emoji: '🤙', description: 'Call me' },
  mute: { emoji: '🤫', description: 'Shush' },
  four: { emoji: '🖖', description: 'Four fingers' },
  three: { emoji: '🤟', description: 'Three fingers' },
  stop_inverted: { emoji: '🤚', description: 'Inverted stop' },
};

export function presentation(label: string) {
  return GESTURE_PRESENTATION[label] ?? { emoji: '🖐️', description: label.replace(/_/g, ' ') };
}
