'use client';

import React, { useEffect, useState } from 'react';
import Logo from './Logo';
import { Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirm: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match.',
    path: ['confirm'],
  });

const ResetPasswordPage: React.FC = () => {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    const q = new URLSearchParams(hash);
    if (q.get('error')) {
      setStatus('invalid');
      return;
    }

    let cancelled = false;

    const trySession = () => {
      void supabase.auth
        .getSession()
        .then((res) => {
          const session = res?.data?.session ?? null;
          if (cancelled || !session) return;
          setStatus('ready');
        })
        .catch((err) => {
          console.error('[reset-password] getSession failed', err);
        });
    };

    trySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || !session) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setStatus('ready');
      }
    });

    const retries = [400, 1200, 2500].map((ms) =>
      window.setTimeout(() => {
        if (!cancelled) trySession();
      }, ms)
    );

    const final = window.setTimeout(() => {
      void supabase.auth
        .getSession()
        .then((res) => {
          const session = res?.data?.session ?? null;
          if (cancelled) return;
          if (!session) {
            setStatus((prev) => (prev === 'loading' ? 'invalid' : prev));
          } else {
            setStatus('ready');
          }
        })
        .catch((err) => {
          console.error('[reset-password] getSession failed', err);
          if (!cancelled) setStatus((prev) => (prev === 'loading' ? 'invalid' : prev));
        });
    }, 6000);

    return () => {
      cancelled = true;
      retries.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(final);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const parsed = passwordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setIsSubmitting(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Password updated successfully.');
    await supabase.auth.signOut();
    router.replace('/');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-6">
        <div className="w-8 h-8 border-2 border-[#002B5B]/30 border-t-[#002B5B] rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-6">
        <div className="bg-white p-10 rounded-[32px] shadow-xl border border-slate-100 max-w-md text-center">
          <Logo size="lg" className="mx-auto mb-6" />
          <p className="text-slate-800 font-medium">Invalid or expired reset link.</p>
          <button
            type="button"
            onClick={() => router.replace('/')}
            className="mt-8 w-full py-4 bg-[#002B5B] text-white rounded-2xl font-bold text-sm"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-30"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white p-10 rounded-[32px] shadow-2xl shadow-indigo-500/5 border border-slate-100">
          <div className="flex flex-col items-center mb-10 text-center">
            <Logo size="lg" className="mb-6" />
            <h1 className="text-2xl font-bold text-[#002B5B] tracking-tight">Set new password</h1>
            <p className="text-slate-500 text-sm mt-2">Choose a strong password for your account.</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">New password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {fieldErrors.password ? (
                <p className="text-xs text-red-600 ml-1">{fieldErrors.password}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {fieldErrors.confirm ? (
                <p className="text-xs text-red-600 ml-1">{fieldErrors.confirm}</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-[#002B5B] text-white rounded-2xl font-bold text-sm hover:bg-[#001F42] transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 group"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Update password
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

export default ResetPasswordPage;
