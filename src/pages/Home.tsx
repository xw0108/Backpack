import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  LogOut, 
  Sparkles, 
  Activity,
  Upload,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  Download
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Page } from '../App';
import { UserSession, Device } from '../types';

interface HomeProps {
  currentUser: UserSession | null;
  onNavigate: (page: Page) => void;
  onLogin: (username: string, serialInput?: string, initDevices?: Device[]) => void;
  onRegister: (serial: string, parsedDevices?: Device[]) => void;
  onLogout: () => void;
}

export default function Home({ currentUser, onNavigate, onLogin, onRegister, onLogout }: HomeProps) {
  const [serialInput, setSerialInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Temporary successful parsing preview state
  const [parsedPayload, setParsedPayload] = useState<{
    serialCode: string;
    deviceName: string;
    devices: Device[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addBackpackInputRef = useRef<HTMLInputElement>(null);

  // Download Sample Hardware JSON anchor
  const handleDownloadSampleJSON = () => {
    const sampleData = {
      deviceId: "BP-5801-R3",
      deviceName: "Redwood Canopy Sentry",
      sensors: [
        { id: "hp-re", type: "honeypot", name: "Lure Bait Unit", gridX: 52, gridY: 48, rotation: 0, battery: 100 },
        { id: "cam-re-1", type: "camera", name: "Canyon Overlook Eye", gridX: 40, gridY: 42, rotation: 120, battery: 94 },
        { id: "cam-re-2", type: "camera", name: "Meadow Track Eye", gridX: 64, gridY: 60, rotation: 300, battery: 89 },
        { id: "aud-re-1", type: "audio", name: "Sentinel Acoustics", gridX: 50, gridY: 32, rotation: 180, battery: 76 }
      ]
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(sampleData, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", "backpack_config.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Safe JSON Config Parser
  const parseAndVerifyJSON = (text: string): { serialCode: string; deviceName: string; parsedDevices: Device[] } => {
    const data = JSON.parse(text);
    if (!data) {
      throw new Error("File content is completely empty.");
    }

    const deviceIdRaw = data.deviceId || data.id || `BP-${Math.floor(1000 + Math.random() * 9000)}`;
    const deviceName = data.deviceName || data.name || 'Imported Sentry Kit';

    // Hash algorithm to derive deterministic physical Serial Code
    const hashStr = `${deviceIdRaw}-${deviceName}`;
    let hash = 0;
    for (let i = 0; i < hashStr.length; i++) {
      hash = (hash << 5) - hash + hashStr.charCodeAt(i);
      hash |= 0;
    }
    const serialCode = `BP-${Math.abs(hash).toString(36).toUpperCase().substring(0, 4)}-${deviceIdRaw.slice(-4).toUpperCase()}`;

    // Map sensors safely
    const incomingSensors = data.sensors || data.devices || [];
    const parsedDevices: Device[] = incomingSensors.map((s: any, idx: number) => {
      const allowedTypes = ['honeypot', 'camera', 'audio'];
      const type = allowedTypes.includes(s.type) ? s.type : 'camera';
      const mapNames = {
        honeypot: 'Scents Bait Unit',
        camera: 'Visual Capture Sentry',
        audio: 'Sentinel Radio Acoustics'
      };
      return {
        id: s.id || `${type}-${Date.now()}-${idx}`,
        type: type,
        gridX: s.gridX !== undefined ? Number(s.gridX) : (35 + idx * 15),
        gridY: s.gridY !== undefined ? Number(s.gridY) : (35 + idx * 10),
        rotation: s.rotation !== undefined ? Number(s.rotation) : (type === 'camera' ? 180 : 0),
        battery: s.battery !== undefined ? Number(s.battery) : 100,
        status: 'online',
        name: s.name || mapNames[type]
      };
    });

    return { serialCode, deviceName, parsedDevices };
  };

  // Handle uploaded file stream
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isAppending: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setErrorMsg('');
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { serialCode, deviceName, parsedDevices } = parseAndVerifyJSON(text);

        if (isAppending) {
          onRegister(serialCode, parsedDevices);
          setParsedPayload(null);
        } else {
          setParsedPayload({
            serialCode,
            deviceName,
            devices: parsedDevices
          });
        }
      } catch (err: any) {
        setErrorMsg(`Invalid JSON file format: ${err?.message || 'Please check sensors & deviceId attributes.'}`);
      }
    };
    reader.readAsText(file);
  };

  // Handle Drag-And-Drop behaviors
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent, isAppending: boolean = false) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMsg('');

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.json')) {
      setErrorMsg("Sentry workspace only supports .json physical configuration files.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { serialCode, deviceName, parsedDevices } = parseAndVerifyJSON(text);

        if (isAppending) {
          onRegister(serialCode, parsedDevices);
          setParsedPayload(null);
        } else {
          setParsedPayload({
            serialCode,
            deviceName,
            devices: parsedDevices
          });
        }
      } catch (err: any) {
        setErrorMsg(`Invalid JSON file format: ${err?.message || 'Check your keys.'}`);
      }
    };
    reader.readAsText(file);
  };

  // Quick Direct Entry Handler
  const handleEnterSystem = () => {
    if (parsedPayload) {
      onLogin(parsedPayload.deviceName, parsedPayload.serialCode, parsedPayload.devices);
      setParsedPayload(null);
    }
  };

  // Manual code form submission (previously Serial Login)
  const handleManualSerialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serialInput.trim()) {
      onLogin('', serialInput.trim().toUpperCase());
    }
  };

  // Pre-loaded Simulation Bypass
  const handleLoadDemoBypass = () => {
    const demoPayload = {
      serialCode: "BP-REWD-CANOPY",
      deviceName: "Demo Redwood Canopy Sentry",
      devices: [
        { id: "hp-re", type: "honeypot" as const, name: "Lure Bait Unit", gridX: 50, gridY: 50, rotation: 0, battery: 100, status: "online" as const },
        { id: "cam-re-1", type: "camera" as const, name: "Canyon Overlook Eye", gridX: 42, gridY: 42, rotation: 135, battery: 94, status: "online" as const },
        { id: "cam-re-2", type: "camera" as const, name: "Meadow Track Eye", gridX: 58, gridY: 58, rotation: 315, battery: 89, status: "online" as const },
        { id: "aud-re-1", type: "audio" as const, name: "Sentinel Acoustics", gridX: 50, gridY: 30, rotation: 180, battery: 76, status: "online" as const }
      ]
    };
    setParsedPayload(demoPayload);
  };

  return (
    <div className="bg-stone-50 min-h-screen">
      {/* Hero & File Access Station Section */}
      <section className="relative py-16 md:py-24 border-b border-stone-200 bg-white overflow-hidden">
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #064e3b 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
        
        <div className="max-w-6xl mx-auto px-6 relative z-10 grid md:grid-cols-12 gap-12 items-center">
          
          {/* Left Hero Column */}
          <div className="md:col-span-7 space-y-6 text-left">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3.5 py-1.5 rounded-full text-emerald-800 text-[10px] font-black uppercase tracking-widest animate-pulse"
            >
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Decentralized Hardware Gateway v3.0
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-black tracking-tighter text-emerald-950 leading-[0.95]"
            >
              Plug & Play <br/>
              <span className="text-stone-300">Wildlife Telemetry</span> <br/>
              Active Backpacks
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base md:text-lg text-stone-500 font-medium leading-relaxed max-w-xl"
            >
              Completely decentralized local access. Upload `.json` device descriptors exported directly from physical kits to dynamically load virtual coordinates, battery ranges, and LoRa sentinel maps instantly.
            </motion.p>

            {/* Account state overlay */}
            {currentUser && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 bg-stone-50 border border-stone-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-xl"
              >
                <div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 font-mono">Active Local Session</div>
                  <h3 className="text-base font-black text-stone-900 leading-tight">
                    Session: <span className="text-emerald-700 font-mono">{currentUser.username}</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Managing <span className="font-bold text-stone-800">{currentUser.backpacks.length} physical kit layouts</span>.
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('control')}
                  className="px-6 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0"
                >
                  Enter Workspace
                  <ArrowRight size={14} />
                </button>
              </motion.div>
            )}
          </div>

          {/* Right Access UI Station Card */}
          <div className="md:col-span-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border-2 border-stone-200 rounded-[2.5rem] shadow-2xl p-6 md:p-8 relative"
            >
              {/* Card Accent Lines */}
              <div className="absolute top-4 left-6 text-[9px] font-mono text-stone-300 tracking-wider font-bold">SECURE PORTAL [LOCAL-ONLY]</div>
              <div className="absolute top-4 right-6 w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />

              <div className="mt-4 mb-6 text-left">
                <h3 className="text-xl font-black text-stone-900 tracking-tight">Access Station</h3>
                <p className="text-xs text-stone-450 font-medium">Verify your decentralized counselor parameters</p>
              </div>

              {/* Login State Toggles */}
              {!currentUser ? (
                <div className="space-y-4 text-left">
                  
                  {/* JSON File Dropzone */}
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, false)}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center",
                      isDragging 
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 scale-[1.02]" 
                        : "bg-stone-50 border-stone-200 hover:border-emerald-400 hover:bg-stone-50/50 text-stone-500"
                    )}
                  >
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleFileUpload(e, false)}
                      accept=".json"
                      className="hidden"
                    />
                    <div className="p-3 bg-white border border-stone-150 rounded-xl text-emerald-800 shadow-sm mb-3">
                      <Upload size={20} className="stroke-[2.5]" />
                    </div>
                    <span className="text-xs font-black text-stone-800 tracking-tight">Upload Backpack JSON</span>
                    <span className="text-[10px] text-stone-400 mt-1 leading-snug">
                      Drag configuration file here or click to browse
                    </span>
                  </div>

                  {/* Sample Downloads & Fast Simulation Bypass */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadSampleJSON}
                      className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-[10px] font-black tracking-tight transition-all flex items-center justify-center gap-1 border border-stone-200"
                    >
                      <Download size={12} className="text-stone-600" />
                      Get Sample JSON
                    </button>

                    <button
                      type="button"
                      onClick={handleLoadDemoBypass}
                      className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100/70 text-emerald-900 rounded-xl text-[10px] font-black tracking-tight transition-all flex items-center justify-center gap-1 border border-emerald-100"
                    >
                      <Sparkles size={12} className="text-emerald-700" />
                      Quick Simulator Kit
                    </button>
                  </div>

                  {/* Parse Results Preview Container */}
                  <AnimatePresence>
                    {parsedPayload && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="bg-emerald-50 border border-emerald-250 p-4 rounded-2xl space-y-3 shadow-md text-left"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-850 mt-0.5 shrink-0">
                            <CheckCircle2 size={16} />
                          </div>
                          <div>
                            <span className="text-[9px] font-mono tracking-wider text-emerald-600 font-bold uppercase">READY TO ACTIVATE</span>
                            <h4 className="text-xs font-black text-emerald-950 mt-0.5 leading-none">{parsedPayload.deviceName}</h4>
                            <p className="text-[10px] text-emerald-800 font-bold mt-2 font-mono">
                              Generated Key: <span className="bg-emerald-100/80 px-1 py-0.5 border border-emerald-200 text-emerald-900 rounded">{parsedPayload.serialCode}</span>
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={handleEnterSystem}
                          className="w-full py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white font-black text-xs rounded-xl tracking-tight transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20"
                        >
                          Enter System
                          <ArrowRight size={14} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {errorMsg && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-red-900 text-[11px]"
                    >
                      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-650" />
                      <span>{errorMsg}</span>
                    </motion.div>
                  )}

                  {/* Divider */}
                  <div className="relative flex items-center justify-center my-4">
                    <div className="w-full border-t border-stone-150" />
                    <span className="absolute px-3 bg-white text-[9px] font-bold text-stone-400 tracking-wider uppercase font-mono">Or Use Serial Code</span>
                  </div>

                  {/* Serial Entry Bypass (Stateless Recall) */}
                  <form onSubmit={handleManualSerialSubmit} className="space-y-3">
                    <div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Code (e.g. BP-2026-X8)"
                          value={serialInput}
                          onChange={(e) => setSerialInput(e.target.value)}
                          className="flex-grow px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-stone-400 font-mono tracking-wider text-stone-800 placeholder-stone-400"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-black tracking-tight transition-colors"
                        >
                          Start
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-4 text-left">
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                      <Activity size={20} className="animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">Authenticated Sentry Session</p>
                      <p className="text-xs text-stone-600 leading-tight">
                        Operator: <span className="font-mono font-bold text-stone-800">{currentUser.username}</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => onNavigate('control')}
                      className="w-full py-3 bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      Go to Control Center
                      <ArrowRight size={16} />
                    </button>
                    <button
                      onClick={() => onNavigate('simulator')}
                      className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      Start Live Feed
                    </button>
                  </div>

                  <div className="border-t border-stone-150 pt-4 flex items-center justify-between">
                    <span className="text-xs font-black text-stone-700">Multi-Device Grid</span>
                    <button
                      onClick={onLogout}
                      className="text-xs text-red-500 font-black flex items-center gap-1 hover:text-red-700 transition-colors"
                    >
                      <LogOut size={14} />
                      Log out
                    </button>
                  </div>

                  {/* Multi-Device JSON Uploader */}
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, true)}
                    onClick={() => addBackpackInputRef.current?.click()}
                    className={cn(
                      "p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-150",
                      isDragging 
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800" 
                        : "bg-stone-50 border-stone-200 hover:border-emerald-300 hover:bg-stone-50/50 text-stone-500"
                    )}
                  >
                    <input 
                      type="file"
                      ref={addBackpackInputRef}
                      onChange={(e) => handleFileUpload(e, true)}
                      accept=".json"
                      className="hidden"
                    />
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-stone-800">
                      <FileJson size={14} className="text-emerald-700 font-bold" />
                      Upload JSON to Add Backpack
                    </div>
                    <p className="text-[9px] text-stone-400 mt-0.5">Loads hardware offsets and auto-registers a new Serial Code</p>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-red-50 border border-red-250 rounded-xl text-red-955 text-[10px] flex items-center gap-1.5 font-bold">
                      <AlertTriangle size={13} className="text-red-700" />
                      {errorMsg}
                    </div>
                  )}

                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

    </div>
  );
}
