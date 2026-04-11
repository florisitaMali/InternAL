'use client';

import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import Logo from './Logo';

interface DashboardProps {
  title: string;
  /** Omit or leave undefined for default tagline; pass null to hide. */
  subtitle?: string | null;
  children: React.ReactNode;
  actions?: React.ReactNode;
  userName: string;
  userRole: string;
  onToggleSidebar?: () => void;
  /** When set, top bar shows the InternAL mark on larger screens instead of the search field. */
  topBarVariant?: 'default' | 'brand';
  /** Hide the large page title block below the top bar (e.g. student profile layout). */
  hidePageIntro?: boolean;
}

const DEFAULT_SUBTITLE = 'Manage your internship lifecycle and track progress.';

const Dashboard: React.FC<DashboardProps> = ({
  title,
  subtitle,
  children,
  actions,
  userName,
  userRole,
}) => {
  const resolvedSubtitle = subtitle === undefined ? DEFAULT_SUBTITLE : subtitle;
  const showTitle = Boolean(title?.trim());
  const showSubtitle = resolvedSubtitle != null && resolvedSubtitle !== '';
  const showPageHeader = showTitle || showSubtitle;
  topBarVariant = 'default',
  hidePageIntro = false,
}) => {
  return (
    <div className="flex-1 min-h-screen flex flex-col bg-[#F4F6F8]">
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 px-6 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Logo size="md" showText={false} className="md:hidden shrink-0" />
          {topBarVariant === 'brand' ? (
            <div className="hidden md:flex items-center min-w-0">
              <Logo size="md" className="shrink-0" />
            </div>
          ) : (
            <div className="hidden md:flex relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search anything..."
                suppressHydrationWarning
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
              />
            </div>
          )}
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
              <div className="text-sm font-bold text-slate-900">{userName}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{userRole}</div>
            </div>
            <div
              className={cn(
                'w-10 h-10 flex items-center justify-center border',
                topBarVariant === 'brand'
                  ? 'rounded-full bg-[#0f2744] text-white border-[#0f2744]'
                  : 'rounded-xl bg-slate-100 text-slate-400 border-slate-200'
              )}
            >
              <User size={20} />
            </div>
          </div>
          {actions && <div className="ml-4">{actions}</div>}
        </div>
      </header>

      <main className="p-10 max-w-7xl w-full mx-auto">
        {showPageHeader && (
          <header className="mb-10">
            {showTitle && (
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
            )}
            {showSubtitle && (
              <p className="text-slate-500 mt-2 text-sm font-medium">{resolvedSubtitle}</p>
            )}
          </header>
        )}
        <div className="space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
