'use client';

import React from 'react';
import { Building2, Clock, MapPin } from 'lucide-react';
import type { Opportunity } from '@/src/types';
import {
  formatDbDuration,
  formatRelativePosted,
  getOpportunityCardInitials,
} from '@/src/lib/opportunityFormat';
import { cn } from '@/src/lib/utils';

function formatExploreWorkMode(mode?: string | null): string {
  if (!mode) return '';
  const map: Record<string, string> = {
    REMOTE: 'Remote',
    HYBRID: 'Hybrid',
    IN_PERSON: 'In-person',
    Remote: 'Remote',
    Hybrid: 'Hybrid',
    'On-site': 'On-site',
  };
  return map[mode] ?? mode;
}

export type StudentOpportunityExploreCardProps = {
  opportunity: Opportunity;
  hasApplied: boolean;
  onCompanyNameClick: () => void;
  onOpenDetail: () => void;
  onApply: () => void;
};

/** Student Explore / Best Matches card — matches layout between tabs. */
export default function StudentOpportunityExploreCard({
  opportunity: opp,
  hasApplied,
  onCompanyNameClick,
  onOpenDetail,
  onApply,
}: StudentOpportunityExploreCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow duration-200 flex flex-col">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-14 h-14 bg-[#002B5B] rounded-lg flex items-center justify-center font-bold text-white text-sm tracking-wide">
          {getOpportunityCardInitials(opp.companyName)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-[#002B5B] leading-snug">{opp.title}</h3>
          <p className="text-slate-600 text-sm font-medium mt-0.5">
            <button
              type="button"
              onClick={onCompanyNameClick}
              className="text-left hover:text-[#002B5B] hover:underline"
            >
              {opp.companyName}
            </button>
          </p>
          <p className="text-xs text-slate-400 mt-1">{formatRelativePosted(opp.createdAt)}</p>
        </div>
      </div>

      <p className="text-slate-600 text-sm mt-4 leading-relaxed line-clamp-2">
        {opp.description || 'No description provided.'}
      </p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-slate-500">
        {opp.location ? (
          <span className="flex items-center gap-1.5">
            <MapPin size={14} className="flex-shrink-0 text-slate-400" />
            {opp.location}
          </span>
        ) : null}
        {opp.workMode ? (
          <span className="flex items-center gap-1.5">
            <Building2 size={14} className="flex-shrink-0 text-slate-400" />
            {formatExploreWorkMode(opp.workMode) || opp.workMode}
          </span>
        ) : null}
        {opp.duration ? (
          <span className="flex items-center gap-1.5">
            <Clock size={14} className="flex-shrink-0 text-slate-400" />
            {formatDbDuration(opp.duration)}
          </span>
        ) : null}
      </div>

      {opp.requiredSkills && opp.requiredSkills.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-4">
          {opp.requiredSkills.slice(0, 6).map((skill) => (
            <span
              key={skill}
              className="px-2.5 py-1 rounded-md bg-sky-100/90 text-xs font-semibold text-sky-900"
            >
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
        <span className="text-xs font-medium text-slate-500">
          {typeof opp.applicantCount === 'number'
            ? `${opp.applicantCount} applicant${opp.applicantCount === 1 ? '' : 's'}`
            : '—'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenDetail}
            suppressHydrationWarning
            className="px-4 py-2 border-2 border-[#002B5B] text-[#002B5B] bg-white rounded-xl text-sm font-bold hover:bg-slate-50 transition-all whitespace-nowrap"
          >
            View Details
          </button>
          <button
            type="button"
            disabled={hasApplied}
            onClick={onApply}
            suppressHydrationWarning
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-sm',
              hasApplied
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-[#002B5B] text-white hover:bg-[#001F42]'
            )}
          >
            {hasApplied ? 'Applied' : 'Apply Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
