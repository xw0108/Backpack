import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, 
  Wifi, 
  Check, 
  X, 
  Target, 
  Camera, 
  Mic, 
  Database,
  Volume2,
  Sparkles,
  Zap,
  Clock,
  Battery,
  CloudLightning,
  Sun,
  Moon,
  Wind,
  HardDrive,
  ShieldAlert,
  UploadCloud
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Device, PhotoCapture } from '../types';

interface CampSimulatorProps {
  devices: Device[];
  photoCaptures: PhotoCapture[];
  setPhotoCaptures: React.Dispatch<React.SetStateAction<PhotoCapture[]>>;
  simulatedScore: number;
  setSimulatedScore: React.Dispatch<React.SetStateAction<number>>;
}

interface EventLog {
  id: string;
  type: 'sound' | 'vision' | 'privacy' | 'success';
  message: string;
  time: string;
  nodeName: string;
  deviceId: string;
}

// Wildlife stock footage descriptions for local thermal simulations
const WILDLIFE_FEEDS = [
  {
    title: "Grey Fox Foraging",
    img: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=800&auto=format&fit=crop",
    desc: "Alert predator investigating bait footprint vectors. Weight approx 4.2kg.",
    temp: "8.5°C",
    movement: "High Activity"
  },
  {
    title: "White-Tailed Deer",
    img: "https://images.unsplash.com/photo-1484406566174-9da000fda645?q=80&w=800&auto=format&fit=crop",
    desc: "Nocturnal browsing habits captured near creekbed canopy overlap.",
    temp: "9.1°C",
    movement: "Calm Grazing"
  },
  {
    title: "North American Raccoon",
    img: "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?q=80&w=800&auto=format&fit=crop",
    desc: "Tactile investigation of scent reservoir nodes detected near honeypot.",
    temp: "10.0°C",
    movement: "Fidgety Search"
  },
  {
    title: "Black Bear Cub",
    img: "https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?q=80&w=800&auto=format&fit=crop",
    desc: "Large mammal trigger near regional corridor pathway edge.",
    temp: "7.8°C",
    movement: "Slow Passage"
  }
];

