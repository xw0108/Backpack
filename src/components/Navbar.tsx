import React from 'react';
import { Backpack, User, LogOut } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Page } from '../App';
import { UserSession } from '../types';

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  currentUser: UserSession | null;
  onLogout: () => void;
}

export default function Navbar({ currentPage, onNavigate, currentUser, onLogout }: NavbarProps) {
  const navItems = [
    { id: 'home', label: 'Home', subtitle: 'Camp Portal' },
    { id: 'control', label: 'Control Center', subtitle: 'Deployment Status' },
    { id: 'simulator', label: 'Camp Simulator', subtitle: 'Live Site Twin' },
    { id: 'insights', label: 'Camp Insight', subtitle: 'Research Hub' },
  ];

  return (
    <nav className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm sticky top-0">
      {/* Brand Logo */}
      <div 
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => onNavigate('home')}
      >
        <div className="bg-emerald-900 p-2 rounded-lg group-hover:bg-emerald-800 transition-colors">
          <Backpack size={20} className="text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg tracking-tight text-emerald-900 leading-none">Ecology Backpacks</span>
          <span className="text-[9px] text-emerald-600 font-black tracking-widest uppercase">Citizen IoT Project</span>
        </div>
      </div>

      {/* Navigation Headers */}
      <div className="hidden md:flex gap-8 items-center h-full">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as Page)}
              className={cn(
                "relative h-16 flex flex-col justify-center items-center px-1 border-b-2 transition-all duration-200",
                isActive 
                  ? "border-emerald-700 text-emerald-700 font-bold" 
                  : "border-transparent text-stone-400 hover:text-stone-600 font-medium"
              )}
            >
              <span className="text-sm tracking-tight">{item.label}</span>
              <span className="text-[9px] font-medium tracking-tight opacity-75">{item.subtitle}</span>
            </button>
          );
        })}
      </div>

      {/* User Status Block */}
      <div className="flex items-center gap-4">
        {currentUser ? (
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-bold text-stone-800">{currentUser.username}</span>
              <span className="text-[9px] font-mono text-emerald-600 font-bold uppercase tracking-wider">
                {currentUser.backpacks.length} Backpacks
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 shadow-inner">
                <User size={18} className="text-emerald-900" />
              </div>
              <button 
                onClick={onLogout}
                className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-red-500 transition-colors"
                title="Log out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => onNavigate('home')}
            className="text-xs font-bold bg-emerald-900 text-white px-4 py-2 rounded-xl hover:bg-emerald-800 transition-all"
          >
            Access Portal
          </button>
        )}
      </div>
    </nav>
  );
}
