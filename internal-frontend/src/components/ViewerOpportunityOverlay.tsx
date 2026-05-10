'use client';

import React from 'react';
import { X } from 'lucide-react';
import OpportunityDetailView from '@/src/components/OpportunityDetailView';
import type { Opportunity } from '@/src/types';
import { cn } from '@/src/lib/utils';
import Logo from '@/src/components/Logo';

type Props = {
  /** When false, nothing is rendered (parent keeps fetch state). */
  open: boolean;
  opportunity: Opportunity | null;
  loading: boolean;
  onClose: () => void;
  /** Matches app shell sidebar width so the panel does not cover nav (md+). */
  sidebarExpanded?: boolean;
};

/** Full-width viewer panel (same shell as {@link ViewerStudentProfileOverlay}). */
export default function ViewerOpportunityOverlay({
  open,
  opportunity,
  loading,
  onClose,
  sidebarExpanded = true,
}: Props) {
  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed top-0 right-0 bottom-0 z-[120] flex flex-col bg-[#F9FAFB]',
        'max-md:left-0',
        sidebarExpanded ? 'md:left-72' : 'md:left-16'
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Opportunity information"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8 shadow-sm">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Logo size="md" showText={false} className="shrink-0 md:hidden" />
          <div className="hidden md:flex items-center scale-75 origin-left">
            <Logo />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-6xl">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#002B5B]/30 border-t-[#002B5B]" />
            </div>
          ) : opportunity ? (
            <OpportunityDetailView
              variant="student"
              opportunity={opportunity}
              onBack={onClose}
              showBackButton={false}
              showApplicationStats={false}
            />
          ) : (
            <p className="text-center text-sm text-slate-500">
              Full opportunity details could not be loaded for this listing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
