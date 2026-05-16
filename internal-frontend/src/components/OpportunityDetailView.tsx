'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building,
  Calendar,
  Clock,
  GraduationCap,
  MapPin,
  Rocket,
  Users,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  formatDeadline,
  formatDurationCodeLabel,
  formatOpportunityType,
  formatPostedDisplay,
  formatTargetUniversitiesDisplay,
  formatWorkTypeLabel,
} from '@/src/lib/opportunityFormat';
import type { Opportunity } from '@/src/types';

function collaborationNamesLine(list: { universityId: number; name: string }[] | undefined): string {
  if (!list?.length) return '—';
  return list
    .map((t) => (t.name?.trim() ? t.name.trim() : `University ${t.universityId}`))
    .join(', ');
}

function CollaborationPendingOnePerLine({
  list,
  rowClassName,
}: {
  list: { universityId: number; name: string }[];
  rowClassName: string;
}) {
  return (
    <div className="mt-0.5 flex flex-col gap-1">
      {list.map((t, i) => (
        <p key={`pending-${t.universityId}-${i}`} className={rowClassName}>
          {t.name?.trim() ? t.name.trim() : `University ${t.universityId}`}
        </p>
      ))}
    </div>
  );
}

export type OpportunityDetailViewProps = {
  opportunity: Opportunity;
  variant: 'company' | 'student';
  onBack: () => void;
  onNavigateToApplications?: () => void;
  isPublishingOpportunity?: boolean;
  onPublishOpportunity?: (opportunity: Opportunity) => void;
  onApply?: (opportunity: Opportunity) => void;
  applyDisabled?: boolean;
  applyLabel?: string;
  /** When set (student routes), company name links to this URL instead of using onCompanyNameClick. */
  companyProfileHref?: string;
  onCompanyNameClick?: () => void;
  /** Defaults to true for company, false for student */
  showApplicationStats?: boolean;
  /** When false, hide the back link (e.g. embedded under application view). Default true. */
  showBackButton?: boolean;
  /** When true, omit outer listing card and flatten sidebar (parent panel provides the card). */
  embeddedInCard?: boolean;
  /** University admin: accept/decline collaboration while status is pending for this university. */
  universityAdminCollaboration?: {
    linkedUniversityId: number;
    onAccept: () => void | Promise<void>;
    onReject: () => void | Promise<void>;
    busy: boolean;
  };
};

const defaultApplicationStats = { total: 0, inReview: 0, approved: 0, rejected: 0 };

function collaborationRequestBadge(raw: string | null | undefined): { text: string; className: string } {
  const t = (raw ?? '').trim().toUpperCase();
  if (t === 'APPROVED') {
    return { text: 'Approved', className: 'bg-emerald-100 text-emerald-900' };
  }
  if (t === 'REJECTED') {
    return { text: 'Declined', className: 'bg-slate-200 text-slate-700' };
  }
  return { text: 'Awaiting response', className: 'bg-amber-100 text-amber-900' };
}

function postedDisplay(opp: Opportunity) {
  if (opp.draft === true) {
    return 'Draft — not posted. Students cannot see this listing yet.';
  }
  if (opp.postedLabel) return opp.postedLabel;
  if (opp.postedAt) return formatPostedDisplay(opp.postedAt);
  return '—';
}

