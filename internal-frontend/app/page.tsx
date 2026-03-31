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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const isSigningOutRef = useRef(false);

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

      // While signing out, ignore stale "still logged in" events until storage clears.
      if (isSigningOutRef.current && session?.user) {
        return;
      }

      if (!session?.user?.email) {
        setIsLoggedIn(false);
        return;
      }

      const { data: acct, errorMessage } = await fetchUserAccountByEmail(supabase!, session.user.email);
      if (!acct || errorMessage) {
        await supabase!.auth.signOut();
        setIsLoggedIn(false);
        return;
      }

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

  const handleLogin = (selectedRole: Role) => {
    setRole(selectedRole);
    setIsLoggedIn(true);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    void (async () => {
      isSigningOutRef.current = true;
      try {
        const supabase = getSupabaseBrowserClient();
        // Avoid global revocation: it can cause noisy "Invalid Refresh Token" logs.
        // Local sign-out + localStorage cleanup is enough for correct UI logout.
        clearSupabaseAuthStorage();
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) {
          toast.error(error.message);
          return;
        }

        // Verify session is cleared (RLS doesn't affect auth session).
        const { data: sessionAfter } = await supabase.auth.getSession();
        if (sessionAfter.session) {
          // Last resort: wipe storage again and sign out again.
          clearSupabaseAuthStorage();
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Sign out failed';
        toast.error(msg);
        return;
      } finally {
        isSigningOutRef.current = false;
      }
      setActiveTab('dashboard');
      setShowForgotPassword(false);
      setIsLoggedIn(false);
      toast.info('Logged out successfully');
      // Ensure UI + auth state fully reset for all users.
      window.location.reload();
    })();
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

      <Sidebar role={role} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />

      <div className="flex-1 relative z-10">{renderDashboard()}</div>
    </div>
  );
}
