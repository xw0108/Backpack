import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  LogOut, 
  Sparkles, 
  Activity 
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Page } from '../App';
import { UserSession } from '../types';

interface HomeProps {
  currentUser: UserSession | null;
  onNavigate: (page: Page) => void;
  onLogin: (username: string, serialInput?: string) => void;
  onRegister: (serial: string) => void;
  onLogout: () => void;
}

export default function Home({ currentUser, onNavigate, onLogin, onRegister, onLogout }: HomeProps) {
  const [usernameInput, setUsernameInput] = useState('');
  const [serialInput, setSerialInput] = useState('');
  const [regSerialInput, setRegSerialInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [simulatedPurchaseSuccess, setSimulatedPurchaseSuccess] = useState(false);
  const [newlyGeneratedSerial, setNewlyGeneratedSerial] = useState('');

  const handleDemoLogin = () => {
    onLogin('advisor_spruce');
  };

  const handleSerialLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serialInput.trim()) {
      onLogin('', serialInput);
    }
  };

  const handleUsernameLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      onLogin(usernameInput.trim());
    }
  };

  const triggerSimulatedPurchase = () => {
    // Generate a random high quality backpack key like BP-2026-F9
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];
    const randomNum = Math.floor(Math.random() * 9) + 1;
    const serial = `BP-2026-${randomLetter}${randomNum}`;
    
    setNewlyGeneratedSerial(serial);
    setRegSerialInput(serial);
    setSimulatedPurchaseSuccess(true);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (regSerialInput.trim()) {
      onRegister(regSerialInput.trim());
      setSimulatedPurchaseSuccess(false);
      setRegSerialInput('');
    }
  };



  return (
    <div className="bg-stone-50 min-h-screen">
      {/* Hero & Interactive Access Station Section */}
      <section className="relative py-16 md:py-24 border-b border-stone-200 bg-white overflow-hidden">
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #064e3b 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
        
        <div className="max-w-6xl mx-auto px-6 relative z-10 grid md:grid-cols-12 gap-12 items-center">
          
          {/* Left Hero Pitch Column */}
          <div className="md:col-span-7 space-y-6 text-left">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3.5 py-1.5 rounded-full text-emerald-800 text-[10px] font-black uppercase tracking-widest"
            >
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              Camp Counselor IoT Workspace v2.0
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-black tracking-tighter text-emerald-950 leading-[0.95]"
            >
              Wildlife Monitoring <br/>
              <span className="text-stone-300">Simplified for</span> <br/>
              K-12 Camp Seasons
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base md:text-lg text-stone-500 font-medium leading-relaxed max-w-xl"
            >
              Ecology Backpacks equips your summer counselors with edge-cameras, 
              honeypot baits, and LoRa sentinel mics. Assist kids to complete drag-and-drop wildlife traps and swipe-validate nocturnal citizen science files!
            </motion.p>

            {/* Dynamic Status Dashboard if User is Logged In */}
            {currentUser && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 bg-stone-50 border border-stone-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-xl"
              >
                <div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Active Accounts Overview</div>
                  <h3 className="text-base font-black text-stone-900">
                    Welcome back, <span className="text-emerald-700">{currentUser.username}</span>!
                  </h3>
                  <p className="text-xs text-stone-500">
                    You have <span className="font-bold text-emerald-800">{currentUser.backpacks.length} Backpack Kit Serials</span> assigned.
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
              <div className="absolute top-4 left-6 text-[9px] font-mono text-stone-300 tracking-wider">SECURE PORTAL 00F2</div>
              <div className="absolute top-4 right-6 w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />

              <div className="mt-4 mb-6">
                <h3 className="text-xl font-black text-stone-900 tracking-tight">Camp Sentry Portal</h3>
                <p className="text-xs text-stone-400">Unlock counselor dashboard & equipment sync</p>
              </div>

              {/* Login State Toggles */}
              {!currentUser ? (
                <div className="space-y-4">
                  {/* Option A: Quick Demo Access (Recommended) */}
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 py-1 px-2.5 bg-emerald-200 text-emerald-800 font-black text-[8px] uppercase tracking-wider rounded-bl-xl">
                      RECOMMENDED
                    </div>
                    <p className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-emerald-600" />
                      Counselor Demo Login
                    </p>
                    <p className="text-[11px] text-emerald-700/80 leading-relaxed mb-3">
                      Simulate instantly as head advisor managing 2 active IoT backpack deployments.
                    </p>
                    <button
                      onClick={handleDemoLogin}
                      className="w-full py-2 bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl tracking-tight transition-colors shadow-md"
                    >
                      Login as Counselor
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="relative flex items-center justify-center my-4">
                    <div className="w-full border-t border-stone-200" />
                    <span className="absolute px-3 bg-white text-[10px] font-bold text-stone-400 tracking-wider">OR ENTRY DETAILS</span>
                  </div>

                  {/* Serial Login Form */}
                  <form onSubmit={handleSerialLoginSubmit} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">
                        Use Serial Code Login
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. BP-2026-X8"
                          value={serialInput}
                          onChange={(e) => setSerialInput(e.target.value)}
                          className="flex-grow px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600 font-mono tracking-wider text-stone-800 placeholder-stone-400"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          Login
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Register Backpack Serial Flow Activation */}
                  <div className="pt-2 text-center">
                    <button
                      onClick={() => setIsRegistering(!isRegistering)}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-bold underline underline-offset-4 decoration-emerald-200"
                    >
                      {isRegistering ? "Hide Registration Siding" : "Generate / Register a New Backpack Code"}
                    </button>
                  </div>

                  {/* Expanded Backpack Registration Simulation */}
                  <AnimatePresence>
                    {isRegistering && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-t border-stone-100 pt-3 mt-3 space-y-3"
                      >
                        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                          <p className="text-[11px] text-stone-500 mb-2">
                            Simulate acquiring an additional kit (Camera Trap x2, Audio Sentinel x1). 
                          </p>
                          <button
                            type="button"
                            onClick={triggerSimulatedPurchase}
                            className="text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 px-3.5 py-1.5 rounded-lg transition-colors inline-block"
                          >
                            Simulate Kit Registry
                          </button>
                        </div>

                        {(simulatedPurchaseSuccess || newlyGeneratedSerial) && (
                          <form onSubmit={handleRegisterSubmit} className="space-y-2 animate-fade-in">
                            <p className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                              Success! Assigned Code: <span className="font-mono bg-emerald-100 px-1 py-0.5 rounded text-emerald-900 font-bold">{newlyGeneratedSerial}</span>
                            </p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Bind Serial Code"
                                value={regSerialInput}
                                onChange={(e) => setRegSerialInput(e.target.value)}
                                className="flex-grow px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 font-mono"
                              />
                              <button
                                type="submit"
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all"
                              >
                                Redeem Asset
                              </button>
                            </div>
                          </form>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                      <Activity size={20} className="animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-stone-400">Secure Token Active</p>
                      <p className="text-xs text-stone-500 leading-tight">
                        Working as <span className="font-bold text-stone-800">{currentUser.username}</span>
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
                      Start Live Live Feed
                    </button>
                  </div>

                  <div className="border-t border-stone-100 pt-3 relative flex items-center justify-between">
                    <button
                      onClick={() => {
                        setIsRegistering(!isRegistering);
                      }}
                      className="text-xs text-emerald-800 font-bold hover:underline"
                    >
                      Add Another Backpack ID
                    </button>
                    <button
                      onClick={onLogout}
                      className="text-xs text-red-500 font-semibold flex items-center gap-1 hover:text-red-700 transition-colors"
                    >
                      <LogOut size={14} />
                      Log out
                    </button>
                  </div>

                  {/* Register Backpack Flow expanded under profile */}
                  <AnimatePresence>
                    {isRegistering && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-t border-stone-100 pt-3 space-y-3"
                      >
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Enter Code (e.g. BP-2026-N4)"
                            value={regSerialInput}
                            onChange={(e) => setRegSerialInput(e.target.value)}
                            className="flex-grow px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono"
                          />
                          <button
                            onClick={() => {
                              if (regSerialInput.trim()) {
                                onRegister(regSerialInput.trim());
                                setRegSerialInput('');
                                setIsRegistering(false);
                              }
                            }}
                            className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold"
                          >
                            Bind
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={triggerSimulatedPurchase}
                          className="text-[10px] text-orange-600 font-bold underline uppercase"
                        >
                          Generate Random Free Test Serial
                        </button>
                        {newlyGeneratedSerial && (
                          <p className="text-[10px] text-stone-500">
                            Pre-allocated serial ready: <span className="font-mono text-stone-900 font-bold">{newlyGeneratedSerial}</span>
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

    </div>
  );
}