export default function OpportunityDetailView({
  opportunity,
  variant,
  onBack,
  onNavigateToApplications,
  isPublishingOpportunity,
  onPublishOpportunity,
  onApply,
  applyDisabled,
  applyLabel,
  companyProfileHref,
  onCompanyNameClick,
  showApplicationStats,
  showBackButton = true,
  embeddedInCard = false,
  universityAdminCollaboration,
}: OpportunityDetailViewProps) {
  const stats = opportunity.applicationStats ?? defaultApplicationStats;
  const embedded = embeddedInCard === true;
  const showStats = showApplicationStats ?? variant === 'company';
  const jobType =
    opportunity.jobTypeLabel ??
    formatWorkTypeLabel(opportunity.workType) ??
    opportunity.type ??
    '—';
  const duration =
    opportunity.durationLabel ?? formatDurationCodeLabel(opportunity.duration) ?? '—';
  const location = opportunity.location ?? '—';
  const workMode = opportunity.workMode ?? '—';
  const startDate =
    opportunity.startDateLabel ?? formatDeadline(opportunity.startDate) ?? '—';
  const appDeadline = formatDeadline(opportunity.deadline);
  const positions =
    opportunity.positionCount != null ? String(opportunity.positionCount) : '—';
  const paidLabel =
    opportunity.isPaid === true ? 'Yes' : opportunity.isPaid === false ? 'No' : '—';
  const salaryLabel =
    opportunity.isPaid === true && opportunity.salaryMonthly != null
      ? `${opportunity.salaryMonthly.toLocaleString()} / month`
      : '—';
  const targetUniversitiesLabel = formatTargetUniversitiesDisplay(opportunity);
  const embeddedStudentMeta = [location, workMode, jobType, duration].filter((v) => v && v !== '—');
  const bucketsProvided =
    opportunity.collaborationApproved != null ||
    opportunity.collaborationRejected != null ||
    opportunity.collaborationPending != null;
  const approvedList = opportunity.collaborationApproved ?? [];
  const rejectedList = opportunity.collaborationRejected ?? [];
  let pendingList = opportunity.collaborationPending ?? [];
  if (!bucketsProvided) {
    const tu = opportunity.targetUniversities;
    if (tu?.length) {
      pendingList = tu.map((t) => ({
        universityId: t.universityId,
        name: t.name?.trim() ? t.name.trim() : `University ${t.universityId}`,
      }));
    } else {
      const ids = opportunity.targetUniversityIds?.filter(Boolean) ?? [];
      if (ids.length) {
        pendingList = ids.map((id) => ({
          universityId: Number(id),
          name: `University ${id}`,
        }));
      }
    }
  }
  const hasCollabBuckets =
    approvedList.length + rejectedList.length + pendingList.length > 0;
  const uid = universityAdminCollaboration?.linkedUniversityId;
  const myCollabPending =
    uid != null && universityAdminCollaboration != null && pendingList.some((t) => t.universityId === uid);
  const myCollabApproved =
    uid != null && approvedList.some((t) => t.universityId === uid);
  const myCollabRejected =
    uid != null && rejectedList.some((t) => t.universityId === uid);

  const universityCollaborationBanner =
    universityAdminCollaboration != null &&
    (myCollabPending || myCollabApproved || myCollabRejected) ? (
      <div
        className="rounded-xl border border-indigo-200 bg-indigo-50/90 p-4 md:p-5 shadow-sm"
        role="region"
        aria-label="University collaboration"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-900/70">
          Collaboration with your university
        </p>
        {myCollabPending ? (
          <>
            <p className="mt-2 text-sm font-semibold text-slate-900 leading-snug">
              This company is requesting your approval to collaborate on this listing.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={universityAdminCollaboration.busy}
                onClick={() => void universityAdminCollaboration.onAccept()}
                className="inline-flex justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {universityAdminCollaboration.busy ? 'Saving…' : 'Approve collaboration'}
              </button>
              <button
                type="button"
                disabled={universityAdminCollaboration.busy}
                onClick={() => void universityAdminCollaboration.onReject()}
                className="inline-flex justify-center rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          </>
        ) : myCollabApproved ? (
          <p className="mt-2 text-sm font-semibold text-slate-900 leading-snug">
            You have approved collaboration for this opportunity.
          </p>
        ) : (
          <p className="mt-2 text-sm font-semibold text-slate-900 leading-snug">
            You have declined collaboration for this opportunity.
          </p>
        )}
      </div>
    ) : null;

  const companyNameEl =
    companyProfileHref ? (
      <Link
        href={companyProfileHref}
        className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
      >
        {opportunity.companyName}
      </Link>
    ) : onCompanyNameClick ? (
      <button
        type="button"
        onClick={onCompanyNameClick}
        className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline text-left"
      >
        {opportunity.companyName}
      </button>
    ) : (
      <span className="font-semibold text-emerald-700">{opportunity.companyName}</span>
    );

  return (
    <div className="space-y-6">
      {showBackButton ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#0E2A50] hover:text-[#002B5B]"
        >
          <ArrowLeft size={18} />
          {variant === 'student' ? 'Back' : 'Back to Opportunities'}
        </button>
      ) : null}

      {universityCollaborationBanner}

      <div
        className={cn(
          embedded
            ? opportunity.draft === true
              ? 'space-y-6 rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-4 sm:px-5 sm:py-5'
              : 'space-y-6'
            : 'rounded-xl border p-6 shadow-sm md:p-8',
          !embedded && opportunity.draft === true
            ? 'border-amber-200 bg-amber-50/40'
            : !embedded && opportunity.draft !== true
              ? 'border-slate-200 bg-white'
              : null
        )}
      >
        {opportunity.draft === true ? (
          <div
            className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            <span className="font-bold">Draft</span>
            <span className="text-amber-900">
              {' '}
              — This listing is not live. It is not shown to students and does not accept applications until you
              publish it.
            </span>
          </div>
        ) : null}
        {embedded && variant === 'student' ? (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-4">
                <div className="mt-1 h-12 w-12 shrink-0 rounded-xl bg-[#002B5B]" aria-hidden />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 gap-y-1">
                    <h5 className="text-xl font-bold text-[#0E2A50]">{opportunity.title}</h5>
                    {opportunity.draft === true ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900">
                        Draft
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-sm">{companyNameEl}</div>
                  {embeddedStudentMeta.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {embeddedStudentMeta.map((item, i) => (
                        <span key={`${opportunity.id}-meta-${i}-${item}`}>{item}</span>
                      ))}
                    </div>
                  ) : null}
                  {(opportunity.requiredSkills ?? []).length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(opportunity.requiredSkills ?? []).slice(0, 5).map((skill) => (
                        <span
                          key={`${opportunity.id}-skill-${skill}`}
                          className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-600">
                {opportunity.description ? (
                  <div>
                    <p className="font-semibold text-slate-900">About the role</p>
                    <p className="mt-1 leading-6">{opportunity.description}</p>
                  </div>
                ) : null}
                {opportunity.responsibilities?.length ? (
                  <div>
                    <p className="font-semibold text-slate-900">Responsibilities</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {opportunity.responsibilities.slice(0, 3).map((item, i) => (
                        <li key={`${opportunity.id}-resp-${i}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="w-full border-t border-slate-100 pt-4 lg:w-64 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <p className="text-sm font-bold text-slate-950">Overview</p>
              <div className="mt-3 space-y-3">
                {(
                  [
                    ...(!hasCollabBuckets ? ([['TARGET UNIVERSITIES', targetUniversitiesLabel]] as [string, string][]) : []),
                    ['APPLICATION DEADLINE', appDeadline],
                    ['START DATE', startDate],
                    ['POSITIONS', positions],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                    <p className="mt-0.5 text-sm font-bold text-[#0E2A50]">{value || '—'}</p>
                  </div>
                ))}
                {hasCollabBuckets ? (
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    {approvedList.length > 0 ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Approved by
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-[#0E2A50]">
                          {collaborationNamesLine(approvedList)}
                        </p>
                      </div>
                    ) : null}
                    {rejectedList.length > 0 ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Rejected by
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-[#0E2A50]">
                          {collaborationNamesLine(rejectedList)}
                        </p>
                      </div>
                    ) : null}
                    {pendingList.length > 0 ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Pending response
                        </p>
                        <CollaborationPendingOnePerLine
                          list={pendingList}
                          rowClassName="text-sm font-bold text-[#0E2A50]"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                'flex flex-col gap-6 lg:flex-row lg:items-start',
                embedded ? '' : 'lg:justify-between'
              )}
            >
              <div className="flex flex-1 flex-col gap-4 min-w-0 sm:flex-row sm:items-start">
                <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-[#002B5B]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 gap-y-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-[#0E2A50]">{opportunity.title}</h1>
                    {opportunity.draft === true ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900">
                        Draft
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {companyProfileHref ? (
                      <Link
                        href={companyProfileHref}
                        className="font-semibold text-[#20948B] hover:text-[#0f766e] hover:underline"
                      >
                        {opportunity.companyName}
                      </Link>
                    ) : onCompanyNameClick ? (
                      <button
                        type="button"
                        onClick={onCompanyNameClick}
                        className="font-semibold text-[#20948B] hover:text-[#0f766e] hover:underline text-left"
                      >
                        {opportunity.companyName}
                      </button>
                    ) : (
                      opportunity.companyName
                    )}
                  </p>
                  {opportunity.affiliatedUniversityName?.trim() ? (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
                      <GraduationCap size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
                      <span>
                        <span className="font-semibold text-slate-500">Employer university</span>
                        <span className="text-slate-400"> · </span>
                        {opportunity.affiliatedUniversityName.trim()}
                      </span>
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400" />
                      {location}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Building size={14} className="text-slate-400" />
                      {workMode}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} className="text-slate-400" />
                      {jobType}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={14} className="text-slate-400" />
                      {duration}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(opportunity.requiredSkills ?? []).map((skill) => (
                      <span
                        key={`${opportunity.id}-skill-${skill}`}
                        className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-3 sm:items-end lg:min-w-[220px]">
                {variant === 'company' ? (
                  <>
                    <button
                      type="button"
                      suppressHydrationWarning
                      onClick={() => {
                        onNavigateToApplications?.();
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#002B5B] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#001F42]"
                    >
                      <Users size={18} />
                      View Applications ({stats.total})
                    </button>
                    {opportunity.draft === true && onPublishOpportunity ? (
                      <button
                        type="button"
                        suppressHydrationWarning
                        disabled={isPublishingOpportunity}
                        onClick={() => void onPublishOpportunity(opportunity)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Rocket size={18} />
                        {isPublishingOpportunity ? 'Publishing…' : 'Publish opportunity'}
                      </button>
                    ) : null}
                    <p className="text-right text-xs text-slate-400">{postedDisplay(opportunity)}</p>
                  </>
                ) : (
                  <>
                    {onApply ? (
                      <button
                        type="button"
                        disabled={applyDisabled}
                        onClick={() => onApply(opportunity)}
                        className={cn(
                          'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors',
                          applyDisabled
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-[#002B5B] text-white hover:bg-[#001F42]'
                        )}
                      >
                        {applyLabel ?? 'Apply Now'}
                      </button>
                    ) : null}
                    <p className="text-right text-xs text-slate-400">{postedDisplay(opportunity)}</p>
                  </>
                )}
              </div>
            </div>

            <div
              className={cn(
                embedded ? 'mt-5 flex flex-col gap-5 lg:flex-row lg:items-start' : 'mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3'
              )}
            >
              <div className={cn(embedded ? 'min-w-0 flex-1 space-y-8' : 'space-y-8 lg:col-span-2')}>
                <section>
                  <h2 className="text-lg font-bold text-slate-900">About the Role</h2>
                  {opportunity.description ? (
                    <p className="mt-3 text-sm leading-7 text-slate-600">{opportunity.description}</p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">No description yet.</p>
                  )}
                  {opportunity.roleSummary ? (
                    <p className="mt-4 text-sm leading-7 text-slate-600">{opportunity.roleSummary}</p>
                  ) : null}
                  {opportunity.roleAboutExtra ? (
                    <p className="mt-4 text-sm leading-7 text-slate-600">{opportunity.roleAboutExtra}</p>
                  ) : null}
                </section>

                <section>
                  <h2 className="text-lg font-bold text-slate-900">Responsibilities</h2>
                  {opportunity.responsibilities?.length ? (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
                      {opportunity.responsibilities.map((item, i) => (
                        <li key={`${opportunity.id}-resp-${i}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">No responsibilities listed yet.</p>
                  )}
                </section>

                <section>
                  <h2 className="text-lg font-bold text-slate-900">Requirements</h2>
                  {opportunity.requirements?.length ? (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
                      {opportunity.requirements.map((item, i) => (
                        <li key={`${opportunity.id}-req-${i}`}>{item}</li>
                      ))}
                    </ul>
                  ) : opportunity.requiredExperience ? (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
                      <li>{opportunity.requiredExperience}</li>
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">No requirements listed yet.</p>
                  )}
                </section>

                {opportunity.niceToHave?.trim() ? (
                  <section>
                    <h2 className="text-lg font-bold text-slate-900">Additional notes (nice to have)</h2>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                      {opportunity.niceToHave}
                    </p>
                  </section>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                  <h3 className="text-base font-bold text-slate-900">Overview</h3>
                  <dl className="mt-4 space-y-3">
                    {[
                      ...(!hasCollabBuckets ? ([['TARGET UNIVERSITIES', targetUniversitiesLabel]] as [string, string][]) : []),
                      ['APPLICATION DEADLINE', appDeadline],
                      ['START DATE', startDate],
                      ['POSITIONS', positions],
                      ['JOB TYPE', jobType],
                      ['DURATION', duration],
                      ['LOCATION', location],
                      ['WORK MODE', workMode],
                      ['PAID', paidLabel],
                      ['MONTHLY SALARY', salaryLabel],
                      ...(variant === 'student' && opportunity.type
                        ? ([['TYPE', formatOpportunityType(opportunity.type)]] as [string, string][])
                        : []),
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</dt>
                        <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {hasCollabBuckets ? (
                    <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
                      {approvedList.length > 0 ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Approved by
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {collaborationNamesLine(approvedList)}
                          </p>
                        </div>
                      ) : null}
                      {rejectedList.length > 0 ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Rejected by
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {collaborationNamesLine(rejectedList)}
                          </p>
                        </div>
                      ) : null}
                      {pendingList.length > 0 ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Pending response
                          </p>
                          <CollaborationPendingOnePerLine
                            list={pendingList}
                            rowClassName="text-sm font-medium text-slate-800"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {variant === 'company' && (opportunity.targetUniversities?.length ?? 0) > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                    <h3 className="text-base font-bold text-slate-900">University collaboration</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Each invited university and its response to your collaboration request.
                    </p>
                    <ul
                      className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white"
                      aria-label="Collaboration status by university"
                    >
                      {(opportunity.targetUniversities ?? []).map((t) => {
                        const st = collaborationRequestBadge(t.collaborationStatus);
                        return (
                          <li
                            key={`${opportunity.id}-collab-${t.universityId}`}
                            className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                          >
                            <span className="font-semibold text-slate-800">{t.name}</span>
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                st.className
                              )}
                            >
                              {st.text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {showStats ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                    <h3 className="text-base font-bold text-slate-900">Application Stats</h3>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-600">Total Applicants</dt>
                        <dd className="font-bold text-slate-900">{stats.total}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-600">In Review</dt>
                        <dd className="font-semibold text-blue-600">{stats.inReview}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-600">Approved</dt>
                        <dd className="font-semibold text-emerald-600">{stats.approved}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-600">Rejected</dt>
                        <dd className="font-semibold text-slate-500">{stats.rejected}</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
