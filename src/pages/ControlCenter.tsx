import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, 
  Camera, 
  Mic, 
  Trash2, 
  RotateCw, 
  Power, 
  Compass, 
  Cpu, 
  Radio, 
  Battery, 
  CheckCircle2, 
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Plus,
  Tv
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Device, DeviceType, UserSession } from '../types';

interface ControlCenterProps {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  selectedBackpack: string;
  currentUser: UserSession | null;
  setSelectedBackpack: (serial: string) => void;
}

export default function ControlCenter({ 
  devices, 
  setDevices, 
  selectedBackpack, 
  currentUser,
  setSelectedBackpack 
}: ControlCenterProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [syncingState, setSyncingState] = useState<'idle' | 'syncing' | 'completed'>('idle');
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-init selected device if equipment exists
  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  // Handle Equipment Addition
  const handleAddEquipment = (type: DeviceType) => {
    const freshId = `${type}-${Date.now()}`;
    const nameMap = {
      honeypot: `Bait Unit #${devices.length + 1}`,
      camera: `Eye-Trap #${devices.length + 1}`,
      audio: `Mic Sentry #${devices.length + 1}`
    };
    
    // Create random or neat coordinates
    const offset = devices.length * 8;
    const nextX = Math.min(85, Math.max(15, 30 + offset));
    const nextY = Math.min(85, Math.max(15, 30 + offset));

    const newDevice: Device = {
      id: freshId,
      type,
      gridX: nextX,
      gridY: nextY,
      rotation: type === 'camera' ? 180 : 0,
      battery: 100,
      status: 'offline', // Starts offline until synced
      name: nameMap[type]
    };

    setDevices(prev => [...prev, newDevice]);
    setSelectedDeviceId(freshId);
  };

  // Drag and drop and grid clicking
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !selectedDeviceId) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    
    // Constrain to grid boundaries safely
    const posX = Math.min(90, Math.max(10, x));
    const posY = Math.min(90, Math.max(10, y));

    setDevices(prev => prev.map(d => d.id === selectedDeviceId ? { ...d, gridX: posX, gridY: posY } : d));
  };

  const handleRemoveDevice = (id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
    if (selectedDeviceId === id) {
      setSelectedDeviceId(null);
    }
  };

  const handleRotateCamera = (id: string) => {
    setDevices(prev => prev.map(d => {
      if (d.id === id && d.type === 'camera') {
        return { ...d, rotation: (d.rotation + 45) % 360 };
      }
      return d;
    }));
  };

  const togglePower = (id: string) => {
    setDevices(prev => prev.map(d => {
      if (d.id === id) {
        return { ...d, status: d.status === 'offline' ? 'online' : 'offline' };
      }
      return d;
    }));
  };

  // Concentric ring setup recommendation auto-siting
  const suggestOptimalPositions = () => {
    // We search if there's a honeypot placed. If not, generate one.
    let hX = 50;
    let hY = 50;
    
    const honeypot = devices.find(d => d.type === 'honeypot');
    if (honeypot) {
      hX = honeypot.gridX;
      hY = honeypot.gridY;
    }

    const optimalSet: Device[] = [
      { id: 'hp-opt', type: 'honeypot', gridX: hX, gridY: hY, rotation: 0, battery: 100, status: 'offline', name: 'Altar Bait Target' },
      { id: 'cam-opt-1', type: 'camera', gridX: Math.max(10, hX - 12), gridY: Math.max(10, hY - 12), rotation: 135, battery: 96, status: 'offline', name: 'Creek Cam Eye' },
      { id: 'cam-opt-2', type: 'camera', gridX: Math.min(90, hX + 12), gridY: Math.min(90, hY + 12), rotation: 315, battery: 89, status: 'offline', name: 'Scrub Cam Eye' },
      { id: 'aud-opt', type: 'audio', gridX: hX, gridY: Math.max(10, hY - 30), rotation: 180, battery: 94, status: 'offline', name: 'Sentinel Mic' }
    ];

    setDevices(optimalSet);
    setSelectedDeviceId('hp-opt');
  };

  // Sync virtual software simulation parameters to LoRa devices
  const triggerSyncSync = () => {
    if (devices.length === 0) return;
    setSyncingState('syncing');
    setSyncProgress(0);
    
    // Simulated increment interval
    const interval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setSyncingState('completed');
          // Turn all device state indicators green (online)
          setDevices(current => current.map(dev => ({ ...dev, status: 'online' })));
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  // Siting Rules Quality Validation Checklist
  const sitingChecklist = useMemo(() => {
    const honeypots = devices.filter(d => d.type === 'honeypot');
    const cameras = devices.filter(d => d.type === 'camera');
    const audios = devices.filter(d => d.type === 'audio');

    const hasHoneypot = honeypots.length > 0;
    const hasMultipleCameras = cameras.length >= 2;
    const hasAudio = audios.length > 0;

    // Check if cameras point generally towards honeypot center
    let overlapInCenter = false;
    if (hasHoneypot && cameraAnglesCheck(honeypots[0], cameras)) {
      overlapInCenter = true;
    }

    return {
      hasHoneypot,
      hasMultipleCameras,
      hasAudio,
      overlapInCenter,
      isOptimal: hasHoneypot && hasMultipleCameras && hasAudio && overlapInCenter
    };
  }, [devices]);

  function cameraAnglesCheck(honeypot: Device, cameras: Device[]) {
    // Simply check if cameras are placed within 25 grid units of honeypot
    if (cameras.length === 0) return false;
    let countsNear = 0;
    cameras.forEach(c => {
      const dist = Math.sqrt(Math.pow(c.gridX - honeypot.gridX, 2) + Math.pow(c.gridY - honeypot.gridY, 2));
      if (dist <= 30) countsNear++;
    });
    return countsNear >= 2;
  }

  // Find currently selected device coordinates/info for terminal detail output
  const activeDeviceData = devices.find(d => d.id === selectedDeviceId);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-stone-100">
      
      {/* LEFT MODULE - Siting Side Panel & Component Inventory */}
      <aside className="w-full md:w-96 bg-white border-r border-stone-200 flex flex-col z-20 shrink-0 select-none">
        
        {/* Dropdown serial number manager */}
        <div className="p-5 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest leading-none">Active Hardware Serial</span>
            <span className="text-[9px] bg-emerald-900 text-white px-2 py-0.5 rounded-full font-black tracking-wider uppercase">LoRa Node</span>
          </div>
          
          <select 
            value={selectedBackpack}
            onChange={(e) => setSelectedBackpack(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl font-mono text-sm text-stone-900 focus:outline-none focus:border-emerald-700"
          >
            {currentUser?.backpacks.map((serial) => (
              <option key={serial} value={serial}>{serial} - Workspace Kit</option>
            ))}
          </select>
        </div>

        {/* Dynamic scroll portion */}
        <div className="flex-grow overflow-y-auto p-5 space-y-6">
          
          {/* Action Box */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Add Equipment</span>
              <span className="text-xs text-stone-400 font-semibold font-mono">Max 6 Nodes</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleAddEquipment('honeypot')}
                disabled={devices.filter(d => d.type === 'honeypot').length >= 1}
                className={cn(
                  "p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all group",
                  devices.some(d => d.type === 'honeypot')
                    ? "bg-stone-50 border-stone-150 text-stone-300 opacity-60 cursor-not-allowed"
                    : "bg-emerald-50 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-100/50 text-emerald-900 active:scale-95"
                )}
                title="Only one honeypot scent can be deployed at a time"
              >
                <Target size={16} className="mb-0.5 text-emerald-700" />
                <span className="text-[9px] font-black tracking-tight text-center">Bait Unit</span>
              </button>

              <button
                onClick={() => handleAddEquipment('camera')}
                className="p-2.5 bg-white border border-stone-200 rounded-xl flex flex-col items-center justify-center hover:border-stone-400 text-stone-800 transition-all active:scale-95 group"
              >
                <Camera size={16} className="mb-0.5 text-blue-600 group-hover:scale-105 transition-transform" />
                <span className="text-[9px] font-black tracking-tight text-center">Eye Trap</span>
              </button>

              <button
                onClick={() => handleAddEquipment('audio')}
                className="p-2.5 bg-white border border-stone-200 rounded-xl flex flex-col items-center justify-center hover:border-stone-400 text-stone-800 transition-all active:scale-95 group"
              >
                <Mic size={16} className="mb-0.5 text-green-600 group-hover:scale-105 transition-transform" />
                <span className="text-[9px] font-black tracking-tight text-center">Mic Sentry</span>
              </button>
            </div>
          </div>

          {/* Aggregated Permanent Status List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Deployed Hardware Nodes</span>
              <span className="text-xs text-stone-450 font-mono font-bold">{devices.length}/6 Linked</span>
            </div>

            {devices.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-stone-150 rounded-2xl text-center text-xs text-stone-400 italic">
                No active sub-devices deployed yet. Add devices using the inventory panels above.
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
                {devices.map((dev) => {
                  const isHighlighted = dev.id === selectedDeviceId;
                  return (
                    <div
                      key={dev.id}
                      onClick={() => setSelectedDeviceId(dev.id)}
                      className={cn(
                        "p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-2.5",
                        isHighlighted 
                          ? "bg-emerald-50/70 border-emerald-500 shadow-sm ring-1 ring-emerald-400/35" 
                          : "bg-white border-stone-200 hover:border-stone-300"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Device Type Mini Graphic */}
                        <div className={cn(
                          "p-2 rounded-lg border text-white grow-0 shrink-0",
                          dev.type === 'honeypot' ? "bg-rose-500 border-rose-600" :
                          dev.type === 'camera' ? "bg-blue-600 border-blue-700" :
                          "bg-green-600 border-green-700"
                        )}>
                          {dev.type === 'honeypot' && <Target size={12} />}
                          {dev.type === 'camera' && <Camera size={12} />}
                          {dev.type === 'audio' && <Mic size={12} />}
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-stone-900 truncate leading-none mb-1">{dev.name}</h4>
                          <span className="text-[9px] font-mono text-stone-400 font-bold block">
                            [X: {dev.gridX}%, Y: {dev.gridY}%]
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-right">
                        {/* Battery Status */}
                        <div className="flex items-center gap-1">
                          <Battery size={10} className="text-stone-400" />
                          <span className="text-[10px] font-mono font-bold text-stone-600">{dev.battery}%</span>
                        </div>

                        {/* On/Off Indicator */}
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          dev.status === 'online' ? "bg-emerald-500 animate-pulse" : "bg-stone-300"
                        )} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Siting checklist feedback */}
          <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-150 space-y-2.5">
             <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-widest text-stone-400">Layout Verification</span>
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                  sitingChecklist.isOptimal ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-850"
                )}>
                  {sitingChecklist.isOptimal ? "Ready" : "Incomplete"}
                </span>
             </div>

             <div className="space-y-1 text-[11px] text-stone-600">
                <div className="flex items-center gap-2">
                   <div className={cn("w-1.5 h-1.5 rounded-full", sitingChecklist.hasHoneypot ? "bg-emerald-500" : "bg-stone-300")} />
                   <span>Attractant bait unit deployed {sitingChecklist.hasHoneypot ? "✓" : "✗"}</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className={cn("w-1.5 h-1.5 rounded-full", sitingChecklist.hasMultipleCameras ? "bg-emerald-500" : "bg-stone-300")} />
                   <span>Concentric: 2+ active camera traps {sitingChecklist.hasMultipleCameras ? "✓" : "✗"}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-between w-full pt-1">
                  <button
                    onClick={suggestOptimalPositions}
                    className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100/50 text-emerald-900 border border-emerald-200 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 transition-colors"
                  >
                    <Sparkles size={11} className="text-emerald-700" />
                    Apply Recommended Layout
                  </button>
                </div>
             </div>
          </div>

          {/* Active node controller */}
          <AnimatePresence mode="wait">
            {activeDeviceData ? (
              <motion.div 
                key={activeDeviceData.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="p-3.5 bg-zinc-50 border border-stone-200 rounded-2xl space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-mono font-bold tracking-widest text-stone-400 uppercase">Selected parameters</span>
                    <h4 className="text-xs font-black text-stone-900 mt-0.5 leading-tight">{activeDeviceData.name} Settings</h4>
                  </div>
                  <button 
                    onClick={() => handleRemoveDevice(activeDeviceData.id)}
                    className="p-1 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-lg transition-colors"
                    title="Remove Node"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => togglePower(activeDeviceData.id)}
                    className={cn(
                      "flex-grow py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all text-white",
                      activeDeviceData.status === 'offline' 
                        ? "bg-stone-950 hover:bg-stone-850" 
                        : "bg-red-900/90 hover:bg-red-800"
                    )}
                  >
                    <Power size={11} />
                    {activeDeviceData.status === 'offline' ? "Activate Node" : "Disconnect / Off"}
                  </button>

                  {activeDeviceData.type === 'camera' && (
                    <button
                      onClick={() => handleRotateCamera(activeDeviceData.id)}
                      className="px-3 bg-white border border-stone-250 hover:border-stone-400 text-stone-850 rounded-xl font-bold text-xs flex items-center justify-center transition-all"
                      title="Rotate visual cone"
                    >
                      <RotateCw size={11} className="text-stone-600" />
                    </button>
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

        </div>

        {/* Sync Trigger Panel */}
        <div className="mt-auto p-5 border-t border-stone-100 bg-white">
          {syncingState === 'idle' && (
            <button
              onClick={triggerSyncSync}
              disabled={devices.length === 0}
              className="w-full py-3.5 bg-emerald-900 hover:bg-emerald-800 text-white disabled:bg-stone-150 disabled:text-stone-400 font-bold text-[13px] tracking-tight rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/20 active:scale-98"
            >
              <Radio size={16} />
              Sync Setup over LoRa Network ({devices.length} Nodes)
            </button>
          )}

          {syncingState === 'syncing' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-emerald-800 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Radio size={12} className="animate-ping" fill="currentColor" />
                  Tunneling configuration parameters...
                </span>
                <span className="font-mono">{syncProgress}%</span>
              </div>
              <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200/50">
                <motion.div 
                  className="h-full bg-emerald-700 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${syncProgress}%` }}
                />
              </div>
            </div>
          )}

          {syncingState === 'completed' && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 text-emerald-900 font-bold">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Synchronized correctly! Hardware live.
              </div>
              <button 
                onClick={() => setSyncingState('idle')}
                className="text-[10px] uppercase font-black text-emerald-700 hover:text-emerald-950 underline underline-offset-2"
              >
                Reflashing
              </button>
            </motion.div>
          )}
        </div>

      </aside>

      {/* RIGHT MODULE - Interactive Virtual Mesh Grid Canvas */}
      <main className="flex-grow relative bg-emerald-950 overflow-hidden flex flex-col justify-between">
        
        {/* Real-time Map Radar lines and geometric background */}
        <div className="absolute inset-0 z-0">
          {/* Coordinates guidelines mesh */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          {/* Siting overlay markers */}
          <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none flex items-center justify-center">
            <div className="w-[480px] h-[480px] rounded-full border border-dashed border-emerald-500/20" />
            <div className="absolute w-[240px] h-[240px] rounded-full border border-dotted border-emerald-500/10" />
          </div>
        </div>

        {/* Map Header details */}
        <div className="p-6 relative z-10 flex justify-between items-start pointer-events-none">
          <div className="bg-emerald-900/30 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-white space-y-1">
            <span className="text-[9px] uppercase font-mono tracking-widest text-emerald-300">TELEMETRY CANVAS</span>
            <h2 className="text-sm font-bold tracking-tight">Canyon-Edge Meadow Digital Twin</h2>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 text-white flex gap-6 text-xs shadow-2xl">
            <div className="flex flex-col">
              <span className="text-[9px] text-emerald-200/50 font-bold uppercase tracking-widest">LoRa Uplink</span>
              <span className="font-mono font-bold text-green-400">920.4 MHz</span>
            </div>
            <div className="flex-grow w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[9px] text-emerald-200/50 font-bold uppercase tracking-widest">Siting Verdict</span>
              <span className="font-mono font-bold text-emerald-200">
                {sitingChecklist.isOptimal ? "Optimal Bullseye" : "Suboptimal Target Siting"}
              </span>
            </div>
          </div>
        </div>

        {/* Clickable Map Mesh Platform */}
        <div 
          ref={containerRef}
          onClick={handleGridClick}
          className="flex-grow relative z-10 select-none cursor-crosshair mx-12 my-6 bg-emerald-900/10 border-2 border-dashed border-emerald-800/40 rounded-[2.5rem] overflow-hidden"
          title="Click anywhere inside the grid map to position the selected sensor instantly"
        >
          {/* Spawn active device markers */}
          {devices.map((dev) => {
            const isSelected = dev.id === selectedDeviceId;
            return (
              <motion.div
                key={dev.id}
                onClick={(e) => {
                  e.stopPropagation(); // prevent grid placement click trigger
                  setSelectedDeviceId(dev.id);
                }}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-30",
                  isSelected ? "ring-2 ring-white/60 r-offset-2 rounded-full" : ""
                )}
                style={{
                  left: `${dev.gridX}%`,
                  top: `${dev.gridY}%`,
                }}
                layoutId={`device-map-${dev.id}`}
              >
                {/* Visual Field Rendering Cones */}
                
                {/* Cameras 90-deg Cone */}
                {dev.type === 'camera' && dev.status === 'online' && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none overflow-visible">
                    <svg
                      className="origin-center text-blue-500/20"
                      style={{ transform: `rotate(${dev.rotation - 90}deg)` }}
                      width="180" height="180" viewBox="0 0 100 100"
                    >
                      <path d="M50 50 L100 20 A 40 40 0 0 1 100 80 Z" fill="currentColor" />
                    </svg>
                  </div>
                )}

                {/* Audio Sentinel Circle Rings */}
                {dev.type === 'audio' && dev.status === 'online' && (
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-green-500/20 pointer-events-none"
                    style={{
                      width: '160px',
                      height: '160px',
                      background: 'radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0) 70%)'
                    }}
                  />
                )}

                {/* Bait Ring Wave */}
                {dev.type === 'honeypot' && dev.status === 'online' && (
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dotted border-rose-500/30 pointer-events-none animate-ping-slow"
                    style={{
                      width: '60px',
                      height: '60px'
                    }}
                  />
                )}

                {/* Hardware Icon Circle */}
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 text-white relative",
                  dev.type === 'honeypot' ? "bg-rose-500 border-rose-700" :
                  dev.type === 'camera' ? "bg-blue-600 border-blue-800" :
                  "bg-green-600 border-green-800",
                  isSelected ? "scale-110 ring-4 ring-emerald-400" : ""
                )}>
                  {dev.type === 'honeypot' && <Target size={18} strokeWidth={2.5} />}
                  {dev.type === 'camera' && <Camera size={16} strokeWidth={2.5} />}
                  {dev.type === 'audio' && <Mic size={16} strokeWidth={2.5} />}

                  {/* Battery/Offline dot status */}
                  <span className={cn(
                    "absolute top-0 right-0 w-3 h-3 rounded-full border border-white",
                    dev.status === 'online' 
                      ? "bg-green-400" 
                      : (dev.status === 'offline' ? "bg-stone-500" : "bg-orange-400")
                  )} />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Validation Siting Quality Bar HUD */}
        <div className="p-6 relative z-10">
          <div className="bg-white rounded-3xl p-5 max-w-2xl mx-auto border border-emerald-100/50 shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center sm:items-start">
               <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Layout Suitability Index</span>
               <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    "text-3xl font-black tracking-tight",
                    sitingChecklist.isOptimal ? "text-emerald-950" : "text-orange-950"
                  )}>
                     {sitingChecklist.isOptimal ? "98%" : "45%"}
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                    sitingChecklist.isOptimal 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                      : "bg-orange-50 text-orange-700 border border-orange-100"
                  )}>
                     {sitingChecklist.isOptimal ? "+12 Near Creek" : "-53 Sensor Gaps"}
                  </span>
               </div>
            </div>

            <div className="hidden sm:block w-px h-12 bg-stone-100" />

            <div className="flex-grow flex items-center gap-4 text-left">
              <div className={cn(
                "p-3 rounded-2xl shrink-0 border",
                sitingChecklist.isOptimal 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                  : "bg-orange-50 text-orange-850 border-orange-200"
              )}>
                {sitingChecklist.isOptimal ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div>
                <p className="text-sm font-black text-stone-900 uppercase tracking-tight">
                  {sitingChecklist.isOptimal ? "Optimal Bullseye Deployment" : "Suboptimal Sensor Footprint"}
                </p>
                <p className="text-[11px] text-stone-400 font-medium">
                  {sitingChecklist.isOptimal 
                    ? "Concentric crossfire camera traps are intersecting optimally near the central bait target." 
                    : "Add 2 cameras pointing towards the scent honeypot target, and ensure LoRa synchronization is flashed."}
                </p>
              </div>
            </div>
          </div>
        </div>

      </main>

    </div>
  );
}
