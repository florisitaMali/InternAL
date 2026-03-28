'use client';

import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import Logo from './Logo';

interface DashboardProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const Dashboard: React.FC<DashboardProps> = ({ title, children, actions }) => {
  return (
    <div className="flex-1 ml-72 min-h-screen flex flex-col bg-[#F9FAFB]">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-8 flex items-center justify-between">
        <div className="flex items-center gap-8 flex-1">
          <Logo size="sm" showText={false} className="md:hidden" />
          <div className="hidden md:flex relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search anything..." 
              suppressHydrationWarning
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              suppressHydrationWarning
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all relative"
            >
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
          <div className="h-8 w-px bg-slate-200 mx-2"></div>
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-slate-900">John Doe</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administrator</div>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 border border-slate-200">
              <User size={20} />
            </div>
          </div>
          {actions && <div className="ml-4">{actions}</div>}
        </div>
      </header>

      <main className="p-10 max-w-7xl w-full mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Manage your internship lifecycle and track progress.</p>
        </header>
        <div className="space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
