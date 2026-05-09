'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  User,
  Building2,
  Briefcase,
  FileText,
  LogOut,
  GraduationCap,
  BookOpen,
  Menu,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Role } from '@/src/types';

interface SidebarProps {
  role: Role;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  onToggleSidebar?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, activeTab, setActiveTab, onLogout, isOpen, onToggleSidebar }) => {
  const menuItems = {
    UNIVERSITY_ADMIN: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'students', label: 'Students', icon: Users },
      { id: 'ppa', label: 'PP Approvers', icon: GraduationCap },
      { id: 'academic', label: 'Academic Structure', icon: BookOpen },
      { id: 'companies', label: 'Companies', icon: Building2 },
      { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
      { id: 'applications', label: 'Applications', icon: FileText },
    ],
    PPA: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'students', label: 'My Students', icon: Users },
      { id: 'applications', label: 'PP Applications', icon: FileText },
    ],
    STUDENT: [
      { id: 'profile', label: 'My Profile', icon: User },
      { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
      { id: 'best-matches', label: 'Best Matches', icon: Sparkles },
      { id: 'applications', label: 'My Applications', icon: FileText },
    ],
    COMPANY: [
      { id: 'opportunities', label: 'My Opportunities', icon: Briefcase },
      { id: 'applications', label: 'Applications', icon: FileText },
      { id: 'profile', label: 'Company Profile', icon: Building2 },
    ],
    SYSTEM_ADMIN: [
      { id: 'admins', label: 'System Admins', icon: User },
      { id: 'universities', label: 'Universities', icon: Briefcase },
      { id: 'audit', label: 'Audit Log', icon: FileText },
    ],
  };

  const currentMenuItems = menuItems[role] || [];

  return (
    <div
      className={cn(
        'bg-white border-r border-slate-200 h-screen flex flex-col fixed left-0 top-0 z-50 transition-all duration-300 overflow-hidden',
        isOpen ? 'w-72' : 'w-16'
      )}
    >
      <div className="flex items-center h-16 border-b border-slate-100 flex-shrink-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="w-16 h-16 bg-[#002B5B] flex items-center justify-center flex-shrink-0 hover:bg-[#001F42] transition-colors"
        >
          <Menu size={20} color="white" />
        </button>
        {isOpen ? <div className="flex-1 min-w-0" aria-hidden /> : null}
      </div>

      <nav className="flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        <div
          className={cn(
            'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 whitespace-nowrap overflow-hidden transition-all duration-200',
            isOpen ? 'opacity-100' : 'opacity-0 h-0 py-0 mb-0'
          )}
        >
          Main Menu
        </div>
        {currentMenuItems.map((item) => (
          <button
            key={item.id}
            suppressHydrationWarning
            onClick={() => setActiveTab(item.id)}
            title={!isOpen ? item.label : undefined}
            className={cn(
              'flex items-center transition-all duration-200 text-sm font-semibold',
              isOpen
                ? 'w-[calc(100%-16px)] mx-2 gap-3 px-4 py-3 rounded-xl'
                : 'w-full justify-center py-3',
              item.id === 'best-matches'
                ? activeTab === item.id
                  ? 'bg-amber-100/90 text-amber-950 shadow-sm ring-1 ring-amber-300/80'
                  : 'text-amber-900/85 hover:bg-amber-50/90 hover:text-amber-950'
                : activeTab === item.id
                  ? 'bg-[#002B5B]/10 text-[#002B5B] shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} className="flex-shrink-0" />
            <span
              className={cn(
                'whitespace-nowrap overflow-hidden transition-all duration-200',
                isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
              )}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="border-t border-slate-100 flex-shrink-0">
        <div
          className={cn(
            'overflow-hidden transition-all duration-200',
            isOpen ? 'max-h-32 p-4' : 'max-h-0 p-0'
          )}
        >
          <div className="bg-slate-50 rounded-2xl p-3 mb-3">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-7 h-7 bg-[#002B5B]/10 text-[#002B5B] rounded-full flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                {role[0]}
              </div>
              <div className="text-xs font-bold text-slate-900 truncate">{role.replace('_', ' ')}</div>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Active Workspace</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          suppressHydrationWarning
          title={!isOpen ? 'Sign Out' : undefined}
          className={cn(
            'w-full flex items-center transition-all duration-200 text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-600',
            isOpen ? 'gap-3 px-6 py-4' : 'justify-center py-4'
          )}
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span
            className={cn(
              'whitespace-nowrap overflow-hidden transition-all duration-200',
              isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
            )}
          >
            Sign Out
          </span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
