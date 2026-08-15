/**
 * Home — landing and pairing.
 *
 * The multi-sensor backpack import (JSON layouts, per-node placement) is gone
 * for the MVP: the deployable unit is one drone, so pairing is just naming it.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Camera,
  Hand,
  LogOut,
  Plane,
  Radio,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Page } from '../App';
import { DroneUnit, UserSession } from '../types';

interface HomeProps {
  currentUser: UserSession | null;
  drone: DroneUnit;
  onNavigate: (page: Page) => void;
  onPair: (serial: string, name?: string) => void;
  onLogout: () => void;
}

const CAPABILITIES = [
  {
    icon: <Hand size={18} />,
    title: 'Fly by gesture',
    detail:
      'Your webcam feeds a hand-gesture model in the browser; recognised gestures become flight commands.',
  },
  {
    icon: <Sliders size={18} />,
    title: 'One command map',
    detail:
      'Gesture-to-command mapping is read from actions.json, so the web app and the original script stay in step.',
  },
  {
    icon: <ShieldCheck size={18} />,
    title: 'Armed on purpose',
    detail:
      'Connecting is not consent to fly. Commands are refused until you arm, and the panic stop always lands.',
  },
];

export default function Home({ currentUser, drone, onNavigate, onPair, onLogout }: HomeProps) {
  const [serial, setSerial] = useState('');
  const [name, setName] = useState('');

  const handlePair = (e: React.FormEvent) => {
    e.preventDefault();
    onPair(serial || drone.serial, name);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-stone-100">
      {/* Hero */}
      <div className="bg-emerald-950 text-white">
        <div className="max-w-5xl mx-auto px-6 py-14 md:py-20">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-[10px] uppercase font-mono font-black tracking-widest text-emerald-400">
              Ecology Backpacks · MVP
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight mt-2 leading-[1.1]">
              Gesture-controlled
              <br />
              drone flight, from the browser.
            </h1>
            <p className="mt-5 text-emerald-100/80 max-w-xl leading-relaxed">
              One aircraft, one camera, one page. Show a gesture to your webcam and the
              command goes to the drone — no separate desktop tooling.
            </p>

            {currentUser ? (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => onNavigate('control')}
                  className="flex items-center gap-2 bg-white text-emerald-950 px-5 py-3 rounded-xl font-black text-sm hover:bg-emerald-50 active:scale-95 transition-all"
                >
                  <Hand size={16} />
                  Open Gesture Control
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => onNavigate('manage')}
                  className="flex items-center gap-2 border border-emerald-700 text-emerald-100 px-5 py-3 rounded-xl font-bold text-sm hover:bg-emerald-900 active:scale-95 transition-all"
                >
                  <Plane size={16} />
                  Drone Manager
                </button>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 text-emerald-300/70 px-3 py-3 rounded-xl text-xs font-bold hover:text-emerald-100 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            ) : (
              <p className="mt-8 text-xs font-mono text-emerald-300/70">
                Pair a unit below to begin.
              </p>
            )}
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        {/* Capabilities */}
        <div className="grid md:grid-cols-3 gap-4">
          {CAPABILITIES.map(c => (
            <div
              key={c.title}
              className="p-5 bg-white rounded-2xl border border-stone-200 shadow-sm"
            >
              <div className="inline-flex p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 mb-3">
                {c.icon}
              </div>
              <p className="font-black text-stone-900 text-sm">{c.title}</p>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">{c.detail}</p>
            </div>
          ))}
        </div>

        {/* Pairing / current unit */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-sm">
            <span className="text-[9px] uppercase font-mono font-black tracking-widest text-emerald-700">
              {currentUser ? 'Paired unit' : 'Pair a unit'}
            </span>
            <h2 className="text-lg font-black text-stone-900 mt-1">
              {currentUser ? drone.name : 'Add your drone'}
            </h2>

            <form onSubmit={handlePair} className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Serial
                </span>
                <input
                  value={serial}
                  onChange={e => setSerial(e.target.value)}
                  placeholder={drone.serial}
                  className="mt-1 w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:border-emerald-600 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Display name <span className="text-stone-400 normal-case">(optional)</span>
                </span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={drone.name}
                  className="mt-1 w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-600 outline-none"
                />
              </label>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-emerald-900 text-white py-3 rounded-xl font-black text-sm hover:bg-emerald-800 active:scale-95 transition-all"
              >
                {currentUser ? 'Update unit' : 'Pair and continue'}
                <ArrowRight size={15} />
              </button>
            </form>

            <p className="mt-3 text-[10px] font-mono text-stone-400 leading-relaxed">
              Pairing records the unit in this browser. The flight link itself is made from
              the control page.
            </p>
          </div>

          {/* Composition */}
          <div className="p-6 bg-white rounded-2xl border border-stone-200 shadow-sm">
            <span className="text-[9px] uppercase font-mono font-black tracking-widest text-emerald-700">
              Composition
            </span>
            <h2 className="text-lg font-black text-stone-900 mt-1">What is deployed</h2>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50">
                <div className="p-2 rounded-lg bg-white border border-stone-200 text-emerald-800">
                  <Plane size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-stone-900 text-sm leading-none">{drone.name}</p>
                  <p className="text-[10px] font-mono text-stone-500 mt-1 truncate">
                    {drone.model} · {drone.serial}
                  </p>
                </div>
              </div>

              <div className="pl-5 ml-4 border-l border-stone-200">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50">
                  <div className="p-1.5 rounded-lg bg-white border border-stone-200 text-sky-700">
                    <Camera size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-stone-800 text-xs leading-none">
                      {drone.camera.name}
                    </p>
                    <p className="text-[9px] font-mono text-stone-500 mt-1">
                      sub-unit · not wired into the UI yet
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <Radio size={13} className="text-amber-700 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-900 leading-relaxed">
                Recognition runs on your <strong>webcam</strong>, not the drone's camera. The
                onboard camera is a separate feed, reachable from the backend but not shown
                here yet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
