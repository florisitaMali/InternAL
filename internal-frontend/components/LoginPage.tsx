'use client';

import React, { useState } from 'react';
import Logo from './Logo';
import { Role } from '@/src/types';
import { Mail, Lock, ArrowRight, Github, Chrome } from 'lucide-react';
import { toast } from 'sonner';

interface LoginPageProps {
  onLogin: (role: Role) => void;
  onForgotPassword: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Mock login logic
    setTimeout(() => {
      const lowerEmail = email.toLowerCase();
      let role: Role = 'STUDENT';

      if (lowerEmail.includes('admin')) {
        role = 'UNIVERSITY_ADMIN';
      } else if (lowerEmail.includes('ppa')) {
        role = 'PPA';
      } else if (lowerEmail.includes('company')) {
        role = 'COMPANY';
      } else if (lowerEmail.includes('student')) {
        role = 'STUDENT';
      }

      onLogin(role);
      toast.success(`Welcome back! Logged in as ${role.replace('_', ' ')}`);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-6 relative overflow-hidden">
      {/* Background Orbs */}
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
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="student@example.com"
                  suppressHydrationWarning
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
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
                  placeholder="••••••••"
                  suppressHydrationWarning
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
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

          <div className="mt-10">
            <div className="relative flex items-center justify-center mb-8">
              <div className="absolute w-full h-px bg-slate-100"></div>
              <span className="relative px-4 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest">Or continue with</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                suppressHydrationWarning
                className="flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all text-sm font-bold text-slate-700"
              >
                <Chrome size={18} className="text-red-500" />
                Google
              </button>
              <button 
                suppressHydrationWarning
                className="flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all text-sm font-bold text-slate-700"
              >
                <Github size={18} />
                GitHub
              </button>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-sm text-slate-500">
          Don&apos;t have an account? <button suppressHydrationWarning className="text-[#002B5B] font-bold hover:underline">Request Access</button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
