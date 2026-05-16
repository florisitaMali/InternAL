'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import {
  resolveBackendAccessToken,
} from '@/src/lib/auth/getSessionAccessToken';
import {
  createPremiumBillingPortalSession,
  createPremiumCheckoutSession,
  fetchCurrentStudentProfile,
  mapStudentProfileToStudent,
} from '@/src/lib/auth/userAccount';
import { toast } from 'sonner';
import type { Student } from '@/src/types';

type Gate = 'loading' | 'login' | 'already' | 'checkout';

export default function PremiumCheckoutPage() {
  const [gate, setGate] = useState<Gate>('loading');
  const [resolvedToken, setResolvedToken] = useState<string | null>(null);
  const [checkoutPhase, setCheckoutPhase] = useState<'idle' | 'redirecting'>('idle');
  const [premiumStudent, setPremiumStudent] = useState<Student | null>(null);
  const [portalPhase, setPortalPhase] = useState<'idle' | 'opening'>('idle');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await resolveBackendAccessToken();
      if (cancelled) return;
      if (!token) {
        setGate('login');
        return;
      }
      setResolvedToken(token);
      const { data: profile, errorMessage } = await fetchCurrentStudentProfile(token);
      if (cancelled) return;
      if (errorMessage || !profile) {
        toast.error(errorMessage || 'Could not load your profile.');
        setGate('login');
        return;
      }
      const student = mapStudentProfileToStudent(profile);
      if (student.hasPremium) {
        setPremiumStudent(student);
        setGate('already');
        return;
      }
      setGate('checkout');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStripeCheckout = async () => {
    const token = resolvedToken ?? (await resolveBackendAccessToken());
    if (!token?.trim()) {
      toast.error('Please sign in again from the home page, then return here.');
      setGate('login');
      return;
    }
    setCheckoutPhase('redirecting');
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { url, errorMessage } = await createPremiumCheckoutSession(token, {
        successUrl: `${origin}/premium/success`,
        cancelUrl: `${origin}/premium`,
      });
      if (!url || errorMessage) {
        toast.error(errorMessage || 'Could not start checkout.');
        setCheckoutPhase('idle');
        return;
      }
      window.location.href = url;
    } catch {
      toast.error('Something went wrong.');
      setCheckoutPhase('idle');
    }
  };

  const handleManageSubscription = async () => {
    const token = resolvedToken ?? (await resolveBackendAccessToken());
    if (!token?.trim()) {
      toast.error('Please sign in again.');
      return;
    }
    setPortalPhase('opening');
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { url, errorMessage } = await createPremiumBillingPortalSession(token, {
        returnUrl: `${origin}/premium/`,
      });
      if (!url || errorMessage) {
        toast.error(errorMessage || 'Could not open billing portal.');
        setPortalPhase('idle');
        return;
      }
      window.location.href = url;
    } catch {
      toast.error('Something went wrong.');
      setPortalPhase('idle');
    }
  };

  if (gate === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#002B5B]" aria-hidden />
        <p className="text-sm text-slate-600">Loading checkout…</p>
      </div>
    );
  }

  if (gate === 'login') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#002B5B] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to InternAL
        </Link>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Sign in required</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Open Premium checkout from the app while you are logged in, or sign in on the home page first. Your session
            is used to create a secure Stripe Checkout session.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#002B5B] py-3 text-sm font-bold text-white hover:bg-[#001F42]"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (gate === 'already') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#002B5B] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to InternAL
        </Link>
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-8 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Sparkles className="h-6 w-6" strokeWidth={2} aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">You already have Premium</h1>
          <p className="mt-2 text-sm text-slate-600">
            Best Matches and Premium highlights are unlocked on your account.
          </p>
          {(premiumStudent?.premiumSubscriptionStatus || premiumStudent?.premiumCurrentPeriodEnd) && (
            <div className="mt-4 rounded-xl border border-emerald-200/80 bg-white/80 px-4 py-3 text-left text-xs text-slate-600">
              {premiumStudent?.premiumSubscriptionStatus ? (
                <p>
                  <span className="font-semibold text-slate-800">Status:</span>{' '}
                  {premiumStudent.premiumSubscriptionStatus}
                </p>
              ) : null}
              {premiumStudent?.premiumCurrentPeriodEnd ? (
                <p className={premiumStudent?.premiumSubscriptionStatus ? 'mt-1' : ''}>
                  <span className="font-semibold text-slate-800">Current period ends:</span>{' '}
                  {new Date(premiumStudent.premiumCurrentPeriodEnd).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              ) : null}
            </div>
          )}
          <button
            type="button"
            disabled={portalPhase === 'opening'}
            onClick={() => void handleManageSubscription()}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-emerald-700/50 bg-white px-6 py-3 text-sm font-bold text-emerald-900 shadow-sm hover:bg-emerald-50 disabled:opacity-60"
          >
            {portalPhase === 'opening' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Opening billing portal…
              </>
            ) : (
              'Manage subscription'
            )}
          </button>
          <Link
            href="/"
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Back to the app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20 pt-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#002B5B] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to InternAL
        </Link>

        <header className="mt-8 border-b border-slate-200/80 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200/80">
              <Sparkles className="h-6 w-6" strokeWidth={2} aria-hidden />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#002B5B]">InternAL Premium</h1>
              <p className="mt-1 text-sm text-slate-600">
                Monthly subscription — secure payment via Stripe Checkout (cards and wallets where available).
              </p>
            </div>
          </div>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-12">
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">What you unlock</h2>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex gap-2.5">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <strong className="text-slate-900">Full Best Matches list</strong> — every opportunity ranked by skill
                  overlap, not just a short preview.
                </span>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <strong className="text-slate-900">Premium highlights</strong> across Explore and matches so high-fit
                  roles stand out.
                </span>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <strong className="text-slate-900">Manage billing</strong> in Stripe Customer Portal (configure in your
                  Stripe Dashboard) — cancel or update payment method anytime.
                </span>
              </li>
            </ul>
          </section>

          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Subscribe</h2>
              <p className="mt-1 text-sm text-slate-600">
                You will be redirected to Stripe&apos;s hosted checkout to enter payment details. Premium activates after
                Stripe confirms payment — usually within seconds.
              </p>

              <button
                type="button"
                disabled={checkoutPhase === 'redirecting'}
                onClick={() => void handleStripeCheckout()}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:from-amber-600 hover:to-amber-700 disabled:opacity-60"
              >
                {checkoutPhase === 'redirecting' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    Opening secure checkout…
                  </>
                ) : (
                  'Continue to secure checkout'
                )}
              </button>
              <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
                Subscription renews monthly until you cancel in the Stripe Customer Portal.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
