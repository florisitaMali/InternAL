'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { CompanyProfileFromApi } from '@/src/types';
import CompanyProfileReadOnlyView from '@/src/components/CompanyProfileReadOnlyView';

type Props = {
  profile: CompanyProfileFromApi;
  onClose: () => void;
};

export default function CompanyProfileReadOnlyModal({ profile, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-slate-950/55 px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:px-6 sm:pb-20 sm:pt-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-company-profile-title"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 min-h-11 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-md border border-slate-200 hover:bg-slate-50"
          >
            <X size={22} strokeWidth={2.25} aria-hidden />
            Close
          </button>
        </div>

        <CompanyProfileReadOnlyView profile={profile} titleId="student-company-profile-title" />
      </div>
    </div>
  );
}
