'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Sidebar from '@/src/components/Sidebar';
import { Role, Student } from '@/src/types';
import UniversityAdminDashboard from '@/src/components/UniversityAdminDashboard';
import PPADashboard from '@/src/components/PPADashboard';
import StudentDashboard from '@/src/components/StudentDashboard';
import CompanyDashboard from '@/src/components/CompanyDashboard';
import LoginPage from '@/src/components/LoginPage';
import ForgotPasswordPage from '@/src/components/ForgotPasswordPage';
import { toast } from 'sonner'; //used for notifications
import { clearSupabaseAuthStorage, getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { loadCurrentAppUser } from '@/src/lib/auth/userAccount';

const GET_SESSION_TIMEOUT_MS = 25_000;
const ROLE_LABELS: Record<Role, string> = {
  UNIVERSITY_ADMIN: 'University Admin',
  PPA: 'PPA',
  STUDENT: 'Student',
  COMPANY: 'Company',
};

export default function Home() {
  const [role, setRole] = useState<Role>('STUDENT');
  const [currentUserName, setCurrentUserName] = useState('User');
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const isSigningOutRef = useRef(false); //prevent multiple logout requests
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  const resetLocalUserState = () => {
    setIsLoggedIn(false);
    setCurrentUserName('User');
    setCurrentStudent(null);
  };

  useEffect(() => {
    let cancelled = false;

    let supabase: ReturnType<typeof getSupabaseBrowserClient> | null = null;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      setAuthChecked(true);
      return;
    }

    const sync = async (session: Session | null) => {
      if (cancelled) return;
      if (isSigningOutRef.current && session?.user) return;

      if (!session?.access_token || !session?.user?.email) {
        resetLocalUserState();
        return;
      }

      const metadataName =
        (session.user.user_metadata?.full_name as string | undefined) ||
        (session.user.user_metadata?.name as string | undefined);
      const { data: appUser, errorMessage } = await loadCurrentAppUser(
        session.access_token,
        session.user.email,
        metadataName
      );
      if (cancelled) return;

      if (!appUser || errorMessage) {
        clearSupabaseAuthStorage();
        try {
          await supabase!.auth.signOut({ scope: 'local' });//sign out from supabase
        } catch {
          //ignore
        }
        resetLocalUserState();
        toast.error(errorMessage || 'Could not load your account profile.');
        return;
      }

      setRole(appUser.user.role);
      setCurrentUserName(appUser.displayName || 'User');
      setCurrentStudent(appUser.studentProfile);
      setIsLoggedIn(true);
    };

    void (async () => {
      try {
        let session: Session | null = null;
        try {
          const { data } = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('getSession timed out')), GET_SESSION_TIMEOUT_MS)
            ),
          ]);
          session = data.session;
        } catch (e) {
          if (e instanceof Error && e.message.includes('getSession timed out')) {
            if (!cancelled) {
              clearSupabaseAuthStorage();
              try {
                await supabase.auth.signOut({ scope: 'local' });
              } catch {
                /* ignore */
              }
              resetLocalUserState();
              toast.error(
                'Could not read your session in time. Try again, or clear site data for this site if it keeps happening.',
                { duration: 8000 }
              );
            }
            return;
          }
          throw e;
        }

        if (!cancelled) await sync(session);
      } catch (e) {
        console.error('[auth] initial session failed', e);
        if (!cancelled) {
          resetLocalUserState();
          toast.error('Could not restore your session. Please sign in again.');
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return;
      try {
        if (!cancelled) await sync(session);
      } catch (e) {
        console.error('[auth] auth state sync failed', e);
        if (!cancelled) {
          resetLocalUserState();
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn && role === 'STUDENT' && activeTab === 'dashboard') {
      setActiveTab('opportunities');
    }
  }, [isLoggedIn, role, activeTab]);

  const handleLogin = (selectedRole: Role, name: string, studentProfile: Student | null) => {
    setRole(selectedRole);
    setCurrentUserName(name);
    setCurrentStudent(studentProfile);
    setIsLoggedIn(true);
    setActiveTab(selectedRole === 'STUDENT' ? 'opportunities' : 'dashboard'); 
  };

  const handleLogout = () => {
    void (async () => {
      if (isSigningOutRef.current) return;
      isSigningOutRef.current = true;
      setIsLoggingOut(true);

      setActiveTab('dashboard');
      setShowForgotPassword(false);
      resetLocalUserState();

      try {
        const supabase = getSupabaseBrowserClient();
        clearSupabaseAuthStorage();
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) toast.error(`Sign-out warning: ${error.message}`);

        const { data: sessionAfter } = await supabase.auth.getSession();
        if (sessionAfter.session) {
          clearSupabaseAuthStorage();
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Sign out failed';
        toast.error(`Sign-out warning: ${msg}`);
      } finally {
        clearSupabaseAuthStorage();
        setIsLoggingOut(false);
        isSigningOutRef.current = false;
      }

      toast.info('Logged out successfully');
    })();
  };

  const roleLabel = ROLE_LABELS[role];

  const renderDashboard = () => {
    const roleLabel = role.replace(/_/g, ' ');

    switch (role) {
      case 'UNIVERSITY_ADMIN':
        return (
          <UniversityAdminDashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
            onToggleSidebar={handleToggleSidebar}
          />
        );
      case 'PPA':
        return (
          <PPADashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
            onToggleSidebar={handleToggleSidebar}
          />
        );
      case 'STUDENT':
        return (
          <StudentDashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
            currentStudent={currentStudent}
            onToggleSidebar={handleToggleSidebar}
          />
        );
      case 'COMPANY':
        return (
          <CompanyDashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
            onToggleSidebar={handleToggleSidebar}
          />
        );
      default:
        return <div>Select a role to continue</div>;
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="w-8 h-8 border-2 border-[#002B5B]/30 border-t-[#002B5B] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    if (showForgotPassword) {
      return <ForgotPasswordPage onBack={() => setShowForgotPassword(false)} />;
    }
    return <LoginPage onLogin={handleLogin} onForgotPassword={() => setShowForgotPassword(true)} />;
  }

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute top-1/2 -left-24 w-72 h-72 bg-blue-50 rounded-full blur-3xl opacity-30"></div>
      </div>

      <Sidebar
        role={role}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={isLoggingOut ? () => {} : handleLogout}
        isOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />

      <div
        className={`flex-1 relative z-10 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-16'}`}
      >
        {renderDashboard()}
      </div>
    </div>
  );
}
