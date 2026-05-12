'use client';

import React, { useState } from 'react';
import { CheckCircle, Zap, Building2, Users, Briefcase } from 'lucide-react';
import { getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface UpgradePageProps {
  onUpgradeSuccess?: () => void;
  onNavigateTab?: (tab: string) => void;
}

const UpgradePage: React.FC<UpgradePageProps> = ({ onUpgradeSuccess, onNavigateTab }) => {
  const [loading, setLoading] = useState(false);
  const [upgraded, setUpgraded] = useState(false);

  const handleSimulateUpgrade = async () => {
    setLoading(true);
    try {
      const token = await getSessionAccessToken();
      if (!token) {
        toast.error('Not signed in. Refresh the page and try again.');
        return;
      }
      const res = await fetch('/api/payment/test/upgrade', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.message || 'Could not upgrade. Please try again.');
        return;
      }
      setUpgraded(true);
      toast.success('You are now on Premium!');
      onUpgradeSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Briefcase, base: '5 opportunities', premium: '1,000 opportunities' },
    { icon: Users, base: '50 applications', premium: '20,000 applications' },
    { icon: Building2, base: 'Basic visibility', premium: 'See other companies\' listings' },
  ];

  if (upgraded) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
          <CheckCircle size={40} className="text-emerald-500" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">You're on Premium!</h1>
        <p className="text-slate-500 text-sm mb-8">All premium features are now unlocked for your company.</p>
        <button
          type="button"
          onClick={() => onNavigateTab?.('opportunities')}
          className="rounded-xl bg-[#002B5B] px-6 py-3 text-sm font-bold text-white hover:bg-[#001F42]"
        >
          Go to My Opportunities
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-700 mb-4">
          <Zap size={14} />
          Upgrade to Premium
        </div>
        <h1 className="text-4xl font-bold text-[#0E2A50] mb-3">Unlock your full potential</h1>
        <p className="text-slate-500 text-base">Get more opportunities, more applications, and premium visibility.</p>
      </div>

      {/* Plan comparison */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Base plan */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Base Plan</p>
          <p className="text-2xl font-bold text-slate-900 mb-6">Free</p>
          <div className="space-y-4">
            {features.map((f) => (
              <div key={f.base} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                  <f.icon size={16} />
                </div>
                <span className="text-sm text-slate-600">{f.base}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Premium plan */}
        <div className="rounded-2xl border-2 border-[#002B5B] bg-[#002B5B] p-6 text-white relative overflow-hidden">
          <div className="absolute top-3 right-3 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
            PREMIUM
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-1">Premium Plan</p>
          <p className="text-2xl font-bold text-white mb-6">$29.99<span className="text-sm font-normal text-blue-300">/mo</span></p>
          <div className="space-y-4">
            {features.map((f) => (
              <div key={f.premium} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
                  <f.icon size={16} />
                </div>
                <span className="text-sm text-white font-medium">{f.premium}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-500 mb-4">
          Click below to upgrade instantly. PayPal payment coming soon.
        </p>
        <button
          type="button"
          onClick={() => void handleSimulateUpgrade()}
          disabled={loading}
          className={cn(
            'rounded-xl px-8 py-3 text-sm font-bold text-white transition-colors',
            loading
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-[#002B5B] hover:bg-[#001F42]'
          )}
        >
          {loading ? 'Upgrading…' : 'Upgrade to Premium'}
        </button>
        <p className="mt-3 text-xs text-slate-400">
          To downgrade, contact support.
        </p>
      </div>
    </div>
  );
};

export default UpgradePage;