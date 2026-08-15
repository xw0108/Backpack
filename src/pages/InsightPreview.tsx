/**
 * InsightPreview — deliberately honest placeholder.
 *
 * The previous Insight page presented species classifications, verification
 * scores and export tooling for data the system does not collect. For the MVP
 * it states what is actually recorded today, and marks the rest as upcoming
 * rather than mocking it up.
 */

import React from 'react';
import { motion } from 'motion/react';
import { BarChart3, Camera, Clock, Hand, Plane, Sparkles } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Page } from '../App';

interface InsightPreviewProps {
  onNavigate: (page: Page) => void;
}

/** What the running system genuinely produces right now. */
const AVAILABLE_TODAY = [
  {
    icon: <Hand size={16} />,
    title: 'Gesture recognition events',
    detail:
      'Every recognised gesture, its confidence and the exact command it resolved to, streamed live during a session.',
  },
  {
    icon: <Plane size={16} />,
    title: 'Flight command log',
    detail:
      'Which commands reached the aircraft, which were refused and why — travel bounds, cooldown, or piloting authority.',
  },
  {
    icon: <Clock size={16} />,
    title: 'Session state',
    detail:
      'Tracked displacement per axis and the remaining travel budget, held for the duration of a session.',
  },
];

const UPCOMING = [
  {
    icon: <BarChart3 size={16} />,
    title: 'Persisted session history',
    detail: 'Sessions are in-memory today; nothing is written to disk when the backend stops.',
  },
  {
    icon: <Camera size={16} />,
    title: 'Onboard camera capture',
    detail:
      'Stills, recording and the live stream are reachable from the flight library but not yet surfaced.',
  },
  {
    icon: <Sparkles size={16} />,
    title: 'Automated analysis',
    detail: 'Classification and reporting over collected footage.',
  },
];

export default function InsightPreview({ onNavigate }: InsightPreviewProps) {
  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto bg-stone-900 text-stone-100">
      <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4"
        >
          <div className="p-3 bg-amber-950 border border-amber-800 text-amber-400 rounded-2xl shrink-0">
            <BarChart3 size={22} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-black tracking-widest text-amber-400">
              Preview — not yet available
            </span>
            <h1 className="text-2xl font-black text-white leading-tight mt-1">Insight</h1>
            <p className="text-sm text-stone-400 mt-2 leading-relaxed max-w-2xl">
              Analysis and reporting are not part of this release. The flight side is what
              works end to end today, so this page lists what the system genuinely records
              rather than showing figures it cannot produce.
            </p>
          </div>
        </motion.div>

        <Section title="Recorded today" tone="emerald" items={AVAILABLE_TODAY} />
        <Section title="Planned" tone="stone" items={UPCOMING} />

        <div className="p-5 rounded-2xl border border-stone-800 bg-stone-900/60">
          <p className="text-sm text-stone-300 font-bold">Looking for live data?</p>
          <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
            Gesture events and the command log stream in real time on the control page while
            a session is running.
          </p>
          <button
            onClick={() => onNavigate('control')}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-500/50 bg-violet-950/40 text-violet-300 text-sm font-black hover:bg-violet-900/60 active:scale-95 transition-all"
          >
            <Hand size={15} />
            Open Gesture Control
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'emerald' | 'stone';
  items: Array<{ icon: React.ReactNode; title: string; detail: string }>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            tone === 'emerald' ? 'bg-emerald-400' : 'bg-stone-600'
          )}
        />
        <h2 className="text-[10px] uppercase font-mono font-black tracking-widest text-stone-400">
          {title}
        </h2>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {items.map(item => (
          <div
            key={item.title}
            className={cn(
              'p-4 rounded-2xl border',
              tone === 'emerald'
                ? 'bg-emerald-950/20 border-emerald-900/60'
                : 'bg-stone-900/60 border-stone-800'
            )}
          >
            <div
              className={cn(
                'inline-flex p-2 rounded-lg border mb-2.5',
                tone === 'emerald'
                  ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
                  : 'bg-stone-950 border-stone-700 text-stone-500'
              )}
            >
              {item.icon}
            </div>
            <p className="font-black text-white text-sm leading-tight">{item.title}</p>
            <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
