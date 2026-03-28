'use client';

import React, { useState } from 'react';
import Sidebar from '@/src/components/Sidebar';
import { Role } from '@/src/types';
import UniversityAdminDashboard from '@/src/components/UniversityAdminDashboard';
import PPADashboard from '@/src/components/PPADashboard';
import StudentDashboard from '@/src/components/StudentDashboard';
import CompanyDashboard from '@/src/components/CompanyDashboard';
import LoginPage from '@/src/components/LoginPage';
import ForgotPasswordPage from '@/src/components/ForgotPasswordPage';

import { toast } from 'sonner';

export default function Home() {
  const [role, setRole] = useState<Role>('STUDENT');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleLogin = (selectedRole: Role) => {
    setRole(selectedRole);
    setIsLoggedIn(true);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    toast.info('Logged out successfully');
  };

  const renderDashboard = () => {
    switch (role) {
      case 'UNIVERSITY_ADMIN':
        return <UniversityAdminDashboard activeTab={activeTab} />;
      case 'PPA':
        return <PPADashboard activeTab={activeTab} />;
      case 'STUDENT':
        return <StudentDashboard activeTab={activeTab} />;
      case 'COMPANY':
        return <CompanyDashboard activeTab={activeTab} />;
      default:
        return <div>Select a role to continue</div>;
    }
  };

  if (!isLoggedIn) {
    if (showForgotPassword) {
      return <ForgotPasswordPage onBack={() => setShowForgotPassword(false)} />;
    }
    return (
      <LoginPage 
        onLogin={handleLogin} 
        onForgotPassword={() => setShowForgotPassword(true)} 
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute top-1/2 -left-24 w-72 h-72 bg-blue-50 rounded-full blur-3xl opacity-30"></div>
      </div>

      <Sidebar 
        role={role} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
      />
      
      <div className="flex-1 relative z-10">
        {renderDashboard()}
      </div>
    </div>
  );
}
