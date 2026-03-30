'use client';

import React, { useState } from 'react';
import Logo from './Logo';
import { Role } from '@/src/types';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { fetchUserAccountByEmail } from '@/src/lib/auth/userAccount';

interface LoginPageProps {
  onLogin: (role: Role) => void;
  onForgotPassword: () => void;
}

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
        const supabase = getSupabaseBrowserClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          // Keep UI message per acceptance criteria, but log the real Supabase reason in devtools.
          // This helps us distinguish "wrong password" vs "email not confirmed" vs "misconfigured keys".
          if (process.env.NODE_ENV === 'development') {
            console.error('[InternAL login] signInWithPassword failed:', {
              message: signInError.message,
              status: (signInError as any).status,
              name: (signInError as any).name,
            });
          }
          toast.error('Invalid username/email or password.');
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const emailForProfile = session?.user?.email?.trim() ?? email.trim();

        const { data: acct, errorMessage, errorCode } = await fetchUserAccountByEmail(
          supabase,
          emailForProfile
        );

        if (errorMessage) {
          await supabase.auth.signOut();
          if (process.env.NODE_ENV === 'development') {
            console.error('[InternAL login] useraccount lookup failed:', {
              emailForProfile,
              errorMessage,
              errorCode,
            });
          }
          toast.error(
            'Could not load your account profile. Check the useraccount table, RLS (run supabase-setup.sql), and that the table name matches your database.',
            { duration: 8000 }
          );
          return;
        }

        if (!acct) {
          await supabase.auth.signOut();
          toast.error(
            'No UserAccount row for this email. In Supabase, add a useraccount row whose email matches your Auth user (same address as Authentication → Users).',
            { duration: 10000 }
          );
          return;
        }

        onLogin(acct.role);
        toast.success(`Welcome back! Logged in as ${acct.role.replace('_', ' ')}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        if (message.includes('NEXT_PUBLIC_SUPABASE')) {
          toast.error('Server configuration is incomplete. Add Supabase keys to .env.local.');
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
