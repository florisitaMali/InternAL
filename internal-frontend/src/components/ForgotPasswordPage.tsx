'use client';

import React, { useState } from 'react';
import Logo from './Logo';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';

interface ForgotPasswordPageProps {
  onBack: () => void;
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setFieldError('Email is required.');
      return;
    }
    setFieldError(null);

    void (async () => {
      setIsLoading(true);
      try {
        const supabase = getSupabaseBrowserClient();

        const { data: registered, error: rpcError } = await supabase.rpc('check_email_registered', {
          p_email: email.trim(),
        });

        if (rpcError) {
          toast.error('Unable to verify email. Please try again later.');
          return;
        }

        if (!registered) {
          toast.error('Email not found.');
          return;
        }

        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${origin}/auth/reset`,
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        toast.success('A reset link has been sent to your email.');
        onBack();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        if (message.includes('NEXT_PUBLIC_SUPABASE')) {
          toast.error(
            'Supabase URL/key are missing in this build. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY when you run npm run build, then redeploy the frontend.',
            { duration: 10000 }
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
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors text-xs font-bold uppercase tracking-widest mb-10"
          >
            <ArrowLeft size={16} />
            Back to Login
          </button>

          <div className="flex flex-col items-center mb-10 text-center">
            <Logo size="lg" className="mb-6" />
            <h1 className="text-2xl font-bold text-[#002B5B] tracking-tight">Reset Password</h1>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="student@example.com"
                  suppressHydrationWarning
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {fieldError ? <p className="text-xs text-red-600 ml-1">{fieldError}</p> : null}
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
                  Send Reset Link
                  <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