export default function CampSimulator({
  devices,
  photoCaptures,
  setPhotoCaptures,
  simulatedScore,
  setSimulatedScore
}: CampSimulatorProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Local Raspberry Pi 4 edge cache simulation space
  const [showEdgeCacheModal, setShowEdgeCacheModal] = useState<boolean>(false);
  const [edgeCacheItems, setEdgeCacheItems] = useState([
    {
      id: 'cache-wild-1',
      timestamp: '23:38:12',
      device: 'Creek-Facing Cam #1',
      type: 'thermal_still',
      detectedLabel: 'Coyote (Nocturnal)',
      confidence: 88.5,
      img: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=800&auto=format&fit=crop',
      size: '1.4 MB',
      isHumanTrigger: false,
      status: 'Ready for Uplink'
    },
    {
      id: 'cache-human-1',
      timestamp: '23:40:05',
      device: 'Forest Canopy Cam #2',
      type: 'person_trigger',
      detectedLabel: 'Human Passerby (Blurred)',
      confidence: 97.2,
      img: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?q=80&w=800&auto=format&fit=crop',
      size: '950 KB',
      isHumanTrigger: true,
      status: 'Privacy Mask Applied'
    },
    {
      id: 'cache-wild-2',
      timestamp: '23:41:50',
      device: 'Birch Grove Mic Cam',
      type: 'nocturnal_still',
      detectedLabel: 'White-Tailed Deer',
      confidence: 94.6,
      img: 'https://images.unsplash.com/photo-1484406566174-9da000fda645?q=80&w=800&auto=format&fit=crop',
      size: '1.8 MB',
      isHumanTrigger: false,
      status: 'Ready for Uplink'
    },
    {
      id: 'cache-wild-3',
      timestamp: '23:42:30',
      device: 'Forest Canopy Cam #2',
      type: 'nocturnal_still',
      detectedLabel: 'North American Raccoon',
      confidence: 91.2,
      img: 'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?q=80&w=800&auto=format&fit=crop',
      size: '1.1 MB',
      isHumanTrigger: false,
      status: 'Ready for Uplink'
    }
  ]);

  const handleUplink = (item: typeof edgeCacheItems[0]) => {
    // 1. Remove from local cache
    setEdgeCacheItems(prev => prev.filter(c => c.id !== item.id));
    
    // 2. Add to cloud archive photos
    const newCapture: PhotoCapture = {
      id: `cloud-${Date.now()}-${item.id}`,
      imageUrl: item.img,
      detectedLabel: item.detectedLabel,
      confidence: item.confidence,
      time: item.timestamp,
      nodeName: item.device,
      verified: false
    };
    setPhotoCaptures(prev => [newCapture, ...prev]);
    
    // 3. Increment scientific score
    setSimulatedScore(prev => prev + 50);

    // 4. Update live stream logs
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs(prev => [
      {
        id: `manual-uplink-${Date.now()}`,
        type: 'success',
        message: `🛰️ Edge Uplink Successful: ${item.detectedLabel} dispatched to Cloud Archive. (+50 Pts)`,
        time: timestamp,
        nodeName: item.device,
        deviceId: item.id
      },
      ...prev
    ]);
  };

  const handleUplinkAll = () => {
    if (edgeCacheItems.length === 0) return;
    
    // Add all to cloud
    const newCaptures = edgeCacheItems.map((item, idx) => ({
      id: `cloud-${Date.now()}-${item.id}-${idx}`,
      imageUrl: item.img,
      detectedLabel: item.detectedLabel,
      confidence: item.confidence,
      time: item.timestamp,
      nodeName: item.device,
      verified: false
    }));
    
    setPhotoCaptures(prev => [...newCaptures, ...prev]);
    setSimulatedScore(prev => prev + (edgeCacheItems.length * 50));
    
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs(prev => [
      {
        id: `manual-uplink-all-${Date.now()}`,
        type: 'success',
        message: `🛰️ Edge Uplink ALL successful! ${edgeCacheItems.length} media datasets uploaded to Cloud Archive. (+${edgeCacheItems.length * 50} Pts)`,
        time: timestamp,
        nodeName: 'Multiple Nodes',
        deviceId: 'multi'
      },
      ...prev
    ]);
    
    setEdgeCacheItems([]);
  };
  
  // Environment simulation variables
  const [weather, setWeather] = useState<'mild' | 'windy' | 'storm'>('mild');
  const [timeOffset, setTimeOffset] = useState<'dusk' | 'midnight' | 'dawn'>('midnight');
  
  // Dynamic links showing as highlighter beams
  const [activeBeam, setActiveBeam] = useState<string | null>(null);
  const [activeBubble, setActiveBubble] = useState<{ id: string; msg: string; x: number; y: number } | null>(null);
  
  const [logs, setLogs] = useState<EventLog[]>([]);

  // Seed baseline logs on boot
  useEffect(() => {
    const initialLogs: EventLog[] = [
      { 
        id: 'seed-1', 
        type: 'success', 
        message: 'Telemetry Sentry Core Online. Frequency 920.4 MHz secured.', 
        time: '23:30:10', 
        nodeName: 'Base Sentry',
        deviceId: 'base'
      },
      { 
        id: 'seed-2', 
        type: 'sound', 
        message: 'Audio Sentinel started ambient sound filter. Threshold: 60dB.', 
        time: '23:31:45', 
        nodeName: 'Sentinel Mic #1',
        deviceId: 'aud-opt'
      }
    ];
    setLogs(initialLogs);
  }, []);

  // Idle game loop simulating triggers & automatic event notifications
  useEffect(() => {
    if (!isPlaying || devices.length === 0) return;

    // Define simulation intervals based on weather
    const speeds = { mild: 5000, windy: 8000, storm: 11000 };
    const checkInterval = speeds[weather];

    const triggers = [
      {
        type: 'sound',
        msg: "🔊 Sound spike! Scrunching twigs detected (+72dB). Triggering camera concentric sync.",
        targetType: 'audio',
        points: 5
      },
      {
        type: 'vision',
        msg: "📸 Camera shutter fired. Multi-frame thermal snapshot archived to memory cache.",
        targetType: 'camera',
        points: 15
      },
      {
        type: 'privacy',
        msg: "🛡️ Privacy Guard: Face blurring filters applied securely at the wilderness edge.",
        targetType: 'camera',
        points: 10
      },
      {
        type: 'success',
        msg: "🦌 Sentry AI Categorized: Detected nocturnal specimen with 93.6% accuracy score.",
        targetType: 'honeypot',
        points: 25
      }
    ];

    let step = 0;
    const interval = setInterval(() => {
      const activeTrigger = triggers[step % triggers.length];
      
      // Select appropriate device
      const matchingDevice = devices.find(d => d.type === activeTrigger.targetType && d.status === 'online') 
                            || devices.find(d => d.status === 'online')
                            || devices[0];

      if (matchingDevice && matchingDevice.status === 'online') {
        // Highlight corresponding LoRa beam
        setActiveBeam(matchingDevice.id);

        // Display glowing diagnostic alert bubble over node coordinate
        setActiveBubble({
          id: `bubble-${Date.now()}`,
          msg: activeTrigger.msg,
          x: matchingDevice.gridX,
          y: matchingDevice.gridY
        });

        // Increment automatic citizenship score
        setSimulatedScore(prev => prev + activeTrigger.points);

        // Update raw telemetry stream logs
        const now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        setLogs(prev => [
          {
            id: `sim-log-${Date.now()}`,
            type: activeTrigger.type as any,
            message: activeTrigger.msg,
            time: timestamp,
            nodeName: matchingDevice.name,
            deviceId: matchingDevice.id
          },
          ...prev
        ].slice(0, 30));

        // Fade elements
        setTimeout(() => {
          setActiveBeam(null);
        }, 1500);

        setTimeout(() => {
          setActiveBubble(null);
        }, 3500);
      }

      step++;
    }, checkInterval);

    return () => clearInterval(interval);
  }, [isPlaying, devices, weather, setSimulatedScore]);

  // Specific historical events triggered by that hardware component for interactive inspection modal
  const simulatedDeviceHistory = useMemo(() => {
    if (!selectedDevice) return [];
    
    // Generate high-quality realistic logs specifically for this selected device type
    const logsMap: Record<string, string[]> = {
      honeypot: [
        "Scent distribution pulse dispatched safely.",
        "Mild pheromone bait depletion registered (-2%).",
        "Concentric wildlife corridor path intersecting successfully."
      ],
      camera: [
        "90-degree thermal vision angle calibration stable.",
        "Edge CPU face blur mask applied to blank frames successfully.",
        "Sub-pixel capture uploaded securely via 920MHz radio."
      ],
      audio: [
        "Decibel spectral analysis: High-frequency rodent scratch registered.",
        "Decay speed threshold stabilized at 40dB ambient limit.",
        "Gain correction offset modified to adapt rain canopy noise."
      ]
    };

    const typeLogs = logsMap[selectedDevice.type] || ["Module diagnostic link verified. status: OK"];
    
    return typeLogs.map((msg, idx) => {
      const min = (10 + idx * 12).toString().padStart(2, '0');
      return {
        time: `22:${min}:05`,
        message: msg,
        id: `specific-h-${selectedDevice.id}-${idx}`
      };
    });
  }, [selectedDevice]);

  // Associated simulated thermal footage feed matching selected hardware
  const simulatedFootage = useMemo(() => {
    if (!selectedDevice) return null;
    const index = selectedDevice.type === 'honeypot' ? 2 : selectedDevice.type === 'camera' ? 1 : 0;
    return WILDLIFE_FEEDS[index];
  }, [selectedDevice]);

  return (
    <div className="flex flex-col xl:flex-row h-[calc(100vh-64px)] overflow-hidden bg-stone-900 text-stone-100">
      
      {/* LEFT PANEL: Live Event Console & Digital Twin Controls */}
      <aside className="w-full xl:w-[420px] bg-stone-950 border-r border-stone-800 flex flex-col shrink-0 select-none z-20">
        
        {/* Panel Header */}
        <div className="p-5 border-b border-stone-800 bg-stone-900/40 flex justify-between items-center">
          <div>
            <span className="text-[10px] uppercase font-mono font-black tracking-widest text-emerald-400">Digital Twin Core</span>
            <h2 className="text-base font-black text-white leading-tight mt-0.5">Live Simulation Desk</h2>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="text-[10px] bg-stone-900 border border-stone-800 px-2 py-1.5 rounded-lg text-emerald-400 font-bold">
              SCORE: +{simulatedScore}
            </span>
          </div>
        </div>

        {/* Ambient Game Speed & Weather Controller Panel */}
        <div className="p-4 border-b border-stone-800 space-y-4">
          <div className="bg-stone-900/50 rounded-xl p-3 border border-stone-800/80 space-y-3">
            <span className="text-[9px] uppercase font-mono tracking-widest text-stone-400 font-bold block">
              Digital Twin Environmental Adjustments
            </span>

            <div className="grid grid-cols-3 gap-2 text-[10px] font-bold">
              <button
                onClick={() => setWeather('mild')}
                className={cn(
                  "p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all",
                  weather === 'mild' 
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/40" 
                    : "bg-stone-950 border-stone-850 hover:bg-stone-900 text-stone-400"
                )}
              >
                <Sun size={12} />
                Mild Weather
              </button>
              
              <button
                onClick={() => setWeather('windy')}
                className={cn(
                  "p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all",
                  weather === 'windy' 
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/40" 
                    : "bg-stone-950 border-stone-850 hover:bg-stone-900 text-stone-400"
                )}
              >
                <Wind size={12} />
                Windy Gale
              </button>

              <button
                onClick={() => setWeather('storm')}
                className={cn(
                  "p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all",
                  weather === 'storm' 
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/40" 
                    : "bg-stone-950 border-stone-850 hover:bg-stone-900 text-stone-400"
                )}
              >
                <CloudLightning size={12} />
                Dense Storm
              </button>
            </div>

            <div className="flex justify-between items-center pt-1.5">
              <span className="text-[9px] text-stone-500 font-black tracking-wide">AUTOMATIC REFRESH TIME:</span>
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                {weather === 'mild' ? "5s Intervals" : weather === 'windy' ? "8s Intervals" : "11s (Attenuated)"}
              </span>
            </div>
          </div>
        </div>

        {/* Live Telemetry Stream Queue (Completely Replace swiper card with expanded analytics details) */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-900/10">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
              <Clock size={11} className="text-stone-500" />
              Raw Telemetry Live Streams
            </span>
            <div className="flex items-center gap-1.5 text-[8px] tracking-wider uppercase bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded text-emerald-400 font-black">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Feed Buffer Active
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 font-mono text-xs scrollbar-thin overflow-x-hidden">
            {logs.length === 0 ? (
              <div className="p-10 text-center text-stone-500 italic">
                Awaiting first real-time telemetry trigger node flash...
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {logs.map((log) => (
                  <motion.div 
                    key={log.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "p-3 rounded-lg border flex flex-col gap-1.5 text-left transition-all",
                      log.type === 'sound' ? "bg-amber-950/20 border-amber-900/40 text-amber-300" :
                      log.type === 'vision' ? "bg-blue-950/20 border-blue-900/40 text-blue-300" :
                      log.type === 'privacy' ? "bg-purple-950/20 border-purple-900/40 text-purple-300" :
                      "bg-emerald-950/20 border-emerald-900/40 text-emerald-350"
                    )}
                  >
                    <div className="flex justify-between items-center text-[9px] font-black tracking-wide leading-none opacity-80">
                      <span className="uppercase">{log.nodeName}</span>
                      <span>{log.time}</span>
                    </div>
                    <p className="text-[11px] font-bold leading-relaxed text-stone-250">{log.message}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Simulation Watermark Control */}
        <div className="p-4 border-t border-stone-800 bg-stone-900/50 flex justify-between items-center text-xs">
          <span className="text-[9px] font-mono text-stone-500 uppercase tracking-widest">
            Backpack Twin v1.2
          </span>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={cn(
              "px-3 py-1 bg-stone-800 border rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
              isPlaying 
                ? "border-amber-500/30 text-amber-400 hover:bg-stone-700" 
                : "border-emerald-500/40 text-emerald-400 hover:bg-stone-700"
            )}
          >
            {isPlaying ? "Halt Digital Twin" : "Resume Idle Sim"}
          </button>
        </div>

      </aside>

      {/* RIGHT DISPLAY AREA: Night-Radar Virtual Digital Twin Canvas */}
      <main className="flex-grow flex flex-col justify-between relative overflow-hidden p-6 md:p-8">
        
        {/* Background cosmic space */}
        <div className="absolute inset-0 z-0 bg-stone-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.06)_0%,transparent_75%)]" />
          {/* Coordinates grid */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #10b981 1.5px, transparent 0), linear-gradient(to bottom, #10b981 1.5px, transparent 0)', backgroundSize: '40px 40px' }} />
          
          {/* Concentric radar guidelines */}
          <div className="absolute inset-y-0 inset-x-0 pointer-events-none flex items-center justify-center">
            <div className="w-[500px] h-[500px] rounded-full border border-dashed border-emerald-500/5" />
            <div className="absolute w-[300px] h-[300px] rounded-full border border-dotted border-emerald-500/5" />
          </div>
        </div>

        {/* Map Header detail widget */}
        <div className="relative z-10 flex justify-between items-start pointer-events-none">
          <div className="bg-stone-900/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-stone-800 shadow-xl text-left">
            <span className="text-[8px] bg-emerald-950 border border-emerald-800 text-emerald-300 font-extrabold px-2 py-0.5 rounded font-mono uppercase tracking-widest">
              Digital Twin Active
            </span>
            <h2 className="text-sm font-black text-white mt-1.5 leading-none">Canyon Meadow Field Sandbox</h2>
            <span className="text-[10px] font-mono text-stone-500 block mt-1">Status: Mimicking Wilderness Telemetry</span>
          </div>

          <div className="bg-stone-900/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-stone-800 shadow-xl text-right">
            <span className="text-[9px] text-stone-500 font-mono font-bold block uppercase">Net Link Coverage</span>
            <span className="text-xs font-mono font-bold text-white block mt-0.5">LoRa 920.4 MHz (Green)</span>
          </div>
        </div>

        {/* Simulator Grid Arena Area */}
        <div className="flex-grow xl:m-6 m-4 border-2 border-dashed border-stone-800/40 rounded-[3rem] bg-stone-900/10 relative overflow-hidden flex items-center justify-center">
          
          {/* Active flashing LoRa paths linking nodes to the Bait Altar center */}
          {devices.map((dev) => {
            const hNode = devices.find(d => d.type === 'honeypot') || devices[0];
            if (dev.id === hNode.id) return null;

            const isPathActive = activeBeam === dev.id;

            return (
              <svg 
                key={`vector-${dev.id}`}
                className="absolute inset-0 w-full h-full pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <line 
                  x1={`${dev.gridX}%`}
                  y1={`${dev.gridY}%`}
                  x2={`${hNode.gridX}%`}
                  y2={`${hNode.gridY}%`}
                  stroke={isPathActive ? "#10b981" : "#57534e"} 
                  strokeWidth={isPathActive ? "2.5" : "1"} 
                  strokeDasharray="6 6"
                  className={cn(
                    "transition-all duration-300",
                    isPathActive ? "opacity-100" : "opacity-25"
                  )}
                />
              </svg>
            );
          })}

          {/* Render digital markers */}
          {devices.length === 0 ? (
            <div className="text-center text-stone-500 italic space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wide">Telemetry Hardware Sandbox Empty</span>
              <p className="text-[10px]">Create or Synchronize standard nodes first in the Control Center screen.</p>
            </div>
          ) : (
            devices.map((dev) => {
              const isSelected = selectedDevice?.id === dev.id;
              const isTriggerActive = activeBubble?.id.startsWith(dev.id);

              return (
                <div
                  key={`node-sim-${dev.id}`}
                  onClick={() => setSelectedDevice(dev)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-30 flex flex-col items-center"
                  style={{ left: `${dev.gridX}%`, top: `${dev.gridY}%` }}
                >
                  {/* Flashing target signal range lines */}
                  {dev.status === 'online' && (
                    <span className={cn(
                      "absolute w-14 h-14 rounded-full border transition-all pointer-events-none animate-ping-slow pb-1",
                      dev.type === 'honeypot' ? "border-rose-500/20" :
                      dev.type === 'camera' ? "border-blue-500/20" : "border-green-500/20"
                    )} />
                  )}

                  {/* Core Icon Button */}
                  <div className={cn(
                    "w-11 h-11 rounded-full border flex items-center justify-center transition-all bg-stone-950/90 text-white relative",
                    isSelected ? "ring-4 ring-emerald-500 scale-110" : "hover:scale-105",
                    isTriggerActive ? "border-amber-400 bg-amber-950 ring-2 ring-amber-400/50" :
                    dev.type === 'honeypot' ? "border-rose-500/60" :
                    dev.type === 'camera' ? "border-blue-500/60" : "border-green-500/60"
                  )}>
                    {dev.type === 'honeypot' && <Target size={16} />}
                    {dev.type === 'camera' && <Camera size={15} />}
                    {dev.type === 'audio' && <Mic size={15} />}

                    {/* Miniature status node */}
                    <span className={cn(
                      "absolute top-0 right-0 w-2.5 h-2.5 rounded-full border border-stone-900",
                      dev.status === 'online' ? "bg-emerald-400" : "bg-stone-600"
                    )} />
                  </div>

                  {/* Subtitle tag */}
                  <span className="text-[8px] font-mono uppercase bg-stone-900/95 border border-stone-850 px-2.5 py-0.5 rounded-full text-stone-300 block mt-1.5 shadow">
                    {dev.name.split('#')[0]}
                  </span>
                </div>
              );
            })
          )}

          {/* Automatic bubble alert popping overlay floating on digital twin */}
          <AnimatePresence>
            {activeBubble && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -12 }}
                className="absolute bg-emerald-950/90 backdrop-blur-md text-white border border-emerald-500/50 p-3 rounded-xl shadow-2xl z-40 max-w-[260px] text-center pointer-events-none"
                style={{
                  left: `${activeBubble.x}%`,
                  top: `${activeBubble.y - 7}%`,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                <div className="text-[8px] tracking-wider uppercase font-black text-emerald-400 mb-1">AUTOMATIC OCCURRENCE</div>
                <p className="text-[10px] font-mono leading-normal text-stone-200">{activeBubble.msg}</p>
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-emerald-950" />
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* INTERACTIVE INSPECTION MODAL (When map node is clicked) */}
        <AnimatePresence>
          {selectedDevice && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="relative z-20 max-w-5xl mx-auto w-full bg-stone-900 border border-stone-800 rounded-3xl p-5 md:p-6 shadow-2xl text-left select-none relative overflow-hidden"
            >
              {/* Retro digital scanner effect lines */}
              <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[linear-gradient(to_bottom,transparent_92%,rgba(239,68,68,0.3))] bg-[length:100%_4px]" />

              <div className="grid md:grid-cols-12 gap-6 relative z-10 items-stretch">
                
                {/* Visual live stream column */}
                <div className="md:col-span-6 flex flex-col space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold flex items-center gap-1.5 uppercase text-stone-300">
                      <Tv size={14} className="text-rose-500 animate-pulse" />
                      Live Thermal Vision Simulation
                    </span>
                    <span className="text-[9px] bg-red-950 border border-red-800 text-red-400 px-2 py-0.5 rounded uppercase font-black tracking-wider animate-pulse flex items-center gap-1">
                      REC
                    </span>
                  </div>

                  {/* Video Box Placeholder */}
                  <div className="aspect-[4/3] rounded-2xl bg-black border border-stone-800 relative overflow-hidden shadow-inner flex items-center justify-center">
                    {simulatedFootage ? (
                      <>
                        <img 
                          src={simulatedFootage.img} 
                          alt="Thermal Footage Preview"
                          className="w-full h-full object-cover filter saturate-50 brightness-95 grayscale tracking-tighter"
                          referrerPolicy="no-referrer"
                        />
                        {/* Night vision camera overlay filter */}
                        <div className="absolute inset-0 bg-emerald-950/20 mix-blend-color-burn" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                        
                        {/* Camera Info Panel Overlay */}
                        <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur-md p-2.5 rounded-lg border border-stone-850 flex justify-between items-end">
                          <div className="text-[10px] space-y-0.5 font-mono text-left">
                            <div className="text-white font-black uppercase text-xs">{simulatedFootage.title}</div>
                            <p className="text-stone-400 leading-tight pr-5 line-clamp-1">{simulatedFootage.desc}</p>
                          </div>
                          <div className="text-right text-[9px] font-mono shrink-0">
                            <span className="text-stone-500 block">TEMP</span>
                            <span className="text-semibold text-emerald-400 uppercase leading-none font-bold">{simulatedFootage.temp}</span>
                          </div>
                        </div>

                        {/* Centered tracking brackets */}
                        <div className="absolute border border-red-500/80 w-24 h-24 pointer-events-none rounded border-dashed flex items-center justify-center">
                          <span className="text-[7px] bg-red-600 px-1 py-0.5 text-white uppercase font-black tracking-widest leading-none">AUTO FOCUS</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-stone-500 font-mono">Camera Feed Signal Down</span>
                    )}
                  </div>
                </div>

                {/* Sentry Logs & Technical Diagnostic column */}
                <div className="md:col-span-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Diagnostic Title info */}
                    <div className="flex justify-between items-start border-b border-stone-800 pb-3">
                      <div>
                        <span className="text-[9px] font-mono font-bold tracking-widest text-stone-500 uppercase">Interactive Inspection</span>
                        <h3 className="text-lg font-black text-white mt-1 leading-none">{selectedDevice.name} Diagnostic</h3>
                        <p className="text-[11px] text-stone-400 font-mono mt-1.5 font-semibold">
                          Coordinates: X:{selectedDevice.gridX} Y:{selectedDevice.gridY} | Battery: {selectedDevice.battery}%
                        </p>
                      </div>

                      <div className={cn(
                        "p-2.5 rounded-xl border",
                        selectedDevice.type === 'honeypot' ? "bg-rose-950 border-rose-900 text-rose-300" :
                        selectedDevice.type === 'camera' ? "bg-blue-950 border-blue-900 text-blue-300" :
                        "bg-green-950 border-green-900 text-green-300"
                      )}>
                        {selectedDevice.type === 'honeypot' && <Target size={20} />}
                        {selectedDevice.type === 'camera' && <Camera size={20} />}
                        {selectedDevice.type === 'audio' && <Mic size={20} />}
                      </div>
                    </div>

                    {/* Historical Log triggered specifically by that component */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono font-bold text-stone-500 uppercase block">
                        Hardware Historical Log of Events
                      </span>

                      <div className="space-y-2 font-mono text-[11px]">
                        {simulatedDeviceHistory.map((hLog) => (
                          <div key={hLog.id} className="p-2.5 bg-stone-950 rounded-lg border border-stone-850 flex items-start gap-2.5">
                            <span className="text-stone-500 text-[9px] font-bold mt-0.5">{hLog.time}</span>
                            <span className="text-stone-250 leading-relaxed font-semibold">{hLog.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Terminal modal commands */}
                  <div className="flex gap-2.5 justify-end pt-4 border-t border-stone-800 mt-4">
                    <button
                      onClick={() => {
                        setShowEdgeCacheModal(true);
                      }}
                      className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 font-bold text-white rounded-xl text-xs transition-colors flex items-center gap-1.5"
                    >
                      <HardDrive size={14} />
                      Inspect Unuploaded Media
                    </button>
                    <button
                      onClick={() => setSelectedDevice(null)}
                      className="px-4 py-2.5 bg-stone-800 text-stone-400 hover:text-white rounded-xl text-xs font-bold transition-colors border border-stone-750"
                    >
                      Close Stream
                    </button>
                  </div>

                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* EDGE CACHE INTERACTIVE MODAL */}
        <AnimatePresence>
          {showEdgeCacheModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="w-full max-w-4xl bg-stone-900 border border-stone-800 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col text-left max-h-[85vh]"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-stone-800 bg-stone-950 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-xl">
                      <HardDrive size={20} />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-mono font-black tracking-widest text-emerald-400">Raspberry Pi Edge Diagnostic</span>
                      <h2 className="text-xl font-black text-white leading-tight mt-0.5">Local Hardware Media Cache</h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {edgeCacheItems.length > 0 && (
                      <button
                        onClick={handleUplinkAll}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-xs rounded-xl tracking-tight transition-all flex items-center gap-1.5"
                      >
                        <UploadCloud size={14} />
                        Uplink All (+{edgeCacheItems.length * 50} pts)
                      </button>
                    )}
                    <button
                      onClick={() => setShowEdgeCacheModal(false)}
                      className="p-2 hover:bg-stone-800 text-stone-400 hover:text-white rounded-xl transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Info Note block */}
                <div className="px-6 py-3.5 bg-emerald-950/20 border-b border-stone-800/60 flex items-start gap-3 text-xs text-stone-300">
                  <ShieldAlert size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Edge Privacy Policy Compliant:</strong> Face blurring filters and de-identification algorithms are executed locally on the Raspberry Pi prior to cloud transit. No unblurred camper faces or high-definition personal imagery leaves the hardware perimeter.
                  </p>
                </div>

                {/* Cache Grid Content */}
                <div className="flex-grow p-6 overflow-y-auto scrollbar-thin space-y-6">
                  {edgeCacheItems.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                      <div className="w-14 h-14 bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-400 mx-auto border border-emerald-800/40">
                        <Check size={24} />
                      </div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Edge Cache Fully Synchronized</h3>
                      <p className="text-xs text-stone-400 max-w-sm mx-auto leading-relaxed">
                        There are no more unuploaded media packets cached on the hardware. All telemetry stills have been uploaded to the Cloud Archive.
                      </p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {edgeCacheItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-stone-950/60 border border-stone-800 rounded-2xl overflow-hidden flex flex-col justify-between"
                        >
                          {/* Image Box */}
                          <div className="aspect-[16/10] bg-neutral-900 relative overflow-hidden flex items-center justify-center">
                            <img
                              src={item.img}
                              alt={item.title}
                              className={cn(
                                "w-full h-full object-cover select-none filter saturation-50 brightness-90 grayscale hover:scale-105 transition-transform duration-500",
                                item.isHumanTrigger && "blur-md" // Visually blur the camper image directly if it's a person!
                              )}
                              referrerPolicy="no-referrer"
                            />

                            {/* Privacy Badge overlay */}
                            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5 items-start">
                              <span className="px-2 py-0.5 bg-black/85 border border-stone-750 text-[8px] font-mono font-bold text-stone-300 rounded uppercase tracking-wider">
                                {item.device}
                              </span>
                              <span className={cn(
                                "px-2 py-0.5 border text-[8px] font-mono font-black rounded uppercase tracking-wider flex items-center gap-1",
                                item.isHumanTrigger 
                                  ? "bg-rose-950 border-rose-800 text-rose-350" 
                                  : "bg-emerald-950 border-emerald-800 text-emerald-350"
                              )}>
                                <ShieldAlert size={9} />
                                {item.isHumanTrigger ? "Faces Blurred" : "No Human Detected"}
                              </span>
                            </div>

                            {/* Meta size tag overlay */}
                            <span className="absolute bottom-2 right-2 bg-black/75 px-2 py-0.5 rounded text-[8px] font-mono font-bold text-stone-400 uppercase">
                              {item.size}
                            </span>
                          </div>

                          {/* Details & Actions */}
                          <div className="p-4 space-y-4">
                            <div className="flex justify-between items-start">
                              <div className="text-left">
                                <h4 className="text-xs font-black text-white leading-tight uppercase">{item.detectedLabel}</h4>
                                <span className="text-[10px] font-mono text-stone-400 block mt-1">Recorded at {item.timestamp} UTC</span>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-emerald-400">
                                {item.confidence}% match
                              </span>
                            </div>

                            <button
                              onClick={() => handleUplink(item)}
                              className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-800 hover:border-stone-700 font-bold text-xs rounded-xl tracking-tight transition-all flex items-center justify-center gap-1.5"
                            >
                              <UploadCloud size={13} className="text-emerald-400" />
                              Uplink to Cloud Archive (+50 pts)
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer panel */}
                <div className="p-4 border-t border-stone-800 bg-stone-950 flex justify-end shrink-0">
                  <button
                    onClick={() => setShowEdgeCacheModal(false)}
                    className="px-5 py-2 bg-stone-800 text-stone-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-stone-750"
                  >
                    Close Cache View
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>

    </div>
  );
}
