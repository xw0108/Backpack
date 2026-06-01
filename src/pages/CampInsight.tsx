import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database,
  TrendingUp,
  MapPin,
  Award,
  Download,
  Info,
  CheckCircle2,
  Tv,
  Sparkles,
  FileText,
  Bookmark,
  Battery,
  AlertTriangle,
  Moon,
  Compass,
  Zap,
  Network,
  Printer,
  CalendarDays,
  Search,
  Trash2,
  Edit2,
  Save,
  Filter
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { PhotoCapture } from '../types';

interface CampInsightProps {
  photoCaptures: PhotoCapture[];
  setPhotoCaptures: React.Dispatch<React.SetStateAction<PhotoCapture[]>>;
  simulatedScore: number;
  setSimulatedScore: React.Dispatch<React.SetStateAction<number>>;
  selectedBackpack: string;
}

export default function CampInsight({
  photoCaptures,
  setPhotoCaptures,
  simulatedScore,
  setSimulatedScore,
  selectedBackpack
}: CampInsightProps) {
  const [activeTab, setActiveTab] = useState<'cloud-archive' | 'analytics'>('cloud-archive');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  
  // Correction UI helpers
  const [editingCaptureId, setEditingCaptureId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState<string>('');

  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [hoveredCorridor, setHoveredCorridor] = useState<string | null>(null);
  const [chronoMode, setChronoMode] = useState<'moon' | 'weather'>('moon');

  // Compute number of verified images
  const verifiedCount = useMemo(() => {
    return photoCaptures.filter(p => p.verified).length;
  }, [photoCaptures]);

  // Handle Verify Action inside Cloud Archive
  const handleVerify = (id: string) => {
    setPhotoCaptures(prev => prev.map(p => {
      if (p.id === id) {
        if (!p.verified) {
          setSimulatedScore(score => score + 25);
        }
        return { ...p, verified: true };
      }
      return p;
    }));
    setSuccessToast("Citizen record verified! Sighting registered in macro model. (+25 Pts)");
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Handle Custom Animal Reclassification Override
  const handleSaveCorrection = (id: string) => {
    if (!correctionText.trim()) return;
    setPhotoCaptures(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, userCorrection: correctionText, verified: true };
      }
      return p;
    }));
    setEditingCaptureId(null);
    setCorrectionText('');
    setSuccessToast("AI Classification corrected! Camper manual override saved to dataset.");
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Handle Deleting Cloud Copy (Wiping Record)
  const handleDeleteCopy = (id: string) => {
    setPhotoCaptures(prev => prev.filter(p => p.id !== id));
    setSuccessToast("Cloud record copy purged successfully.");
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Filter cloud images by search query and category filters
  const filteredCaptures = useMemo(() => {
    return photoCaptures.filter((pic) => {
      const labelMatch = pic.detectedLabel.toLowerCase().includes(searchQuery.toLowerCase());
      const nodeMatch = pic.nodeName.toLowerCase().includes(searchQuery.toLowerCase());
      const searchOk = labelMatch || nodeMatch;

      if (statusFilter === 'verified') {
        return searchOk && pic.verified;
      }
      if (statusFilter === 'unverified') {
        return searchOk && !pic.verified;
      }
      return searchOk;
    });
  }, [photoCaptures, searchQuery, statusFilter]);

  // Handle Certificate Printing / Export pdf dialog
  const handlePrintCertificate = () => {
    window.print();
    setSuccessToast("Scientific Dossier and Academic Certificate generated! Dispatching printable viewport...");
    setTimeout(() => setSuccessToast(null), 4500);
  };

  // Cross-Camp Eco-Corridor Network Data
  const corridorNodes = [
    { id: 'camp-1', name: 'Whispering Pines (You)', x: 62, y: 35, animals: "Foxes, Deer & Coyotes" },
    { id: 'camp-2', name: 'Camp Redwood Sentry', x: 22, y: 48, animals: "Bears, Deer & Owls" },
    { id: 'camp-3', name: 'Camp Blue Heron Wetlands', x: 55, y: 72, animals: "Herons, Bobcats & raccoons" },
    { id: 'camp-4', name: 'Camp High Desert Sentry', x: 38, y: 55, animals: "Coyotes, Cougars & Hawks" },
    { id: 'camp-5', name: 'Appalachian Ridge Outpost', x: 74, y: 44, animals: "Golden Eagles, Deer & Fox" }
  ];

  // Professional corridor paths
  const corridorPaths = [
    { from: 'camp-1', to: 'camp-5', strength: "High Migratory Flow", risk: "Low Obstruction", label: "Atlantic Flyway Corridor" },
    { from: 'camp-2', to: 'camp-4', strength: "Moderate Flow", risk: "High Freeway Intersect", label: "Great Basin Corridor" },
    { from: 'camp-1', to: 'camp-3', strength: "Robust Flow", risk: "Eco Corridor Stable", label: "Appalachian Wetland Spine" }
  ];

  return (
    <div className="bg-stone-100 min-h-screen pb-20 select-none">
      
      {/* Upper Siding Banner */}
      <div className="bg-stone-900 py-12 px-6 text-white border-b border-stone-800 relative select-text">
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="text-left space-y-2">
            <span className="px-3 py-1 bg-emerald-950 border border-emerald-800 rounded-full text-[9px] uppercase tracking-widest font-black text-emerald-400">
              Academic Cloud Sandbox
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-none text-white">Camp Insight</h2>
            <p className="text-sm text-stone-400 max-w-xl font-medium">
              Analyze macro regional corridors, examine moon-trigger chrono relationships, review predictive battery health forecasts, and review preprint journal reviews.
            </p>
          </div>

          <div className="bg-stone-950 px-5 py-3 rounded-2xl border border-stone-800 shadow-xl flex gap-6 text-xs text-right shrink-0 font-bold select-none">
            <div>
               <p className="text-[9px] text-stone-500 uppercase tracking-widest font-bold">Global Verifications</p>
               <p className="text-lg font-black font-mono text-emerald-400">+{verifiedCount}</p>
            </div>
            <div className="w-px h-8 bg-stone-800" />
            <div>
               <p className="text-[9px] text-stone-500 uppercase tracking-widest font-bold font-sans">Scientific Score</p>
               <p className="text-lg font-black font-mono text-white">+{simulatedScore} pts</p>
            </div>
          </div>
        </div>
      </div>

      {/* TWO SECTIONS INTERACTIVE SWITCHER */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 flex justify-start items-center">
          <button
            id="tab-cloud-archive"
            onClick={() => setActiveTab('cloud-archive')}
            className={cn(
              "px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
              activeTab === 'cloud-archive'
                ? "border-emerald-600 text-stone-900 font-extrabold"
                : "border-transparent text-stone-400 hover:text-stone-700 font-semibold"
            )}
          >
            <Database size={13} className={activeTab === 'cloud-archive' ? "text-emerald-500" : "text-stone-400"} />
            Cloud Media Archive ({photoCaptures.length})
          </button>
          
          <button
            id="tab-professional-analytics"
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "px-6 py-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
              activeTab === 'analytics'
                ? "border-emerald-600 text-stone-900 font-extrabold"
                : "border-transparent text-stone-400 hover:text-stone-700 font-semibold"
            )}
          >
            <TrendingUp size={13} className={activeTab === 'analytics' ? "text-emerald-500" : "text-stone-400"} />
            Professional Research Analytics
          </button>
        </div>
      </div>

      {/* CONDITIONAL SECTION CONTENT */}
      <AnimatePresence mode="wait">
        {activeTab === 'cloud-archive' ? (
          <motion.div
            key="archive-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="max-w-6xl mx-auto px-6 mt-10 space-y-8"
          >
            {/* Section description */}
            <div className="bg-white border border-stone-200 rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
              <div>
                <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-[9px] uppercase font-bold tracking-widest text-emerald-800 rounded-lg inline-flex items-center gap-1 mb-1.5 font-sans">
                  <Database size={10} />
                  Section 1: Data Management
                </span>
                <h3 className="text-xl font-black text-stone-900 tracking-tight">Cloud Media Archive</h3>
                <p className="text-xs text-stone-400 mt-1 font-semibold font-sans">
                  Review telemetry photos uploaded by your active Edge device cluster. Validate AI labels, make manual corrections, or purge copies to maintain the cloud storage footprint.
                </p>
              </div>
              <div className="text-[10px] bg-emerald-950 border border-emerald-800 px-3 py-1.5 font-mono text-emerald-400 font-extrabold rounded-xl shrink-0">
                ACTIVE CLOUD FILES: {photoCaptures.length} Total
              </div>
            </div>

            {successToast && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-250 text-emerald-950 text-xs font-bold rounded-2xl text-center flex items-center justify-center gap-2 animate-pulse shadow-sm font-sans">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                {successToast}
              </div>
            )}

            {/* Toolbar search and filters */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
              <div className="relative w-full sm:w-80">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                  <Search size={14} />
                </span>
                <input
                  id="wildlife-search"
                  type="text"
                  placeholder="Search animal label or sensor node..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
                />
              </div>

              <div className="flex bg-stone-50 p-1 rounded-xl border border-stone-200 text-[10px] font-black shrink-0 w-full sm:w-auto overflow-x-auto justify-center select-none font-sans">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all whitespace-nowrap",
                    statusFilter === 'all' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-700"
                  )}
                >
                  All ({photoCaptures.length})
                </button>
                <button
                  onClick={() => setStatusFilter('verified')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all whitespace-nowrap",
                    statusFilter === 'verified' ? "bg-white text-emerald-700 shadow-sm" : "text-stone-400 hover:text-stone-700"
                  )}
                >
                  Verified ({photoCaptures.filter(p => p.verified).length})
                </button>
                <button
                  onClick={() => setStatusFilter('unverified')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all whitespace-nowrap",
                    statusFilter === 'unverified' ? "bg-white text-amber-700 shadow-sm" : "text-stone-400 hover:text-stone-700"
                  )}
                >
                  Pending ({photoCaptures.filter(p => !p.verified).length})
                </button>
              </div>
            </div>

            {/* Cloud Capture Grid Gallery */}
            {filteredCaptures.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-[2rem] py-16 text-center text-stone-450 italic space-y-2 font-sans">
                <Database size={28} className="mx-auto text-stone-300 mb-1 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-wider">No matching cloud records found</p>
                <p className="text-[11px] text-stone-400">Try adjusting search parameters or trigger some photo uploads in Camp Simulator.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCaptures.map((capture) => {
                  const isEditing = editingCaptureId === capture.id;

                  return (
                    <div
                      key={capture.id}
                      className="bg-white border border-stone-200 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between text-left"
                    >
                      {/* Image Thumbnail with blurred filter overlay */}
                      <div className="aspect-[4/3] bg-neutral-900 relative overflow-hidden flex items-center justify-center select-none">
                        <img
                          src={capture.imageUrl}
                          alt={capture.detectedLabel}
                          className="w-full h-full object-cover filter saturate-50 brightness-95"
                          referrerPolicy="no-referrer"
                        />
                        
                        {/* Status overlays in corner */}
                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start pointer-events-none">
                          <span className="bg-stone-950/85 px-2.5 py-0.5 rounded text-[8px] font-mono font-bold text-stone-200 uppercase tracking-widest border border-stone-850">
                            {capture.nodeName}
                          </span>
                          
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-wider border",
                            capture.verified
                              ? "bg-emerald-950 border-emerald-800 text-emerald-350"
                              : "bg-amber-950 border-amber-800 text-amber-350"
                          )}>
                            {capture.verified ? "✓ Verified Sighting" : "⚠ Pending Verify"}
                          </span>
                        </div>

                        {/* Confidence score */}
                        <span className="absolute bottom-3 right-3 bg-black/80 px-2 py-0.5 border border-stone-750 rounded text-[9px] font-mono font-bold text-emerald-400">
                          {capture.confidence}% Match
                        </span>
                      </div>

                      {/* Info & Micro action controls */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2.5 text-left">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[8px] text-stone-400 font-mono block uppercase font-bold tracking-wider">Edge ML Model Tag</span>
                              <h4 className="text-base font-black text-stone-900 uppercase tracking-tight">
                                {capture.detectedLabel}
                              </h4>
                            </div>
                            
                            <span className="text-[10px] text-stone-400 font-mono font-bold">
                              {capture.time}
                            </span>
                          </div>

                          {/* Dynamic class overrides labels */}
                          {capture.userCorrection ? (
                            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 font-sans">
                              <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                              <span>Corrected to: <strong>{capture.userCorrection}</strong> (Manual Override)</span>
                            </div>
                          ) : (
                            <div className="h-10 shrink-0 select-none block" />
                          )}
                        </div>

                        {/* Interaction bar buttons */}
                        <div className="border-t border-stone-100 pt-3.5 space-y-3 font-sans">
                          {isEditing ? (
                            <div className="flex gap-1.5 items-center">
                              <input
                                type="text"
                                placeholder="Correct classification..."
                                value={correctionText}
                                onChange={(e) => setCorrectionText(e.target.value)}
                                className="flex-grow px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-stone-800 placeholder-stone-400"
                              />
                              <button
                                onClick={() => handleSaveCorrection(capture.id)}
                                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-sm shrink-0"
                                title="Save correction"
                              >
                                <Save size={13} />
                              </button>
                              <button
                                onClick={() => setEditingCaptureId(null)}
                                className="px-2.5 py-2 bg-stone-200 text-stone-600 hover:bg-stone-350 rounded-lg text-[10px] font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {!capture.verified ? (
                                <button
                                  onClick={() => handleVerify(capture.id)}
                                  className="py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-black rounded-lg text-[10px] uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5"
                                >
                                  <CheckCircle2 size={12} />
                                  Verify Sighting
                                </button>
                              ) : (
                                <span className="py-2.5 bg-stone-100 border border-stone-200 text-stone-400 font-extrabold rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5">
                                  ✓ Verified
                                </span>
                              )}

                              <button
                                onClick={() => {
                                  setEditingCaptureId(capture.id);
                                  setCorrectionText(capture.detectedLabel);
                                }}
                                className="py-2.5 bg-stone-50 hover:bg-stone-150 text-stone-700 border border-stone-200 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Edit2 size={12} />
                                Overwrite AI
                              </button>
                            </div>
                          )}

                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => handleDeleteCopy(capture.id)}
                              className="text-[10px] text-stone-400 hover:text-red-600 hover:underline font-bold transition-all flex items-center gap-1"
                            >
                              <Trash2 size={11} />
                              Purge Record Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="analytics-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="max-w-6xl mx-auto px-6 mt-10 space-y-12"
          >
            {/* Row 1: Eco-Corridor & Chrono Analysis Grid */}
            <div className="grid lg:grid-cols-12 gap-8 items-stretch">
              
              {/* ANALYTICS FEATURE 1: Cross-Camp Eco-Corridor Network */}
              <div className="lg:col-span-7 bg-white border border-stone-200 rounded-[2.5rem] p-6 shadow-sm flex flex-col justify-between">
                <div className="space-y-2 text-left">
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                    <Network size={12} className="text-emerald-600 animate-pulse" />
                    Cross-Camp Eco-Corridor Network
                  </span>
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">Macro Migratory Paths</h3>
                  <p className="text-xs text-stone-450 font-semibold leading-relaxed">
                    Calculated regional wild corridors mapped by aggregating fuzzed metadata across associated camps. Hover over connectors to analyze pathway strength.
                  </p>
                </div>

                {/* SVG Corridor Interactive Map */}
                <div className="aspect-[16/10] bg-stone-950 rounded-2xl my-4 relative overflow-hidden border border-stone-850">
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
                  
                  <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none border border-dashed border-stone-900 m-3 rounded-xl">
                    <span className="text-[9px] font-mono tracking-widest text-white uppercase">METADATA CLOUD COORDINATES GRID</span>
                  </div>

                  {/* Render connector lines */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {corridorPaths.map((path, idx) => {
                      const fromNode = corridorNodes.find(n => n.id === path.from);
                      const toNode = corridorNodes.find(n => n.id === path.to);
                      if (!fromNode || !toNode) return null;

                      const isHovered = hoveredCorridor === path.label;

                      return (
                        <g key={idx}>
                          <line
                            x1={`${fromNode.x}%`}
                            y1={`${fromNode.y}%`}
                            x2={`${toNode.x}%`}
                            y2={`${toNode.y}%`}
                            stroke={isHovered ? "#34d399" : "#10b981"}
                            strokeWidth={isHovered ? "3" : "1.5"}
                            strokeDasharray={isHovered ? "none" : "5 5"}
                            className="transition-all duration-300 pointer-events-auto cursor-pointer"
                            onMouseEnter={() => setHoveredCorridor(path.label)}
                            onMouseLeave={() => setHoveredCorridor(null)}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Draw camp coordinate points */}
                  {corridorNodes.map((node) => (
                    <div
                      key={node.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 group"
                      style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    >
                      <div className={cn(
                        "w-3.5 h-3.5 rounded-full border-2 transition-transform duration-300 cursor-help",
                        node.id === 'camp-1' 
                          ? "bg-rose-500 border-white ring-4 ring-rose-300" 
                          : "bg-emerald-600 border-white ring-2 ring-emerald-300 hover:scale-125"
                      )} title={`${node.name}: captures ${node.animals}`} />
                    </div>
                  ))}

                  {/* Corridor Context Card overlay */}
                  <div className="absolute bottom-3 left-3 right-3 bg-black/95 backdrop-blur-md p-3 rounded-lg border border-stone-850 text-[10px] flex justify-between items-center text-left">
                    {hoveredCorridor ? (
                      <>
                        {(() => {
                          const pathDetails = corridorPaths.find(p => p.label === hoveredCorridor);
                          return (
                            <div>
                              <div className="font-mono text-emerald-400 font-bold uppercase">{hoveredCorridor}</div>
                              <span className="text-white font-bold block mt-0.5">{pathDetails?.strength} | Risk: {pathDetails?.risk}</span>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <div>
                        <span className="text-stone-400 font-semibold block">Academic telemetry network active.</span>
                        <span className="text-stone-500 font-mono text-[9px] block">Hover over green paths to analyze migratory statistics.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-stone-500 font-bold uppercase tracking-wider text-left">
                  Fuzzed cloud telemetry matches Whispering Pines to {corridorNodes.length - 1} external regional hotspots.
                </div>
              </div>

              {/* ANALYTICS FEATURE 2: Multi-Modal Chrono-Analysis Banner */}
              <div className="lg:col-span-5 bg-white border border-stone-200 rounded-[2.5rem] p-6 shadow-sm flex flex-col justify-between text-left">
                <div className="space-y-2">
                  <span className="px-2.5 py-0.5 bg-sky-50 text-sky-850 text-[10px] font-bold rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 font-sans">
                    <CalendarDays size={12} className="text-sky-700" />
                    Multi-Modal Chrono-Analysis
                  </span>
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">Weather vs. Diurnal Cycles</h3>
                  <p className="text-xs text-stone-450 font-semibold leading-relaxed font-sans">
                    Cross-referencing telemetry triggers with ambient weather datasets. Toggle parameters below to see historical nocturnal shift trends.
                  </p>
                </div>

                {/* Toggle Switch dials */}
                <div className="flex bg-stone-100 p-1.5 rounded-lg border border-stone-200/50 my-4 text-[10px] font-bold select-none font-sans">
                  <button
                    onClick={() => setChronoMode('moon')}
                    className={cn(
                      "flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1",
                      chronoMode === 'moon' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-700"
                    )}
                  >
                    <Moon size={11} />
                    Lunar Full Cycles
                  </button>
                  <button
                    onClick={() => setChronoMode('weather')}
                    className={cn(
                      "flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1",
                      chronoMode === 'weather' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-700"
                    )}
                  >
                    <TrendingUp size={11} />
                    Rainfall Trigger Rate
                  </button>
                </div>

                {/* Custom Visual Column Bar Chart mimicking academic output */}
                <div className="space-y-3.5 select-none bg-stone-50 p-4 rounded-2xl border border-stone-150 text-left font-sans">
                  {chronoMode === 'moon' ? (
                    <>
                      <span className="text-[9px] font-mono text-stone-400 uppercase font-black block">Triggers Count on Full Moon Nights vs Crescent</span>
                      
                      <div className="space-y-2.5 pt-2 text-xs">
                        <div>
                          <div className="flex justify-between text-[11px] font-semibold text-stone-700 mb-1">
                            <span>New Moon Period (High Dark Cover)</span>
                            <span className="font-bold text-stone-950">42 Triggers/Night (Nocturnal Peak)</span>
                          </div>
                          <div className="h-6 w-full bg-stone-200/50 rounded-lg overflow-hidden border border-stone-200 flex">
                            <div className="h-full bg-emerald-700" style={{ width: '84%' }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-semibold text-stone-700 mb-1">
                            <span>Waxing Gibbous / Full Moon (Bright Sky)</span>
                            <span className="font-bold text-stone-950">12 Triggers/Night (Attenuated)</span>
                          </div>
                          <div className="h-6 w-full bg-stone-200/50 rounded-lg overflow-hidden border border-stone-200 flex">
                            <div className="h-full bg-stone-400/80" style={{ width: '24%' }} />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-[9px] font-mono text-stone-400 uppercase font-black block">Anomalous triggers during damp Precipitation</span>
                      
                      <div className="space-y-2.5 pt-2 text-xs">
                        <div>
                          <div className="flex justify-between text-[11px] font-semibold text-stone-700 mb-1">
                            <span>Dry Weather Periods</span>
                            <span className="font-bold text-stone-950">15 General Captures/Day</span>
                          </div>
                          <div className="h-6 w-full bg-stone-200/50 rounded-lg overflow-hidden border border-stone-200 flex">
                            <div className="h-full bg-sky-700" style={{ width: '30%' }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-semibold text-stone-700 mb-1">
                            <span>Moist Precipitation (Heavy Rain)</span>
                            <span className="font-bold text-stone-950">48 Captures/Day (High Amphibian Event)</span>
                          </div>
                          <div className="h-6 w-full bg-stone-200/50 rounded-lg overflow-hidden border border-stone-200 flex">
                            <div className="h-full bg-emerald-700" style={{ width: '96%' }} />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <p className="text-[9px] text-stone-400 font-mono text-left block mt-1">
                  Data synchronized under IEEE meteorological calibration.
                </p>
              </div>

            </div>

            {/* Row 2: ANALYTICS FEATURE 3: Predictive Deployment Maintenance Banner */}
            <div className="bg-white border border-stone-200 rounded-[2.5rem] p-6 shadow-sm text-left font-sans">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-100 pb-4">
                <div className="space-y-1">
                  <span className="px-2.5 py-0.5 bg-orange-750/10 text-orange-850 text-[10px] font-bold rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 border border-orange-500/20">
                    <AlertTriangle size={12} className="text-orange-600 animate-pulse" />
                    Predictive Deployment Maintenance HUD
                  </span>
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">Active Hardware Health & Canopy Interference Forecasts</h3>
                </div>
                
                <span className="text-[10px] bg-stone-100 border border-stone-200 px-3 py-1 font-mono font-bold text-stone-600 rounded-lg uppercase tracking-wide">
                  Last Diagnostic: 4m ago
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-6 pt-5">
                {/* Advice col 1 */}
                <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-stone-800">Creek-Facing Cam</span>
                    <span className="text-orange-700 hover:text-orange-900 text-[10px] font-extrabold flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 uppercase">
                      ADVISORY
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-slate-700">
                    <h4 className="text-xs font-black text-stone-900 uppercase">Canopy Obstruction Forecast</h4>
                    <p className="text-[11px] leading-relaxed text-stone-500 font-semibold">
                      Foliage thickness rose from 12% to 42% in tree-canopy grid. Solar panel battery recharge delta expects total drain below 25% in 8 days.
                    </p>
                  </div>

                  <div className="border-t border-stone-200/60 pt-2 text-[10px] font-mono text-emerald-800 font-bold">
                    ⚠️ Recommendation: Shift hardware 3m South-East to clear leaf cover.
                  </div>
                </div>

                {/* Advice col 2 */}
                <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-stone-800">Audio Sentinel #1</span>
                    <span className="text-emerald-700 hover:text-emerald-950 text-[10px] font-extrabold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">
                      NOMINAL
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-slate-700">
                    <h4 className="text-xs font-black text-stone-900 uppercase">LoRa Signal Strength RSSI</h4>
                    <p className="text-[11px] leading-relaxed text-stone-500 font-semibold">
                      Local radio path backhaul maintains high efficiency (-72dBm). No dense wet pine obstruction. Batter decay rate stable at 0.5%/day.
                    </p>
                  </div>

                  <div className="border-t border-stone-200/60 pt-2 text-[10px] font-mono text-stone-400 font-bold">
                    ✓ Action: Keep current position. Stable for next 90 days.
                  </div>
                </div>

                {/* Advice col 3 */}
                <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-stone-800">Scattered Bait Node</span>
                    <span className="text-amber-700 hover:text-amber-900 text-[10px] font-extrabold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 uppercase">
                      ATTENTION
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-slate-700">
                    <h4 className="text-xs font-black text-stone-900 uppercase">Scent bait Reservoir depletion</h4>
                    <p className="text-[11px] leading-relaxed text-stone-500 font-semibold">
                      Scout telemetry registers scent payload concentration of bait is at 45%. Scent flow rate indicates rodent intrusion exhaustion.
                    </p>
                  </div>

                  <div className="border-t border-stone-200/60 pt-2 text-[10px] font-mono text-amber-800 font-bold font-semibold">
                    ⚠️ Action: Refill bait capsule at camp workspace in next 3 campsite sessions.
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: PDF Preprint & Academic-style Report Cover Panel */}
            <div className="bg-white border border-stone-200 rounded-[2.5rem] p-6 shadow-md text-left">
              
              {/* Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-100 pb-5 font-sans">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1 font-mono">
                    <FileText size={13} />
                    Cloud-Science Preprint & Accreditation
                  </span>
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">Ecology Citizen Science Report Generator</h3>
                  <p className="text-xs text-stone-450 font-semibold font-sans">Download, review, or print a professional PDF certificate & academic journal digest.</p>
                </div>

                <button
                  id="download-report-btn"
                  onClick={handlePrintCertificate}
                  className="px-5 py-3 bg-emerald-950 hover:bg-emerald-800 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 select-none self-stretch md:self-auto justify-center"
                >
                  <Printer size={14} className="text-emerald-400" />
                  Download Full Scientific Report & Certificate
                </button>
              </div>

              {successToast && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-250 text-emerald-950 text-xs font-semibold rounded-xl mt-4 text-center flex items-center justify-center gap-2 animate-pulse">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  {successToast}
                </div>
              )}

              {/* ACADEMIC-STYLE REPORT PREVIEW PANEL */}
              <div className="mt-8 border border-stone-300 rounded-2xl bg-stone-100 p-4 md:p-8 flex flex-col lg:flex-row gap-6 relative shadow-inner">
                
                {/* COLUMN A: LaTeX Preprint Article Paper Review Mockup */}
                <div className="flex-1 bg-white border border-stone-350 shadow-md p-6 max-w-xl mx-auto rounded-xl relative text-stone-900 font-serif">
                  {/* Paper stamp Watermark */}
                  <div className="absolute top-4 right-4 text-[8px] font-mono text-stone-400 font-black tracking-widest uppercase">
                    PREPRINT ID: WhisperingPines-{selectedBackpack}
                  </div>

                  {/* Journal Title */}
                  <div className="text-center space-y-1 border-b border-stone-300 pb-4 font-serif">
                    <h4 className="text-[10px] font-bold text-stone-400 tracking-wider font-sans uppercase">Proceedings of the K-12 Wilderness Telemetry Symposium</h4>
                    <h2 className="text-sm font-black text-stone-950 uppercase leading-tight font-serif text-left">A Non-Invasive Concentric IoT Deployment for Nocturnal Mammalian Corridors</h2>
                    <p className="text-[9px] text-stone-600 font-mono italic font-sans text-center">
                      Camp Instructor Advisor: Whispering Pines Youth Academics | Serial: {selectedBackpack}
                    </p>
                  </div>

                  {/* Abstract */}
                  <div className="pt-4 text-[10px] space-y-2 text-stone-850">
                    <span className="font-bold uppercase text-[9px] block text-stone-900 font-sans">Abstract:</span>
                    <p className="leading-relaxed text-justify italic">
                      This scientific paper reports the ecological tracking calculations retrieved via the Ecology Sentry Backpack kit during nighttime simulations in Canyon Meadow. Real-time RSSI backup pathways connected an array of three distributed edge devices. Machine classifying delta weights suggest stable animal migrations near regional corridors. All telemetry and face blurs were computed locally to protect participant privacy constraints.
                    </p>
                  </div>

                  {/* Dual-column simulation */}
                  <div className="grid grid-cols-2 gap-4 pt-5 border-t border-stone-200 mt-5 text-[9px] leading-relaxed text-justify text-stone-700">
                    <div className="space-y-2">
                      <span className="font-bold uppercase text-[8px] text-stone-900 font-sans block">I. Introduction & Siting Layout</span>
                      <p>
                        Effective wildlife monitoring requires balancing attractant location constraints with visual crossfire lines. The integration of 920MHz radio backhauls prevents hardware loss in high foliage density regions.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <span className="font-bold uppercase text-[8px] text-stone-900 font-sans block">II. Machine Learning Outcomes</span>
                      <p>
                        Campers processed verified wildlife telemetry triggers. Convolutional layers yielded an accuracy delta gain of { (verifiedCount * 2.5).toFixed(1) }% for native White-tailed Deer classifications.
                      </p>
                    </div>
                  </div>
                </div>

                {/* COLUMN B: Printable Academic Diploma/Certificate Mockup */}
                <div className="flex-1 bg-stone-50 border-[6px] border-double border-stone-350 shadow-md p-6 max-w-xl mx-auto rounded-xl relative text-stone-900 text-center font-serif flex flex-col justify-between">
                  
                  <div className="space-y-2 pt-2">
                    <div className="text-[9px] font-mono tracking-widest text-[#065f46] font-bold uppercase leading-none font-sans">Accredited Cadet Siding</div>
                    <h4 className="text-xl font-bold font-serif text-[#022c22] uppercase">Ecologist Junior Certificate</h4>
                    <p className="text-[10px] text-stone-500 italic">Granted to Whispering Pines campers for telemetry validations.</p>
                  </div>

                  <div className="w-24 h-px bg-stone-300 mx-auto my-3" />

                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-stone-400 font-bold block uppercase tracking-widest font-sans">CADET MEMBER AWARDED TO</span>
                    <span className="text-base font-extrabold text-[#065f46] italic underline decoration-stone-300 underline-offset-4 font-serif">
                      {verifiedCount > 0 ? "Whispering Pines Sentry Campers" : "Independent Eco Scout Cadet"}
                    </span>
                  </div>

                  <p className="text-[10px] text-stone-500 font-sans leading-relaxed max-w-sm mx-auto font-medium mt-3">
                    Calibrated sensor arrays for backpack serial <strong>{selectedBackpack}</strong>, accumulating <strong>+{simulatedScore} points</strong> and reinforcing edge-CNN wildlife models.
                  </p>

                  {/* Footer grid */}
                  <div className="grid grid-cols-3 gap-2 pt-4 text-left font-sans text-[8px] font-semibold text-stone-800">
                    <div className="bg-white p-2 rounded border border-stone-200">
                      <span className="text-stone-400 uppercase tracking-widest block text-[7px]">SCORE</span>
                      <span className="font-bold text-stone-900 text-xs">+{simulatedScore} pts</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-stone-200">
                      <span className="text-stone-400 uppercase tracking-widest block text-[7px]">CLASSIFIES</span>
                      <span className="font-bold text-stone-900 text-xs">{verifiedCount} nodes</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-stone-200">
                      <span className="text-stone-400 uppercase tracking-widest block text-[7px]">PRIVACY APPROVED</span>
                      <span className="text-[#065f46] font-bold block text-[8px] mt-0.5">✓ 100% BLURRED</span>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="flex justify-between items-end pt-5 max-w-xs mx-auto font-serif text-[8px] text-stone-500">
                    <div>
                      <span className="italic block leading-none">campfire_advisor</span>
                      <p className="uppercase text-[6px] font-sans font-black tracking-wider text-stone-450 block mt-1 font-sans">DIRECTOR</p>
                    </div>
                    <div>
                      <span className="italic block leading-none">secure_system_03</span>
                      <p className="uppercase text-[6px] font-sans font-black tracking-wider text-stone-450 block mt-1 font-sans">IOT BACKEND SECURE</p>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
