'use client';

import React from 'react';
import { Briefcase, Calendar } from 'lucide-react';
import type { Opportunity } from '@/src/types';
import { formatDeadline, getOpportunityCardInitials } from '@/src/lib/opportunityFormat';
import { cn } from '@/src/lib/utils';

export type OpportunityRecordCardProps = {
  opportunity: Opportunity;
  onViewDetails: () => void;
  showApply?: boolean;
  onApply?: () => void;
};

const OpportunityRecordCard: React.FC<OpportunityRecordCardProps> = ({
  opportunity,
  onViewDetails,
  showApply = false,
  onApply,
}) => {
  const isDraft = opportunity.draft === true;

  return (
    <div
      className={cn(
        'rounded-2xl border shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-all duration-200',
        isDraft ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xs tracking-wide',
          isDraft ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-500'
        )}
      >
        {getOpportunityCardInitials(opportunity.companyName)}
      </div>

      <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <h3 className="text-base font-bold text-slate-900 leading-snug">{opportunity.title}</h3>
            {isDraft ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                Draft
              </span>
            ) : null}
          </div>
          <p className="text-[#20948B] text-sm font-semibold mt-0.5">{opportunity.companyName}</p>
          {isDraft ? (
            <p className="mt-1 text-xs font-medium text-amber-900/90">Not posted — students cannot see this yet.</p>
          ) : null}
          <p className="text-slate-500 text-sm mt-2 line-clamp-1">
            {opportunity.description || 'No description provided.'}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Calendar size={13} className="flex-shrink-0" />
              Deadline: {formatDeadline(opportunity.deadline)}
            </span>
            {opportunity.requiredExperience && (
              <span className="flex items-center gap-1.5">
                <Briefcase size={13} className="flex-shrink-0" />
                {opportunity.requiredExperience}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onViewDetails}
            suppressHydrationWarning
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all whitespace-nowrap"
          >
            View Details
          </button>
          {showApply ? (
            <button
              type="button"
              onClick={onApply}
              suppressHydrationWarning
              className="px-4 py-2 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#001F42] transition-all whitespace-nowrap"
            >
              Apply
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default OpportunityRecordCard;
