import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Map as MapIcon, 
  Target, 
  Camera, 
  Mic, 
  Info, 
  Trash2, 
  Play,
  RotateCw,
  AlertCircle
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { cn } from '@/src/lib/utils';

// Types
type DeviceType = 'honeypot' | 'camera' | 'audio';

interface Device {
  id: string;
  type: DeviceType;
  position: google.maps.LatLngLiteral;
  rotation: number;
}

interface AIConfig {
  water: boolean;
  forest: boolean;
  topography: boolean;
  ranPrediction: boolean;
}

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export default function Sandbox() {
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    water: false,
    forest: false,
    topography: false,
    ranPrediction: false
  });
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeTab, setActiveTab] = useState<'ai' | 'devices'>('ai');

  const addDevice = (type: DeviceType) => {
    const id = `${type}-${Date.now()}`;
    // Center of map or default
    const newDevice: Device = {
      id,
      type,
      position: { lat: 45.4215, lng: -75.6972 }, // Default: Ottawa
      rotation: type === 'camera' ? 0 : 0
    };
    setDevices(prev => [...prev, newDevice]);
    setActiveTab('devices');
  };

  const updateDevicePosition = (id: string, position: google.maps.LatLngLiteral) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, position } : d));
  };

  const updateDeviceRotation = (id: string, rotation: number) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, rotation } : d));
  };

  const removeDevice = (id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
  };

  // Deployment Validation Logic
  const validation = useMemo(() => {
    const honeypots = devices.filter(d => d.type === 'honeypot');
    const cameras = devices.filter(d => d.type === 'camera');
    const audios = devices.filter(d => d.type === 'audio');

    if (honeypots.length === 0) return { status: 'none', message: 'Place a Honeypot to start' };
    
    // Check if cameras point to honeypot
    // For this prototype, we'll check proximity and if 2+ cameras exist near honeypot
    const h = honeypots[0];
    const nearCameras = cameras.filter(c => {
       const dist = Math.sqrt(Math.pow(c.position.lat - h.position.lat, 2) + Math.pow(c.position.lng - h.position.lng, 2));
       return dist < 0.0005; // Tight proximity
    });

    const hasAudioCoverage = audios.some(a => {
       const dist = Math.sqrt(Math.pow(a.position.lat - h.position.lat, 2) + Math.pow(a.position.lng - h.position.lng, 2));
       return dist < 0.002; // Wider ring
    });

    if (nearCameras.length >= 2 && hasAudioCoverage) {
       return { status: 'optimal', message: 'Optimal Bullseye Deployment' };
    }

    return { status: 'suboptimal', message: 'Adjust for better coverage' };
  }, [devices]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-stone-100">
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-white border-r border-stone-200 flex flex-col z-20 shrink-0">
        <div className="p-6 border-b border-stone-100">
          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Planning Engine</h3>
          <h2 className="text-xl font-black text-emerald-900 tracking-tight flex items-center gap-2">
            Workspace Sandbox
          </h2>
        </div>

        <div className="flex-grow overflow-y-auto p-5 space-y-6">
          {/* Tabs */}
          <div className="flex bg-stone-100 p-1 rounded-xl">
             <button 
               onClick={() => setActiveTab('ai')}
               className={cn("flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all", activeTab === 'ai' ? "bg-white shadow-sm text-emerald-900" : "text-stone-400 hover:text-stone-600")}
             >
                AI Layer
             </button>
             <button 
               onClick={() => setActiveTab('devices')}
               className={cn("flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all", activeTab === 'devices' ? "bg-white shadow-sm text-emerald-900" : "text-stone-400 hover:text-stone-600")}
             >
                Assets
             </button>
          </div>

          {activeTab === 'ai' ? (
            <div className="space-y-6">
               <div className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Step 1: Suitability Predictor</h3>
                  {[
                    { id: 'water', label: 'Water Proximity Buffer', desc: 'Riparian zone hotspots' },
                    { id: 'forest', label: 'Forest Edge Analysis', desc: 'Transition corridors' },
                    { id: 'topography', label: 'Terrain Funnels', desc: 'Natural wildlife chokepoints' }
                  ].map(layer => (
                    <label key={layer.id} className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-emerald-300 cursor-pointer bg-white transition-all group">
                       <input 
                         type="checkbox" 
                         checked={aiConfig[layer.id as keyof AIConfig] as boolean}
                         onChange={(e) => setAiConfig(prev => ({ ...prev, [layer.id]: e.target.checked }))}
                         className="w-4 h-4 accent-emerald-600 cursor-pointer" 
                       />
                       <div>
                          <div className="text-sm font-bold text-stone-900">{layer.label}</div>
                          <div className="text-[10px] text-stone-400 font-bold uppercase tracking-tight">{layer.desc}</div>
                       </div>
                    </label>
                  ))}
               </div>
               
               <button 
                 onClick={() => setAiConfig(prev => ({ ...prev, ranPrediction: true }))}
                 className="w-full py-4 bg-emerald-900 text-white rounded-xl font-bold text-sm shadow-md hover:bg-emerald-800 transition-all flex items-center justify-center gap-2"
               >
                 <RotateCw size={16} className={cn(aiConfig.ranPrediction && "animate-spin-slow")} />
                 Run AI Site Prediction
               </button>

               {aiConfig.ranPrediction && (
                 <motion.div 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl"
                 >
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">Success</span>
                    </div>
                    <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                       Optimal hotspots identified. Deploy near orange thermal markers for max encounter rate.
                    </p>
                 </motion.div>
               )}
            </div>
          ) : (
            <div className="space-y-6">
               <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Step 2: Deployment Assets</h3>
               <div className="grid grid-cols-1 gap-3">
                  {[
                    { type: 'honeypot', icon: Target, label: 'Honeypot Bait', desc: 'Central Target Zone', color: 'emerald' },
                    { type: 'camera', icon: Camera, label: 'Camera Trap', desc: 'Cone: 90° | Range: 5m', color: 'stone' },
                    { type: 'audio', icon: Mic, label: 'Audio Sentinel', desc: 'Radius: 30m Microphones', color: 'stone' }
                  ].map(item => (
                    <button
                      key={item.type}
                      onClick={() => addDevice(item.type as DeviceType)}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-xl border transition-all text-left group hover:shadow-md",
                        item.color === 'emerald' ? "bg-emerald-50 border-emerald-200" : "bg-white border-stone-200"
                      )}
                    >
                       <div className={cn(
                         "p-2.5 rounded-lg shadow-sm text-white",
                         item.color === 'emerald' ? "bg-emerald-600" : "bg-stone-800"
                       )}>
                          <item.icon size={20} strokeWidth={2.5} />
                       </div>
                       <div>
                          <div className={cn("text-sm font-bold", item.color === 'emerald' ? "text-emerald-900" : "text-stone-950")}>{item.label}</div>
                          <div className={cn("text-[10px] font-bold uppercase tracking-tight", item.color === 'emerald' ? "text-emerald-700" : "text-stone-400")}>{item.desc}</div>
                       </div>
                    </button>
                  ))}
               </div>
            </div>
          )}
        </div>

        <div className="mt-auto p-4 border-t border-stone-100">
           <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
              <p className="text-[10px] uppercase font-bold text-stone-400 mb-1 tracking-widest">Active Location</p>
              <p className="text-sm font-black text-stone-900 tracking-tight">Whispering Pines Sector B-4</p>
              <p className="text-[11px] text-stone-500 font-medium">GPS: 45.4215° N, 75.6972° W</p>
           </div>
        </div>
      </aside>

      {/* Map Area */}
      <main className="flex-grow relative bg-emerald-950 overflow-hidden">
         <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #065f46 1px, transparent 0)', backgroundSize: '40px 40px' }} />
         
         {!hasValidKey && (
            <div className="absolute inset-0 z-10 bg-emerald-950/80 backdrop-blur-sm flex items-center justify-center p-8 text-center text-white">
               <div className="max-w-md space-y-6">
                  <div className="mx-auto w-16 h-16 bg-white/10 border border-white/20 rounded-full flex items-center justify-center">
                     <MapIcon size={32} className="text-emerald-300" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight leading-none uppercase">Geo Engine Disconnected</h2>
                  <p className="text-emerald-100/70 font-medium">
                     Please add a <strong>Google Maps API Key</strong> to the project secrets for terrain analysis.
                  </p>
                  <button 
                    onClick={() => {}} 
                    className="px-8 py-4 bg-emerald-600 text-white rounded-xl font-bold w-full hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-500/20"
                  >
                    Enter Simulation Mode
                  </button>
               </div>
            </div>
         )}
         
         <div className="w-full h-full relative cursor-crosshair">
            {/* Real Map (Hidden if no key) */}
            <div className="absolute inset-0 grayscale contrast-125 opacity-30">
               {hasValidKey ? (
                  <APIProvider apiKey={API_KEY}>
                    <Map
                      defaultCenter={{ lat: 45.4215, lng: -75.6972 }}
                      defaultZoom={15}
                      mapId="ECOLOGY_SANDBOX_ID"
                      mapTypeId="satellite"
                      disableDefaultUI
                      className="w-full h-full"
                    />
                  </APIProvider>
               ) : (
                  <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2626&auto=format&fit=crop')] bg-cover bg-center" />
               )}
            </div>

            {/* AI Hotspot Overlays */}
            <AnimatePresence>
              {aiConfig.ranPrediction && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 pointer-events-none flex items-center justify-center"
                >
                   <div className="w-[400px] h-[400px] bg-orange-500/20 rounded-full blur-[100px] animate-pulse" />
                   <div className="w-[250px] h-[250px] bg-amber-400/30 rounded-full blur-[60px] ml-20 mt-10" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Draggable Interaction Layer */}
            <div className="absolute inset-0 z-30">
               {devices.map((device) => (
                 <DraggableDevice 
                    key={device.id} 
                    device={device} 
                    onUpdate={updateDevicePosition}
                    onRotate={updateDeviceRotation}
                    onRemove={removeDevice}
                 />
               ))}
            </div>

            {/* Status Panel Overlay */}
            <div className="absolute top-6 right-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-white flex flex-col gap-3 shadow-2xl z-40 min-w-[200px]">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-100">Live Map Engine</span>
               </div>
               <div className="flex flex-col gap-2">
                  <div className="flex justify-between gap-8 text-[10px] font-bold uppercase tracking-tight text-emerald-200/50">
                    <span>Signal Strength</span>
                    <span className="font-mono text-white">92%</span>
                  </div>
                  <div className="flex justify-between gap-8 text-[10px] font-bold uppercase tracking-tight text-emerald-200/50">
                    <span>Node Density</span>
                    <span className="font-mono text-emerald-300">Optimal</span>
                  </div>
               </div>
            </div>

            {/* Validation Dashboard */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center bg-white rounded-[2rem] shadow-2xl p-5 gap-8 border border-emerald-100 min-w-[600px] z-40">
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 leading-none">Deployment Health</span>
                  <div className="flex items-center gap-3">
                     <span className="text-3xl font-black text-emerald-900 leading-none tracking-tighter">98%</span>
                     <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-widest border border-emerald-100">+12 Potential</span>
                  </div>
               </div>
               <div className="h-12 w-px bg-stone-100"></div>
               <div className="flex-1 flex items-center gap-5">
                  <div className={cn(
                    "p-3 rounded-2xl flex items-center justify-center transition-colors",
                    validation.status === 'optimal' ? "bg-emerald-50 text-emerald-600" : "bg-stone-50 text-stone-400"
                  )}>
                     {validation.status === 'optimal' ? <CheckCircle2 size={24} strokeWidth={2.5} /> : <AlertCircle size={24} strokeWidth={2.5} />}
                  </div>
                  <div>
                     <p className="text-sm font-black text-stone-900 tracking-tight leading-none mb-1 uppercase">{validation.message}</p>
                     <p className="text-xs text-stone-400 font-bold uppercase tracking-tighter">
                        {validation.status === 'optimal' ? "Cameras intersecting at target." : "Increase node density."}
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </main>
    </div>
  );
}

