'use client';

import React from 'react';
import Logo from './Logo';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Briefcase, 
  FileText, 
  Settings, 
  LogOut,
  GraduationCap,
  BookOpen,
  Bell
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Role } from '@/src/types';

interface SidebarProps {
  role: Role;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, activeTab, setActiveTab, onLogout }) => {
  const menuItems = {
    UNIVERSITY_ADMIN: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'students', label: 'Students', icon: Users },
      { id: 'ppa', label: 'PP Approvers', icon: GraduationCap },
      { id: 'academic', label: 'Academic Structure', icon: BookOpen },
      { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
      { id: 'applications', label: 'Applications', icon: FileText },
    ],
    PPA: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'students', label: 'My Students', icon: Users },
      { id: 'applications', label: 'PP Applications', icon: FileText },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
    STUDENT: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'profile', label: 'My Profile', icon: Users },
      { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
      { id: 'applications', label: 'My Applications', icon: FileText },
    ],
    COMPANY: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'opportunities', label: 'My Opportunities', icon: Briefcase },
      { id: 'applications', label: 'Applications', icon: FileText },
      { id: 'profile', label: 'Company Profile', icon: Building2 },
    ],
  };

  const currentMenuItems = menuItems[role] || [];

  return (
    <div className="w-72 bg-white border-r border-slate-200 h-screen flex flex-col fixed left-0 top-0 z-50 transition-all duration-300">
      <div className="p-8">
        <Logo />
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Main Menu</div>
        {currentMenuItems.map((item) => (
          <button
            key={item.id}
            suppressHydrationWarning
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-semibold",
              activeTab === item.id 
                ? "bg-[#002B5B]/10 text-[#002B5B] shadow-sm" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-6 border-t border-slate-100">
        <div className="bg-slate-50 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-[#002B5B]/10 text-[#002B5B] rounded-full flex items-center justify-center font-bold text-xs uppercase">
              {role[0]}
            </div>
            <div className="text-xs font-bold text-slate-900 truncate">{role.replace('_', ' ')}</div>
          </div>
          <p className="text-[10px] text-slate-500 font-medium">Active Workspace</p>
        </div>
        <button 
          onClick={onLogout}
          suppressHydrationWarning
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-300 text-sm font-bold"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
