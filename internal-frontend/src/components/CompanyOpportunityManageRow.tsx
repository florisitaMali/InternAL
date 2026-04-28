'use client';

import React from 'react';
import { Briefcase, Calendar, MapPin, Users } from 'lucide-react';
import type { Opportunity } from '@/src/types';
import { cn } from '@/src/lib/utils';

export type CompanyOpportunityManageRowProps = {
  opportunity: Opportunity;
  postedLabel: string;
  onViewApplications: () => void;
  onViewDetails: () => void;
};

const CompanyOpportunityManageRow: React.FC<CompanyOpportunityManageRowProps> = ({
  opportunity,
  postedLabel,
  onViewApplications,
  onViewDetails,
}) => {
  const skills = opportunity.requiredSkills?.length ? opportunity.requiredSkills : [];
  const workMode = opportunity.workMode?.trim() || 'Hybrid';
  const duration = opportunity.durationLabel?.trim() || '3-6 months';
  const location = opportunity.location?.trim() || '—';

  const isDraft = opportunity.draft === true;

  return (
    <div
      className={cn(
        'flex flex-col gap-5 rounded-2xl border p-5 shadow-sm lg:flex-row lg:items-stretch lg:gap-6 lg:p-6',
        isDraft ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
      )}
    >
      <div
        className={cn(
          'h-20 w-20 shrink-0 rounded-xl lg:h-[5.5rem] lg:w-[5.5rem]',
          isDraft ? 'bg-amber-200/80' : 'bg-[#002B5B]'
        )}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 gap-y-1">
          <h3 className="text-lg font-bold leading-snug text-[#0E2A50] lg:text-xl">{opportunity.title}</h3>
          {isDraft ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900">
              Draft
            </span>
          ) : null}
        </div>
        <p className={cn('mt-1 text-sm', isDraft ? 'text-amber-900/90' : 'text-slate-500')}>{postedLabel}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} className="shrink-0 text-slate-400" />
            {location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Briefcase size={14} className="shrink-0 text-slate-400" />
            {workMode}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={14} className="shrink-0 text-slate-400" />
            {duration}
          </span>
        </div>
        {skills.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={`${opportunity.id}-${skill}`}
                className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-[#0E4A7A]"
              >
                {skill}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2 lg:w-[11rem]">
        <button
          type="button"
          onClick={onViewApplications}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white',
            'bg-[#002B5B] shadow-sm transition-colors hover:bg-[#001F42]'
          )}
        >
          <Users size={16} className="shrink-0" />
          View Applications
        </button>
        <button
          type="button"
          onClick={onViewDetails}
          className="rounded-full border-2 border-[#002B5B] bg-white px-4 py-2.5 text-sm font-bold text-[#0E2A50] transition-colors hover:bg-slate-50"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

export default CompanyOpportunityManageRow;