interface DraggableDeviceProps {
  device: Device;
  onUpdate: (id: string, position: google.maps.LatLngLiteral) => void;
  onRotate: (id: string, rotation: number) => void;
  onRemove: (id: string) => void;
  key?: React.Key;
}

function DraggableDevice({ device, onUpdate, onRotate, onRemove }: DraggableDeviceProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      className="absolute cursor-grab active:cursor-grabbing w-16 h-16 flex items-center justify-center group"
      style={{
        left: '50%',
        top: '50%',
      }}
    >
      {/* Device Icon */}
      <div className={cn(
        "z-50 p-2 rounded-full border-2 shadow-xl transition-all relative",
        device.type === 'honeypot' ? "bg-red-500 border-red-700 text-white scale-125" :
        device.type === 'camera' ? "bg-blue-600 border-blue-800 text-white" :
        "bg-green-600 border-green-800 text-white"
      )}>
        {device.type === 'honeypot' && <Target size={24} />}
        {device.type === 'camera' && <Camera size={20} />}
        {device.type === 'audio' && <Mic size={20} />}

        {/* Action Menu (Visible on Hover) */}
        {!isDragging && (
           <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-nature-950 p-1.5 rounded-lg border border-white/20">
              {device.type === 'camera' && (
                <button 
                  onClick={() => onRotate(device.id, (device.rotation + 45) % 360)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <RotateCw size={14} />
                </button>
              )}
              <button 
                onClick={() => onRemove(device.id)}
                className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
              >
                <Trash2 size={14} />
              </button>
           </div>
        )}
      </div>

      {/* Visual Renderings */}
      {/* 1. Camera Cone of Vision (90 degrees) */}
      {device.type === 'camera' && (
        <svg 
          className="absolute pointer-events-none transition-transform"
          style={{ transform: `rotate(${device.rotation}deg)` }}
          width="400" height="400" viewBox="0 0 400 400"
        >
          <path 
            d="M200,200 L400,0 L400,400 Z" 
            fill="currentColor"
            className="text-blue-500/20"
          />
        </svg>
      )}

      {/* 2. Audio Zone Halo (Circular Gradient) */}
      {device.type === 'audio' && (
        <div 
          className="absolute w-80 h-80 rounded-full border border-green-500/30 pointer-events-none"
          style={{
             background: 'radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0) 70%)'
          }}
        />
      )}

      {/* Label */}
      <div className={cn(
        "absolute -bottom-6 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity",
        device.type === 'honeypot' ? "text-red-700" :
        device.type === 'camera' ? "text-blue-700" :
        "text-green-700"
      )}>
        {device.type}
      </div>
    </motion.div>
  );
}
