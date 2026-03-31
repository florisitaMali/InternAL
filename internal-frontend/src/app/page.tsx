'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Sidebar from '@/src/components/Sidebar';
import { Role } from '@/src/types';
import UniversityAdminDashboard from '@/src/components/UniversityAdminDashboard';
import PPADashboard from '@/src/components/PPADashboard';
import StudentDashboard from '@/src/components/StudentDashboard';
import CompanyDashboard from '@/src/components/CompanyDashboard';
import LoginPage from '@/src/components/LoginPage';
import ForgotPasswordPage from '@/src/components/ForgotPasswordPage';

import { toast } from 'sonner';
import { clearSupabaseAuthStorage, getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { fetchUserAccountByEmail } from '@/src/lib/auth/userAccount';

export default function Home() {
  const [role, setRole] = useState<Role>('STUDENT');
  const [currentUserName, setCurrentUserName] = useState('User');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const isSigningOutRef = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

      if (isSigningOutRef.current && session?.user) {
        return;
      }

      if (!session?.user?.email) {
        setIsLoggedIn(false);
        setCurrentUserName('User');
        return;
      }

      const { data: acct, errorMessage } = await fetchUserAccountByEmail(supabase!, session.user.email);
      if (!acct || errorMessage) {
        await supabase!.auth.signOut();
        setIsLoggedIn(false);
        setCurrentUserName('User');
        return;
      }

      const metadataName =
        (session.user.user_metadata?.full_name as string | undefined) ||
        (session.user.user_metadata?.name as string | undefined);
      const emailName = session.user.email.split('@')[0] || 'User';
      const normalizedEmailName = emailName
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      setCurrentUserName(metadataName || normalizedEmailName || 'User');
      setRole(acct.role);
      setIsLoggedIn(true);
      setActiveTab('dashboard');
    };

    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      await sync(session);
      if (!cancelled) setAuthChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return;
      await sync(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = (selectedRole: Role, name: string) => {
    setRole(selectedRole);
    setCurrentUserName(name);
    setIsLoggedIn(true);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    void (async () => {
      if (isSigningOutRef.current) return;
      isSigningOutRef.current = true;
      setIsLoggingOut(true);

      // Immediately reflect logged-out UI, even if remote sign-out call fails.
      setActiveTab('dashboard');
      setShowForgotPassword(false);
      setIsLoggedIn(false);
      setCurrentUserName('User');

      try {
        const supabase = getSupabaseBrowserClient();
        // Local cleanup first prevents stale tokens from repopulating state.
        clearSupabaseAuthStorage();
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) toast.error(`Sign-out warning: ${error.message}`);

        // Last-resort cleanup if session still appears in memory.
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

  const renderDashboard = () => {
    const roleLabel = role.replace(/_/g, ' ');

    switch (role) {
      case 'UNIVERSITY_ADMIN':
        return (
          <UniversityAdminDashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
          />
        );
      case 'PPA':
        return (
          <PPADashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
          />
        );
      case 'STUDENT':
        return (
          <StudentDashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
          />
        );
      case 'COMPANY':
        return (
          <CompanyDashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
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
      />

      <div className="flex-1 relative z-10">{renderDashboard()}</div>
    </div>
  );
}
