import React from 'react';
import { Backpack, Map, Zap, Database, User } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Page } from '../App';

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export default function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Backpack },
    { id: 'sandbox', label: 'Planning Sandbox', icon: Map },
    { id: 'feed', label: 'Citizen Science Feed', icon: Zap },
    { id: 'insights', label: 'Camp Insights', icon: Database },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white text-stone-900 border-b border-stone-200 shrink-0 h-16 flex items-center justify-between px-6">
      <div 
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => onNavigate('home')}
      >
        <div className="bg-emerald-900 p-2 rounded-lg group-hover:bg-emerald-800 transition-colors">
          <Backpack size={20} className="text-white" />
        </div>
        <span className="font-bold text-xl tracking-tight text-emerald-900">Ecology Backpacks</span>
      </div>

      <div className="hidden md:flex items-center gap-8">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as Page)}
            className={cn(
              "text-sm font-medium transition-all relative pb-1",
              currentPage === item.id 
                ? "text-emerald-700 font-bold border-b-2 border-emerald-700" 
                : "text-stone-400 hover:text-stone-600"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-stone-400 bg-stone-50 px-3 py-1.5 rounded-full border border-stone-200 tracking-widest uppercase">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Systems Active
        </div>
        <button className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 hover:border-emerald-300 transition-colors">
          <User size={18} className="text-emerald-900" />
        </button>
      </div>
    </nav>
  );
}
