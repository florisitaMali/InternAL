'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import {
  PREMIUM_STUDENT_PROFILE_KEY,
  resolveBackendAccessToken,
} from '@/src/lib/auth/getSessionAccessToken';
import {
  fetchCurrentStudentProfile,
  mapStudentProfileToStudent,
} from '@/src/lib/auth/userAccount';

const POLL_MS = 2000;
const MAX_WAIT_MS = 90_000;

type Screen = 'loading' | 'login' | 'pending' | 'timeout';

export default function PremiumSuccessPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('loading');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = await resolveBackendAccessToken();
      if (cancelled) return;
      if (!token) {
        setScreen('login');
        return;
      }

      setScreen('pending');
      const start = Date.now();

      const tick = async () => {
        if (cancelled) return;
        const { data: profile, errorMessage } = await fetchCurrentStudentProfile(token);
        if (cancelled) return;
        if (errorMessage || !profile) {
          setScreen('login');
          return;
        }
        const student = mapStudentProfileToStudent(profile);
        if (student.hasPremium) {
          try {
            sessionStorage.setItem(PREMIUM_STUDENT_PROFILE_KEY, JSON.stringify(student));
          } catch {
            /* ignore quota */
          }
          router.replace('/');
          return;
        }
        if (Date.now() - start > MAX_WAIT_MS) {
          setScreen('timeout');
          return;
        }
        setTimeout(() => void tick(), POLL_MS);
      };

      await tick();
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (screen === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#002B5B]" aria-hidden />
        <p className="text-sm text-slate-600">Confirming your subscription…</p>
      </div>
    );
  }

  if (screen === 'login') {
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
            Sign in on the home page to finish activating Premium on your account.
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

  if (screen === 'timeout') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#002B5B] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to InternAL
        </Link>
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/50 p-8 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Sparkles className="h-6 w-6" strokeWidth={2} aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Still activating</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Payment can take a few seconds to sync. Open the app again from the home page — Premium unlocks once our
            servers confirm the subscription.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#002B5B] py-3 text-sm font-bold text-white hover:bg-[#001F42]"
          >
            Return home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
      <Loader2 className="h-10 w-10 animate-spin text-[#002B5B]" aria-hidden />
      <p className="max-w-sm text-center text-sm text-slate-600">
        Activating Premium… This usually takes just a moment after Stripe confirms payment.
      </p>
    </div>
  );
}
