'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, CreditCard, Loader2, Smartphone, Sparkles } from 'lucide-react';
import {
  clearCheckoutAccessToken,
  PREMIUM_STUDENT_PROFILE_KEY,
  resolveBackendAccessToken,
} from '@/src/lib/auth/getSessionAccessToken';
import {
  completeMockPremiumPayment,
  fetchCurrentStudentProfile,
  mapStudentProfileToStudent,
} from '@/src/lib/auth/userAccount';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

const PAYMENT_OPTIONS = [
  {
    id: 'CARD',
    label: 'Card',
    description: 'Visa, Mastercard, and other major cards (demo).',
    Icon: CreditCard,
  },
  {
    id: 'WALLET',
    label: 'Mobile wallet',
    description: 'Apple Pay / Google Pay style (demo).',
    Icon: Smartphone,
  },
] as const;

type Gate = 'loading' | 'login' | 'already' | 'checkout';

export default function PremiumCheckoutPage() {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>('loading');
  const [resolvedToken, setResolvedToken] = useState<string | null>(null);
  const [method, setMethod] = useState<string>('CARD');
  const [payPhase, setPayPhase] = useState<'idle' | 'processing'>('idle');

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
        setGate('already');
        return;
      }
      setGate('checkout');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePay = async () => {
    const token = resolvedToken ?? (await resolveBackendAccessToken());
    if (!token?.trim()) {
      toast.error('Please sign in again from the home page, then return here.');
      setGate('login');
      return;
    }
    setPayPhase('processing');
    try {
      const { data, errorMessage } = await completeMockPremiumPayment(token, method);
      if (!data || errorMessage) {
        toast.error(errorMessage || 'Could not complete checkout.');
        setPayPhase('idle');
        return;
      }
      clearCheckoutAccessToken();
      try {
        sessionStorage.setItem(PREMIUM_STUDENT_PROFILE_KEY, JSON.stringify(data));
      } catch {
        /* ignore quota */
      }
      setPayPhase('idle');
      router.replace('/');
    } catch {
      toast.error('Something went wrong.');
      setPayPhase('idle');
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
            token is sent securely with each payment request.
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
          <Link
            href="/"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700"
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
              <p className="mt-1 text-sm text-slate-600">Benefits and payment on one page — demo checkout, no real charges.</p>
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
                  <strong className="text-slate-900">Premium highlights</strong> across Explore and matches so
                  high-fit roles stand out.
                </span>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <strong className="text-slate-900">Coming soon:</strong> smarter recommendations and alerts tied to
                  your profile.
                </span>
              </li>
            </ul>
          </section>

          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Payment method</h2>
              <p className="mt-1 text-sm text-slate-600">Demo only — no real charges. Choose any option to run the mock flow.</p>

              <div className="mt-4 space-y-2">
                {PAYMENT_OPTIONS.map(({ id, label, description, Icon }) => {
                  const selected = method === id;
                  return (
                    <label
                      key={id}
                      className={cn(
                        'flex cursor-pointer gap-3 rounded-xl border px-3 py-3 transition',
                        selected
                          ? 'border-[#002B5B] bg-sky-50 ring-2 ring-[#002B5B]/15'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="premiumPayment"
                        value={id}
                        checked={selected}
                        onChange={() => setMethod(id)}
                        disabled={payPhase === 'processing'}
                        className="mt-1 accent-[#002B5B] disabled:opacity-50"
                      />
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#002B5B]" aria-hidden />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{label}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-snug text-slate-600">{description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={payPhase === 'processing'}
                onClick={() => void handlePay()}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:from-amber-600 hover:to-amber-700 disabled:opacity-60"
              >
                {payPhase === 'processing' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    Processing demo payment…
                  </>
                ) : (
                  'Complete checkout (demo)'
                )}
              </button>
              <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
                Production will verify payment with your card or wallet provider before activating Premium.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
