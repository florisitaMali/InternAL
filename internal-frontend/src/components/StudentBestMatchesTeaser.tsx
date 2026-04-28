'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import type { Opportunity } from '@/src/types';
import OpportunityRecordCard from '@/src/components/OpportunityRecordCard';
import { cn } from '@/src/lib/utils';

/** Number of matches shown in full before the premium blur teaser. */
export const BEST_MATCHES_PREVIEW_COUNT = 2;

type Props = {
  loading: boolean;
  matches: Opportunity[];
  onViewDetails: (opp: Opportunity) => void;
  onApply: (opp: Opportunity) => void;
  hasAppliedToOpportunity: (opp: Opportunity) => boolean;
  onUpgrade: () => void;
  onGoToProfile?: () => void;
};

export default function StudentBestMatchesTeaser({
  loading,
  matches,
  onViewDetails,
  onApply,
  hasAppliedToOpportunity,
  onUpgrade,
  onGoToProfile,
}: Props) {
  const preview = matches.slice(0, BEST_MATCHES_PREVIEW_COUNT);
  const locked = matches.slice(BEST_MATCHES_PREVIEW_COUNT);
  const lockedCount = locked.length;

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
        Finding your best skill matches…
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/90 to-white p-8 text-center shadow-sm ring-1 ring-amber-100/80">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-amber-500" strokeWidth={1.75} aria-hidden />
          <h3 className="text-lg font-bold text-slate-900">No skill-based matches yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            Add skills to your profile so we can rank opportunities that fit you. Premium members will also get
            AI-matched picks here.
          </p>
          {onGoToProfile ? (
            <button
              type="button"
              onClick={onGoToProfile}
              className="mt-6 rounded-xl bg-[#002B5B] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#001F42]"
            >
              Update my profile
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2 gap-y-1">
          <Sparkles className="h-7 w-7 text-amber-500" strokeWidth={1.75} aria-hidden />
          <h2 className="text-2xl font-bold tracking-tight text-[#002B5B] md:text-3xl">Best Matches</h2>
          <span
            className={cn(
              'rounded-full border border-amber-300/80 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900'
            )}
          >
            Premium preview
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Roles ranked by how many of your profile skills overlap with each listing.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-700/90">Your top picks</p>
        {preview.map((opp) => (
          <OpportunityRecordCard
            key={opp.id}
            opportunity={opp}
            onViewDetails={() => onViewDetails(opp)}
            showApply={!hasAppliedToOpportunity(opp)}
            onApply={() => onApply(opp)}
          />
        ))}
      </div>

      {lockedCount > 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/90 bg-amber-50/20 shadow-inner ring-1 ring-amber-100/60">
          <div
            className="pointer-events-none select-none space-y-3 px-3 py-4 opacity-[0.55] blur-[8px]"
            aria-hidden
          >
            {locked.map((opp) => (
              <OpportunityRecordCard
                key={opp.id}
                opportunity={opp}
                onViewDetails={() => {}}
                showApply={false}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/75 via-white/90 to-amber-50/95 px-4 py-10 backdrop-blur-[3px]">
            <div className="max-w-md rounded-2xl border-2 border-amber-300/90 bg-white p-8 text-center shadow-xl ring-4 ring-amber-100/40">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Sparkles className="h-7 w-7" strokeWidth={2} aria-hidden />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Unlock the rest</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Our agent found <strong className="text-amber-900">{lockedCount}</strong> more{' '}
                {lockedCount === 1 ? 'opportunity' : 'opportunities'} that match your profile. Upgrade to Premium to
                unlock them.
              </p>
              <button
                type="button"
                onClick={onUpgrade}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:from-amber-600 hover:to-amber-700"
              >
                Upgrade to Premium
              </button>
              <p className="mt-3 text-[11px] font-medium text-slate-400">Gold highlights mark Premium areas across the app.</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
