import React from 'react';
import { motion } from 'motion/react';
import { Brain, Target, Shield, ArrowRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface HomeProps {
  onStart: () => void;
}

export default function Home({ onStart }: HomeProps) {
  const features = [
    {
      icon: Brain,
      title: "AI Habitat Prediction",
      description: "Multi-Criteria Overlay Analysis automatically identifies potential wildlife hotspots based on water, vegetation, and terrain.",
      color: "bg-orange-500"
    },
    {
      icon: Target,
      title: "Bullseye Deployment",
      description: "Simplified concentric ring methodology ensures your traps and sensors are positioned for maximum overlapping coverage.",
      color: "bg-blue-500"
    },
    {
      icon: Shield,
      title: "K-12 Privacy First",
      description: "Edge computing via Raspberry Pi handles real-time face blurring locally. We never upload student PII to the cloud.",
      color: "bg-green-500"
    }
  ];

  return (
    <div className="bg-stone-50 min-h-screen">
      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden border-b border-stone-200 bg-white">
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #064e3b 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
        
        <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-4 py-1.5 rounded-full text-emerald-800 text-[10px] font-bold uppercase tracking-widest mb-8"
          >
            <span className="bg-emerald-500 w-2 h-2 rounded-full animate-ping" />
            2026 Camp Season Registration Open
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-8xl font-black tracking-tighter text-emerald-950 mb-8 leading-[0.9]"
          >
            Plug & Play <br/>
            Wildlife Monitoring <br/>
            <span className="text-stone-300">for K-12 Camps</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-stone-600 max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
          >
            Deployment simplified. AI-assisted site selection and drag-and-drop planning 
            designed for the next generation of ecologists.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button 
              onClick={onStart}
              className="px-10 py-4 bg-emerald-900 text-white rounded-xl font-bold text-lg flex items-center gap-3 hover:bg-emerald-800 transition-all shadow-xl shadow-emerald-900/10 group"
            >
              Start Planning
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
            </button>
            <button className="px-10 py-4 bg-white text-stone-900 border border-stone-200 rounded-xl font-bold text-lg flex items-center gap-2 hover:bg-stone-50 transition-all shadow-sm">
              Watch Demo
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + idx * 0.1 }}
              className="bg-white p-10 rounded-[2rem] border border-stone-200 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1"
            >
              <div className="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-900 mb-8 border border-emerald-100">
                <feature.icon size={28} />
              </div>
              <h3 className="text-2xl font-black text-stone-900 mb-4 tracking-tight">{feature.title}</h3>
              <p className="text-stone-500 font-medium leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Quick Visual Section */}
      <section className="pb-24 max-w-6xl mx-auto px-6">
        <div className="bg-emerald-950 rounded-[3rem] p-12 md:p-20 text-white flex flex-col md:flex-row items-center gap-16 overflow-hidden relative border border-emerald-900">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          
          <div className="flex-1 space-y-8 relative z-10">
            <div className="inline-flex py-1 px-3 bg-emerald-800 rounded-full text-[10px] uppercase font-bold tracking-widest text-emerald-300 border border-emerald-700">
              Fleet Management
            </div>
            <h2 className="text-5xl font-black leading-[0.9] tracking-tighter">
              Ready to rent <br/>
              your Backpack?
            </h2>
            <p className="text-emerald-200/70 text-lg font-medium leading-relaxed max-w-md">
              Each kit comes pre-loaded with a Camera Trap, Audio Sentinel, 
              and the AI-site deployment guide.
            </p>
            <button className="px-8 py-3 bg-emerald-500 text-emerald-950 rounded-xl font-bold flex items-center gap-3 hover:bg-emerald-400 transition-all">
              Browse Inventory
              <ArrowRight size={20} />
            </button>
          </div>
          
          <div className="flex-1 relative w-full">
            <div className="aspect-square bg-emerald-900/50 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-emerald-800 flex items-center justify-center ring-1 ring-white/10">
                <div className="grid grid-cols-2 gap-4 w-full">
                   {[1,2,3,4].map(i => (
                     <div key={i} className="h-24 bg-emerald-800/40 rounded-xl border border-emerald-700/50 border-dashed" />
                   ))}
                </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
