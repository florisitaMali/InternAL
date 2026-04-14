'use client';

import React, { useState } from 'react';
import Logo from './Logo';
import { Role, Student } from '@/src/types';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { loadCurrentAppUser } from '@/src/lib/auth/userAccount';

interface LoginPageProps {
  onLogin: (role: Role, name: string, studentProfile: Student | null) => void;
  onForgotPassword: () => void;
}

const LOGIN_FLOW_TIMEOUT_MS = 20_000;

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Email is required.';
    if (!password) next.password = 'Password is required.';
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});

    void (async () => {
      setIsLoading(true);
      try {
        await Promise.race([
          (async () => {
            const supabase = getSupabaseBrowserClient();
            const normalizedEmail = email.trim().toLowerCase();
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            });

            if (signInError) {
              if (process.env.NODE_ENV === 'development') {
                console.error('[InternAL login] signInWithPassword failed:', {
                  message: signInError.message,
                  status: (signInError as any).status,
                  name: (signInError as any).name,
                });
              }
              const reason = signInError.message.toLowerCase();
              if (reason.includes('email not confirmed')) {
                toast.error('Email not confirmed yet. Confirm from your inbox, then login again.');
              } else if (reason.includes('invalid login credentials')) {
                toast.error('Invalid email or password. Check credentials or reset your password.');
              } else {
                toast.error(signInError.message);
              }
              return;
            }

            const session =
              signInData?.session ??
              (
                await supabase.auth.getSession()
              ).data.session;
            const emailForProfile = session?.user?.email?.trim() ?? normalizedEmail;
            const metadataName =
              (session?.user?.user_metadata?.full_name as string | undefined) ||
              (session?.user?.user_metadata?.name as string | undefined);

            if (!session?.access_token) {
              await supabase.auth.signOut();
              toast.error('Could not restore your session token after login.');
              return;
            }

            const { data: appUser, errorMessage } = await loadCurrentAppUser(
              session.access_token,
              emailForProfile,
              metadataName
            );

            if (errorMessage) {
              await supabase.auth.signOut();
              if (process.env.NODE_ENV === 'development') {
                console.error('[InternAL login] backend current-user lookup failed:', {
                  emailForProfile,
                  errorMessage,
                });
              }
              toast.error(errorMessage, { duration: 8000 });
              return;
            }

            if (!appUser) {
              await supabase.auth.signOut();
              toast.error('Could not load your account profile from the backend.', { duration: 10000 });
              return;
            }
            onLogin(appUser.user.role, appUser.displayName || 'User', appUser.studentProfile);
            toast.success(`Welcome back! Logged in as ${appUser.user.role.replace('_', ' ')}`);
          })(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Login timed out')), LOGIN_FLOW_TIMEOUT_MS)
          ),
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        if (message.includes('NEXT_PUBLIC_SUPABASE')) {
          toast.error(
            'Supabase URL/key are missing in this build. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY when you run npm run build, then redeploy the frontend.',
            { duration: 10000 }
          );
        } else if (message.includes('timed out')) {
          toast.error(
            'Login is taking too long. Check your network, or clear site data for this app and try again.',
            { duration: 8000 }
          );
        } else {
          toast.error(message);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-30"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white p-10 rounded-[32px] shadow-2xl shadow-indigo-500/5 border border-slate-100">
          <div className="flex flex-col items-center mb-10">
            <Logo size="lg" className="mb-6" />
            <h1 className="text-2xl font-bold text-[#002B5B] tracking-tight">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-2">Enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="you@university.edu"
                  suppressHydrationWarning
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {fieldErrors.email ? <p className="text-xs text-red-600 ml-1">{fieldErrors.email}</p> : null}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Password</label>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  suppressHydrationWarning
                  className="text-xs font-bold text-[#002B5B] hover:text-[#001F42] transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  suppressHydrationWarning
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {fieldErrors.password ? <p className="text-xs text-red-600 ml-1">{fieldErrors.password}</p> : null}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              suppressHydrationWarning
              className="w-full py-4 bg-[#002B5B] text-white rounded-2xl font-bold text-sm hover:bg-[#001F42] transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
