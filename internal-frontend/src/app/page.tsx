'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Sidebar from '@/src/components/Sidebar';
import { Role, Student } from '@/src/types';
import UniversityAdminDashboard from '@/src/components/UniversityAdminDashboard';
import PPADashboard from '@/src/components/PPADashboard';
import StudentDashboard from '@/src/components/StudentDashboard';
import CompanyDashboard from '@/src/components/CompanyDashboard';
import SystemAdminDashboard from '@/src/components/SystemAdminDashboard';
import LoginPage from '@/src/components/LoginPage';
import ForgotPasswordPage from '@/src/components/ForgotPasswordPage';
import { toast } from 'sonner';
import { clearSupabaseAuthStorage, getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { PREMIUM_STUDENT_PROFILE_KEY } from '@/src/lib/auth/getSessionAccessToken';
import { loadCurrentAppUser } from '@/src/lib/auth/userAccount';
import { messageFromUnknown, toError } from '@/src/lib/messageFromUnknown';
import UrlStudentTabSync from '@/src/components/UrlStudentTabSync';

const GET_SESSION_TIMEOUT_MS = 25_000;
const ROLE_LABELS: Record<Role, string> = {
  UNIVERSITY_ADMIN: 'University Admin',
  PPA: 'PPA',
  STUDENT: 'Student',
  COMPANY: 'Company',
  SYSTEM_ADMIN: 'System Admin',
};

export default function Home() {
  const [role, setRole] = useState<Role>('STUDENT');
  const [currentUserName, setCurrentUserName] = useState('User');
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const isSigningOutRef = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const [linkedEntityId, setLinkedEntityId] = useState<string | number | null>(null);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  const resetLocalUserState = () => {
    accessTokenRef.current = null;
    setIsLoggedIn(false);
    setCurrentUserName('User');
    setCurrentStudent(null);
    setAccessToken(null);
    setLinkedEntityId(null);
  };

  /**
   * Supabase often sends magic links to the Auth "Site URL" (/) with tokens in the hash.
   * Forward invite/recovery hashes to the routes that handle them so redirect_to is optional for local/dev.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    const params = new URLSearchParams(raw);
    const type = params.get('type');
    if (type === 'invite') {
      window.location.replace(`${window.location.origin}/auth/set-password#${raw}`);
      return;
    }
    if (type === 'recovery') {
      window.location.replace(`${window.location.origin}/auth/reset#${raw}`);
    }
  }, []);

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

      const meta = session.user.user_metadata as Record<string, unknown> | undefined;
      // Invited PPAs carry internaal_app_role in JWT — redirect before /api/me so a broken production API cannot block onboarding.
      if (meta?.internaal_app_role === 'PPA' && meta?.invite_password_completed !== true) {
        if (typeof window !== 'undefined') {
          // Only redirect to set-password when arriving from an actual invite email link.
          // A stale stored session (no invite hash) would create a redirect loop; sign out instead.
          const hasInviteHash = window.location.hash.includes('type=invite') || window.location.hash.includes('access_token');
          if (hasInviteHash) {
            window.location.replace('/auth/set-password');
          } else {
            clearSupabaseAuthStorage();
            try { await supabase!.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
            resetLocalUserState();
          }
        }
        return;
      }

      const metadataName =
        (session.user.user_metadata?.full_name as string | undefined) ||
        (session.user.user_metadata?.name as string | undefined);
      const invitePasswordCompleted =
        session.user.user_metadata?.invite_password_completed === true;
      const { data: appUser, errorMessage } = await loadCurrentAppUser(
        session.access_token,
        session.user.email,
        metadataName,
        invitePasswordCompleted
      );
      if (cancelled) return;

      if (!appUser || errorMessage) {
        clearSupabaseAuthStorage();
        try {
          await supabase!.auth.signOut({ scope: 'local' });
        } catch {
          /* ignore */
        }
        resetLocalUserState();
        toast.error(errorMessage || 'Could not load your account profile.');
        return;
      }

      if (appUser.user.role === 'PPA') {
        if (meta?.invite_password_completed !== true) {
          if (typeof window !== 'undefined') {
            window.location.replace('/auth/set-password');
          }
          return;
        }
      }

      setRole(appUser.user.role);
      setCurrentUserName(appUser.displayName || 'User');
      setCurrentStudent(appUser.studentProfile);
      setLinkedEntityId(appUser.user.linkedEntityId);
      accessTokenRef.current = session.access_token;
      setAccessToken(session.access_token);
      setIsLoggedIn(true);
    };

    void (async () => {
      try {
        let session: Session | null = null;
        try {
          const result = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('getSession timed out')), GET_SESSION_TIMEOUT_MS)
            ),
          ]);
          session = result?.data?.session ?? null;
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
          throw toError(e);
        }

        if (!cancelled) await sync(session);
      } catch (e) {
        console.error('[auth] initial session failed', e);
        if (!cancelled) {
          resetLocalUserState();
          toast.error(messageFromUnknown(e) || 'Could not restore your session. Please sign in again.');
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
      // Invite/magic-link sessions are often delivered only here; skipping INITIAL_SESSION left getSession()-null users stuck on / with no sync.
      try {
        if (!cancelled) await sync(session);
      } catch (e) {
        console.error('[auth] auth state sync failed', e);
        if (!cancelled) {
          resetLocalUserState();
          toast.error(messageFromUnknown(e) || 'Session sync failed. Please sign in again.');
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

  /** Merge refreshed student profile after returning from `/premium` checkout (static export friendly). */
  useEffect(() => {
    if (!isLoggedIn || role !== 'STUDENT') return;
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem(PREMIUM_STUDENT_PROFILE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Student;
      sessionStorage.removeItem(PREMIUM_STUDENT_PROFILE_KEY);
      setCurrentStudent(parsed);
      toast.success('Premium is active.');
    } catch {
      sessionStorage.removeItem(PREMIUM_STUDENT_PROFILE_KEY);
    }
  }, [isLoggedIn, role]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if ((role === 'STUDENT' || role === 'COMPANY') && activeTab === 'dashboard') {
      setActiveTab('opportunities');
    }
  }, [isLoggedIn, role, activeTab]);

  /** Legacy sidebar tab id removed; migrate old sessions still on "notifications". */
  useEffect(() => {
    if (activeTab !== 'notifications') return;
    if (role === 'STUDENT') setActiveTab('opportunities');
    else if (role === 'PPA') setActiveTab('dashboard');
  }, [activeTab, role]);

  /** Applications tab removed for university admins. */
  useEffect(() => {
    if (role !== 'UNIVERSITY_ADMIN' || activeTab !== 'applications') return;
    setActiveTab('dashboard');
  }, [activeTab, role]);

  const handleLogin = (
    selectedRole: Role,
    name: string,
    studentProfile: Student | null,
    entityId?: string | number,
    token?: string
  ) => {
    setRole(selectedRole);
    setCurrentUserName(name);
    setCurrentStudent(studentProfile);
    if (entityId !== undefined) setLinkedEntityId(entityId);
    if (token) {
      accessTokenRef.current = token;
      setAccessToken(token);
    }
    setIsLoggedIn(true);
    setActiveTab(
      selectedRole === 'STUDENT' || selectedRole === 'COMPANY' ? 'opportunities' : 'dashboard'
    );
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
            onNavigateTab={setActiveTab}
            accessToken={accessToken}
            accessTokenRef={accessTokenRef}
            linkedEntityId={linkedEntityId}
          />
        );
      case 'PPA':
        return (
          <PPADashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
            onToggleSidebar={handleToggleSidebar}
            sidebarExpanded={sidebarOpen}
            onNavigateTab={setActiveTab}
          />
        );
      case 'STUDENT':
        return (
          <StudentDashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
            currentStudent={currentStudent}
            accessToken={accessToken}
            onToggleSidebar={handleToggleSidebar}
            onNavigateTab={setActiveTab}
            onCloseSidebar={closeSidebar}
          />
        );
      case 'COMPANY':
        return (
          <CompanyDashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
            onToggleSidebar={handleToggleSidebar}
            onNavigateTab={setActiveTab}
            onCloseSidebar={closeSidebar}
            accessToken={accessToken}
            accessTokenRef={accessTokenRef}
            linkedEntityId={linkedEntityId}
          />
        );
      case 'SYSTEM_ADMIN':
        return (
          <SystemAdminDashboard
            activeTab={activeTab}
            currentUserName={currentUserName}
            currentUserRoleLabel={roleLabel}
            onToggleSidebar={handleToggleSidebar}
            accessToken={accessToken}
            accessTokenRef={accessTokenRef}
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
      {isLoggedIn && role === 'STUDENT' ? (
        <Suspense fallback={null}>
          <UrlStudentTabSync isLoggedIn={isLoggedIn} role={role} setActiveTab={setActiveTab} />
        </Suspense>
      ) : null}
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
