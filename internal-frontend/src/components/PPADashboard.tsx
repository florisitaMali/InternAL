'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Dashboard from './Dashboard';
import UnderDevelopment from './UnderDevelopment';
import NotificationsPanel from './NotificationsPanel';
import ViewerStudentProfileOverlay from '@/src/components/ViewerStudentProfileOverlay';
import ViewerOpportunityOverlay from '@/src/components/ViewerOpportunityOverlay';
import SubmitApplicationModal from '@/src/components/SubmitApplicationModal';
import { fetchPpaApplications, fetchPpaStudents, patchPpaApplicationDecision } from '@/src/lib/auth/ppa';
import { fetchPpaOpportunityDetail } from '@/src/lib/auth/company';
import { fetchViewerStudentProfile } from '@/src/lib/auth/studentViewer';
import type { StudentProfileResponse } from '@/src/lib/auth/userAccount';
import type { AdminStudentRow } from '@/src/lib/auth/admin';
import type { ApplicationResponse } from '@/src/lib/auth/opportunities';
import type { Opportunity } from '@/src/types';
import { getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import { useNotificationUnreadCount } from '@/src/lib/auth/useNotificationUnreadCount';
import {
  Users,
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  AlertCircle,
  MoreVertical,
  Eye,
  User,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';

function formatPpaApplicationDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function labelApplicationType(t: string | null): string {
  const u = (t || '').toUpperCase().replace(/\s+/g, '_');
  if (u === 'PROFESSIONAL_PRACTICE') return 'Professional Practice';
  if (u === 'INDIVIDUAL_GROWTH') return 'Individual Growth';
  if (!t?.trim()) return '—';
  return t.replace(/_/g, ' ');
}

function ppaRowDecision(app: ApplicationResponse): 'WAITING' | 'APPROVED' | 'REJECTED' {
  if (app.isApprovedByPPA === false) return 'REJECTED';
  if (app.isApprovedByPPA === true) return 'APPROVED';
  return 'WAITING';
}

const PPA_STALE_DECISION_MS = 14 * 24 * 60 * 60 * 1000;

function isPpaWaitingOlderThanTwoWeeks(app: ApplicationResponse): boolean {
  if (app.isApprovedByPPA != null) return false;
  const raw = app.createdAt;
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t >= PPA_STALE_DECISION_MS;
}

function applicationCreatedAtTime(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Shape expected by {@link SubmitApplicationModal} `student` prop. */
function profileToSubmitModalStudent(profile: StudentProfileResponse): {
  fullName: string;
  email: string;
  university: string;
  department: string;
  studyField: string;
  studyYear: number;
  cgpa: number;
  cvFileName: string;
} {
  return {
    fullName: profile.fullName?.trim() || '—',
    email: profile.email?.trim() || '—',
    university: profile.universityName?.trim() || '—',
    department: profile.departmentName?.trim() || '—',
    studyField: profile.fieldName?.trim() || '—',
    studyYear: profile.studyYear ?? 1,
    cgpa: profile.cgpa ?? 0,
    cvFileName:
      profile.cvFilename?.trim() ||
      profile.cvFile?.originalFilename?.trim() ||
      'No CV uploaded',
  };
}

function PpaApplicationReviewHeaderMenu({
  waiting,
  decisionLoading,
  onApprove,
  onReject,
}: {
  waiting: boolean;
  decisionLoading: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const id = window.setTimeout(() => document.addEventListener('mousedown', close), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', close);
    };
  }, [open]);

  if (!waiting) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Application actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
      >
        <MoreVertical size={22} strokeWidth={2.25} aria-hidden />
      </button>
      {open && pos != null && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="menu"
              className="fixed z-[120] min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
              style={{ top: pos.top, right: pos.right }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                disabled={decisionLoading}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                onClick={() => {
                  setOpen(false);
                  onApprove();
                }}
              >
                <Check size={16} aria-hidden />
                Approve
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={decisionLoading}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                onClick={() => {
                  setOpen(false);
                  onReject();
                }}
              >
                <X size={16} aria-hidden />
                Reject
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/** Fixed coordinates for row action menu; avoids clipping by parents with overflow (e.g. table scroll). */
function applicationMenuFixedStyle(rect: DOMRectReadOnly): { right: number; top?: number; bottom?: number } {
  const MENU_EST_HEIGHT = 200;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUp = spaceBelow < MENU_EST_HEIGHT && spaceAbove > spaceBelow;
  const right = window.innerWidth - rect.right;
  if (openUp) {
    return { bottom: window.innerHeight - rect.top + 4, right };
  }
  return { top: rect.bottom + 4, right };
}

type PpaApplicationSort = 'approved_first' | 'rejected_first' | 'waiting_first' | 'newest' | 'oldest';

interface PPADashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  onToggleSidebar?: () => void;
  sidebarExpanded?: boolean;
  onNavigateTab?: (tab: string) => void;
}

const PPADashboard: React.FC<PPADashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
  onToggleSidebar,
  sidebarExpanded = true,
  onNavigateTab,
}) => {
  const { unreadCount, refresh: refreshUnreadNotifications } = useNotificationUnreadCount();
  const [searchTerm, setSearchTerm] = useState('');
  const [applicationSort, setApplicationSort] = useState<PpaApplicationSort>('waiting_first');
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [myStudents, setMyStudents] = useState<AdminStudentRow[]>([]);
  const [myStudentsError, setMyStudentsError] = useState<string | null>(null);
  const [showStudentFilters, setShowStudentFilters] = useState(false);
  const [myStudentsSearch, setMyStudentsSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<AdminStudentRow | null>(null);
  const [studentYearFilter, setStudentYearFilter] = useState<string[]>([]);
  const [studentFieldFilter, setStudentFieldFilter] = useState<string[]>([]);
  const [studentAppFilter, setStudentAppFilter] = useState<string[]>([]);
  const [studentStatusFilter, setStudentStatusFilter] = useState<string[]>([]);
  const [viewStudentProfileId, setViewStudentProfileId] = useState<number | null>(null);
  const [applicationDetailForView, setApplicationDetailForView] = useState<ApplicationResponse | null>(null);
  const [ppaModalStudent, setPpaModalStudent] = useState<{
    fullName: string;
    email: string;
    university: string;
    department: string;
    studyField: string;
    studyYear: number;
    cgpa: number;
    cvFileName: string;
  } | null>(null);
  const [applicationListingDetail, setApplicationListingDetail] = useState<Opportunity | null>(null);
  const [applicationListingDetailLoading, setApplicationListingDetailLoading] = useState(false);
  const [ppaOpportunityOverlayOpen, setPpaOpportunityOverlayOpen] = useState(false);
  const [ppaDecisionLoading, setPpaDecisionLoading] = useState(false);
  const [applicationMenu, setApplicationMenu] = useState<{
    key: string;
    app: ApplicationResponse;
    decision: ReturnType<typeof ppaRowDecision>;
    anchorRect: DOMRectReadOnly;
  } | null>(null);
  const [studentRowMenu, setStudentRowMenu] = useState<{
    key: string;
    student: AdminStudentRow;
    anchorRect: DOMRectReadOnly;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        toast.error('Not signed in.');
        return;
      }
      const [appsRes, studentsRes] = await Promise.all([
        fetchPpaApplications(accessToken),
        fetchPpaStudents(accessToken),
      ]);
      if (appsRes.errorMessage) toast.error(appsRes.errorMessage);
      else setApplications(appsRes.data || []);
      if (studentsRes.errorMessage) {
        toast.error(studentsRes.errorMessage);
        setMyStudentsError(studentsRes.errorMessage);
        setMyStudents([]);
      } else {
        setMyStudents(studentsRes.data || []);
        setMyStudentsError(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load PPA data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openApplicationFromNotification = useCallback(
    async (applicationId: number) => {
      if (activeTab !== 'applications') {
        onNavigateTab?.('applications');
      }

      let row = applications.find((a) => a.applicationId === applicationId) ?? null;
      if (!row) {
        const token = await getSessionAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const res = await fetchPpaApplications(token);
        if (res.errorMessage) {
          toast.error(res.errorMessage);
          return;
        }
        const list = res.data ?? [];
        setApplications(list);
        row = list.find((a) => a.applicationId === applicationId) ?? null;
      }

      if (!row) {
        toast.error('Could not open this application.');
        return;
      }
      setApplicationDetailForView(row);
    },
    [activeTab, applications, onNavigateTab]
  );

  const submitPpaDecision = useCallback(
    async (app: ApplicationResponse, approved: boolean) => {
      if (app.applicationId == null) {
        toast.error('Application id missing.');
        return;
      }
      setPpaDecisionLoading(true);
      try {
        const token = await getSessionAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const res = await patchPpaApplicationDecision(token, app.applicationId, approved);
        if (res.errorMessage) {
          toast.error(res.errorMessage);
          return;
        }
        toast.success(approved ? 'Application approved.' : 'Application rejected.');
        if (res.data) {
          setApplicationDetailForView((prev) =>
            prev?.applicationId === res.data?.applicationId ? res.data : prev
          );
        }
        await loadData();
        await refreshUnreadNotifications();
      } finally {
        setPpaDecisionLoading(false);
      }
    },
    [loadData, refreshUnreadNotifications]
  );

  useEffect(() => {
    const app = applicationDetailForView;
    if (!app) {
      setPpaModalStudent(null);
      setApplicationListingDetail(null);
      setApplicationListingDetailLoading(false);
      setPpaOpportunityOverlayOpen(false);
      return;
    }
    setPpaOpportunityOverlayOpen(false);
    setPpaModalStudent({
      fullName: app.studentName || '—',
      email: '—',
      university: '—',
      department: '—',
      studyField: '—',
      studyYear: 1,
      cgpa: 0,
      cvFileName: '—',
    });
    setApplicationListingDetail(null);
    setApplicationListingDetailLoading(false);
    let cancelled = false;
    void (async () => {
      const token = await getSessionAccessToken();
      if (!token || cancelled) return;
      if (app.studentId != null) {
        const prof = await fetchViewerStudentProfile(token, 'ppa', app.studentId);
        if (cancelled) return;
        if (prof.data) {
          setPpaModalStudent(profileToSubmitModalStudent(prof.data));
        }
      }
      if (app.opportunityId != null) {
        setApplicationListingDetailLoading(true);
        try {
          const oppRes = await fetchPpaOpportunityDetail(token, String(app.opportunityId));
          if (cancelled) return;
          if (oppRes.data) {
            setApplicationListingDetail(oppRes.data);
          } else {
            setApplicationListingDetail(null);
          }
        } finally {
          if (!cancelled) {
            setApplicationListingDetailLoading(false);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      setApplicationListingDetailLoading(false);
    };
  }, [applicationDetailForView]);

  const closeApplicationViewModal = useCallback(() => {
    setApplicationDetailForView(null);
    setPpaModalStudent(null);
    setApplicationListingDetail(null);
    setApplicationListingDetailLoading(false);
    setPpaOpportunityOverlayOpen(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setViewStudentProfileId(null);
    setApplicationMenu(null);
    setStudentRowMenu(null);
    if (activeTab !== 'applications') {
      setApplicationDetailForView(null);
      setPpaModalStudent(null);
      setApplicationListingDetail(null);
      setApplicationListingDetailLoading(false);
      setPpaOpportunityOverlayOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (viewStudentProfileId != null) {
        setViewStudentProfileId(null);
        return;
      }
      if (ppaOpportunityOverlayOpen) {
        setPpaOpportunityOverlayOpen(false);
        return;
      }
      if (applicationDetailForView != null) {
        closeApplicationViewModal();
      }
    };
    const anyRelevant =
      viewStudentProfileId != null ||
      ppaOpportunityOverlayOpen ||
      applicationDetailForView != null;
    if (!anyRelevant) return undefined;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    viewStudentProfileId,
    ppaOpportunityOverlayOpen,
    applicationDetailForView,
    closeApplicationViewModal,
  ]);

  useEffect(() => {
    if (applicationMenu == null) return undefined;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setApplicationMenu(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [applicationMenu]);

  useEffect(() => {
    if (applicationMenu == null) return undefined;
    const close = () => setApplicationMenu(null);
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', close);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', close);
    };
  }, [applicationMenu]);

  useEffect(() => {
    if (applicationMenu == null) return undefined;
    const close = () => setApplicationMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [applicationMenu]);

  useEffect(() => {
    if (studentRowMenu == null) return undefined;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStudentRowMenu(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [studentRowMenu]);

  useEffect(() => {
    if (studentRowMenu == null) return undefined;
    const close = () => setStudentRowMenu(null);
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', close);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', close);
    };
  }, [studentRowMenu]);

  useEffect(() => {
    if (studentRowMenu == null) return undefined;
    const close = () => setStudentRowMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [studentRowMenu]);

  const filteredApplications = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = applications.filter((a) => {
      const t = (a.applicationType || '').toUpperCase();
      return t === 'PROFESSIONAL_PRACTICE' || t.includes('PROFESSIONAL');
    });
    if (!q) return base;
    return base.filter((a) => {
      const hay = [
        a.studentName,
        a.opportunityTitle,
        a.companyName,
        a.applicationType,
        a.opportunityType,
        labelApplicationType(a.applicationType),
      ]
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [applications, searchTerm]);

  const sortedApplications = useMemo(() => {
    const decisionRank = (d: ReturnType<typeof ppaRowDecision>): number => {
      switch (applicationSort) {
        case 'approved_first':
          return d === 'APPROVED' ? 0 : d === 'REJECTED' ? 1 : 2;
        case 'rejected_first':
          return d === 'REJECTED' ? 0 : d === 'APPROVED' ? 1 : 2;
        case 'waiting_first':
          return d === 'WAITING' ? 0 : d === 'APPROVED' ? 1 : 2;
        default:
          return 0;
      }
    };

    const list = [...filteredApplications];
    list.sort((a, b) => {
      if (applicationSort === 'newest') {
        return applicationCreatedAtTime(b.createdAt) - applicationCreatedAtTime(a.createdAt);
      }
      if (applicationSort === 'oldest') {
        return applicationCreatedAtTime(a.createdAt) - applicationCreatedAtTime(b.createdAt);
      }
      const ra = decisionRank(ppaRowDecision(a));
      const rb = decisionRank(ppaRowDecision(b));
      if (ra !== rb) return ra - rb;
      return applicationCreatedAtTime(b.createdAt) - applicationCreatedAtTime(a.createdAt);
    });
    return list;
  }, [filteredApplications, applicationSort]);

  const pendingPpaCount = useMemo(
    () =>
      applications.filter((a) => {
        const t = (a.applicationType || '').toUpperCase();
        const isPp = t === 'PROFESSIONAL_PRACTICE' || t.includes('PROFESSIONAL');
        return isPp && a.isApprovedByPPA == null;
      }).length,
    [applications]
  );

  const approvedPpaCount = useMemo(
    () => applications.filter((a) => a.isApprovedByPPA === true).length,
    [applications]
  );

  const rejectedPpaCount = useMemo(
    () => applications.filter((a) => a.isApprovedByPPA === false).length,
    [applications]
  );

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
        { label: 'Assigned Students', value: myStudents.length, icon: Users, color: 'bg-blue-50 text-blue-600' },
        { label: 'Pending Reviews', value: pendingPpaCount, icon: Clock, color: 'bg-amber-50 text-amber-600' },
        { label: 'Approved by Me', value: approvedPpaCount, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
        { label: 'Rejected', value: rejectedPpaCount, icon: XCircle, color: 'bg-red-50 text-red-600' },
      ].map((stat, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-2xl font-bold tracking-tight text-[#002B5B]">{stat.value}</div>
            <div className={cn('rounded-xl p-3 transition-colors duration-300', stat.color)}>
              <stat.icon size={20} aria-hidden />
            </div>
          </div>
          <div className="text-[10px] font-bold uppercase leading-none tracking-widest text-slate-400">{stat.label}</div>
        </div>
      ))}
    </div>
  );

  const renderApplications = () => {
    const menuPos =
      applicationMenu != null && typeof window !== 'undefined'
        ? applicationMenuFixedStyle(applicationMenu.anchorRect)
        : null;
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#002B5B] sm:text-3xl">Review Applications</h2>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="text"
              placeholder="Search student name or role..."
              suppressHydrationWarning
              className="w-full rounded-full border border-slate-200 bg-white py-3.5 pl-11 pr-5 text-sm shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#002B5B]/25 focus:ring-2 focus:ring-[#002B5B]/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
            <div className="flex shrink-0 flex-col gap-1 sm:min-w-[11rem]">
              <label htmlFor="ppa-app-sort" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Sort by
              </label>
              <select
                id="ppa-app-sort"
                value={applicationSort}
                onChange={(e) => setApplicationSort(e.target.value as PpaApplicationSort)}
                className="rounded-full border border-slate-200 bg-white py-3 pl-4 pr-3 text-sm font-semibold text-[#002B5B] shadow-sm outline-none focus:border-[#002B5B]/25 focus:ring-2 focus:ring-[#002B5B]/20"
              >
                <option value="waiting_first">Waiting first</option>
                <option value="approved_first">Approved first</option>
                <option value="rejected_first">Rejected first</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="bg-[#002B5B] text-white">
                <th className="rounded-tl-2xl px-6 py-4 text-xs font-bold uppercase tracking-wider">Name</th>
                <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  Date applied
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Opportunity</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Status</th>
                <th className="w-[72px] rounded-tr-2xl px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : sortedApplications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                    No professional practice applications in your department and study fields.
                  </td>
                </tr>
              ) : (
                sortedApplications.map((app) => {
                  const rowKey = String(app.applicationId ?? `${app.studentId}-${app.opportunityId}`);
                  const decision = ppaRowDecision(app);
                  const staleWaiting = isPpaWaitingOlderThanTwoWeeks(app);
                  return (
                    <tr
                      key={rowKey}
                      className={cn(
                        'transition-colors',
                        staleWaiting
                          ? 'border-l-4 border-l-red-500 bg-red-50/80 hover:bg-red-50'
                          : 'hover:bg-slate-50/90'
                      )}
                    >
                      <td className="align-middle px-6 py-4">
                        {app.studentId != null ? (
                          <button
                            type="button"
                            className="text-left text-base font-bold text-[#002B5B] hover:underline"
                            onClick={() => setViewStudentProfileId(app.studentId!)}
                          >
                            {app.studentName || '—'}
                          </button>
                        ) : (
                          <div className="text-base font-bold text-[#002B5B]">{app.studentName || '—'}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-600 align-middle">
                        {formatPpaApplicationDate(app.createdAt)}
                      </td>
                      <td className="align-middle px-6 py-4">
                        <div className="text-sm font-medium text-slate-600">{app.opportunityTitle || '—'}</div>
                        {app.companyName ? (
                          <div className="mt-0.5 text-xs text-slate-500">{app.companyName}</div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600 align-middle">
                        {labelApplicationType(app.applicationType)}
                      </td>
                      <td className="align-middle px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white',
                            decision === 'APPROVED'
                              ? 'bg-[#20948B]'
                              : decision === 'REJECTED'
                                ? 'bg-amber-600'
                                : 'bg-slate-500'
                          )}
                        >
                          {decision}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right align-middle">
                        <button
                          type="button"
                          className="inline-flex rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          aria-label="Row actions"
                          aria-expanded={applicationMenu?.key === rowKey}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (applicationMenu?.key === rowKey) {
                              setApplicationMenu(null);
                            } else {
                              setApplicationMenu({
                                key: rowKey,
                                app,
                                decision,
                                anchorRect: e.currentTarget.getBoundingClientRect(),
                              });
                            }
                          }}
                        >
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      {applicationMenu != null && menuPos != null && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="menu"
              className="fixed z-[200] w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg text-left"
              style={{
                ...(menuPos.top != null ? { top: menuPos.top } : {}),
                ...(menuPos.bottom != null ? { bottom: menuPos.bottom } : {}),
                right: menuPos.right,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const row = applicationMenu.app;
                  setApplicationMenu(null);
                  setApplicationDetailForView(row);
                }}
              >
                <Eye size={16} className="text-slate-500" />
                View
              </button>
              {applicationMenu.decision === 'WAITING' ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    disabled={ppaDecisionLoading}
                    onClick={() => {
                      const row = applicationMenu.app;
                      setApplicationMenu(null);
                      void submitPpaDecision(row, true);
                    }}
                  >
                    <Check size={16} />
                    Approve
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    disabled={ppaDecisionLoading}
                    onClick={() => {
                      const row = applicationMenu.app;
                      setApplicationMenu(null);
                      void submitPpaDecision(row, false);
                    }}
                  >
                    <X size={16} />
                    Reject
                  </button>
                </>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
    );
  };

  const filteredMyStudents = useMemo(() => {
    const q = myStudentsSearch.trim().toLowerCase();
    return myStudents.filter((s) => {
      if (q) {
        const hay = [(s.fullName || ''), (s.studyFieldName || '')].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (studentYearFilter.length > 0) {
        const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
        const label = s.studyYear != null ? `${s.studyYear}${suffixes[s.studyYear] ?? 'th'} Year` : '';
        if (!studentYearFilter.includes(label)) return false;
      }
      if (studentFieldFilter.length > 0) {
        if (!s.studyFieldName || !studentFieldFilter.includes(s.studyFieldName)) return false;
      }
      if (studentAppFilter.length > 0) {
        const count = s.applicationCount ?? 0;
        const inRange = studentAppFilter.some((r) => {
          if (r === '0–5') return count >= 0 && count <= 5;
          if (r === '6–10') return count >= 6 && count <= 10;
          if (r === '11+') return count >= 11;
          return false;
        });
        if (!inRange) return false;
      }
      if (studentStatusFilter.length > 0) {
        const status = s.applicationStatus;
        const label =
          status === 'APPROVED' ? 'Accepted' :
          status === 'REJECTED' ? 'Rejected' :
          'Waiting Review';
        if (!studentStatusFilter.includes(label)) return false;
      }
      return true;
    });
  }, [myStudents, myStudentsSearch, studentYearFilter, studentFieldFilter, studentAppFilter, studentStatusFilter]);

  const uniqueStudyFields = useMemo(
    () => Array.from(new Set(myStudents.map((s) => s.studyFieldName).filter(Boolean))) as string[],
    [myStudents]
  );

  const studyYearLabel = (year: number | null | undefined) => {
    if (year == null) return '—';
    const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
    return `${year}${suffixes[year] ?? 'th'} Year`;
  };

  const renderStudents = () => {
    const studentMenuPos =
      studentRowMenu != null && typeof window !== 'undefined'
        ? applicationMenuFixedStyle(studentRowMenu.anchorRect)
        : null;
    return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#002B5B] sm:text-3xl">My Students</h2>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="text"
              placeholder="Search student name or study field..."
              suppressHydrationWarning
              className="w-full rounded-full border border-slate-200 bg-white py-3.5 pl-11 pr-5 text-sm shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#002B5B]/25 focus:ring-2 focus:ring-[#002B5B]/20"
              value={myStudentsSearch}
              onChange={(e) => setMyStudentsSearch(e.target.value)}
            />
          </div>
          <button
            suppressHydrationWarning
            type="button"
            onClick={() => setShowStudentFilters((v) => !v)}
            className={cn(
              'inline-flex shrink-0 items-center justify-center gap-2 rounded-full border px-5 py-3.5 text-sm font-bold shadow-sm transition-all sm:min-w-[8.5rem]',
              showStudentFilters
                ? 'border-[#002B5B] bg-[#002B5B] text-white hover:bg-[#003a7a]'
                : 'border-slate-200 bg-white text-[#002B5B] hover:bg-slate-50'
            )}
          >
            <Filter size={18} strokeWidth={2} aria-hidden />
            Filters
          </button>
        </div>
      </div>
        {showStudentFilters && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Study Year</div>
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5].map((y) => {
                  const label = studyYearLabel(y);
                  return (
                    <label key={y} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-[#002B5B]"
                        checked={studentYearFilter.includes(label)}
                        onChange={(e) =>
                          setStudentYearFilter((prev) =>
                            e.target.checked ? [...prev, label] : prev.filter((v) => v !== label)
                          )
                        }
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Study Field</div>
              <div className="space-y-1.5">
                {uniqueStudyFields.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-[#002B5B]"
                      checked={studentFieldFilter.includes(f)}
                      onChange={(e) =>
                        setStudentFieldFilter((prev) =>
                          e.target.checked ? [...prev, f] : prev.filter((v) => v !== f)
                        )
                      }
                    />
                    {f}
                  </label>
                ))}
                {uniqueStudyFields.length === 0 && <p className="text-xs text-slate-400">—</p>}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Applications</div>
              <div className="space-y-1.5">
                {['0–5', '6–10', '11+'].map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-[#002B5B]"
                      checked={studentAppFilter.includes(r)}
                      onChange={(e) =>
                        setStudentAppFilter((prev) =>
                          e.target.checked ? [...prev, r] : prev.filter((v) => v !== r)
                        )
                      }
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Status</div>
              <div className="space-y-1.5">
                {['Waiting Review', 'Accepted', 'Rejected'].map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-[#002B5B]"
                      checked={studentStatusFilter.includes(s)}
                      onChange={(e) =>
                        setStudentStatusFilter((prev) =>
                          e.target.checked ? [...prev, s] : prev.filter((v) => v !== s)
                        )
                      }
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2 md:col-span-4 flex justify-end gap-3">
              <button
                suppressHydrationWarning
                onClick={() => {
                  setStudentYearFilter([]);
                  setStudentFieldFilter([]);
                  setStudentAppFilter([]);
                  setStudentStatusFilter([]);
                }}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
              >
                Clear All
              </button>
              <button
                suppressHydrationWarning
                onClick={() => setShowStudentFilters(false)}
                className="px-4 py-2 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#003a7a] transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="bg-[#002B5B] text-white">
                <th className="rounded-tl-2xl px-6 py-4 text-xs font-bold uppercase tracking-wider">Name</th>
                <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  Study year
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Study field</th>
                <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  Applications
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Status</th>
                <th className="w-[72px] rounded-tr-2xl px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : myStudentsError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-red-500">
                    {myStudentsError}
                  </td>
                </tr>
              ) : filteredMyStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                    No students found for your assigned study fields.
                  </td>
                </tr>
              ) : (
                filteredMyStudents.map((student) => {
                  const status = student.applicationStatus;
                  const decision: 'WAITING' | 'APPROVED' | 'REJECTED' =
                    status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'WAITING';
                  const rowKey = String(student.studentId);
                  return (
                    <tr key={rowKey} className="transition-colors hover:bg-slate-50/90">
                      <td className="align-middle px-6 py-4">
                        <button
                          type="button"
                          className="text-left text-base font-bold text-[#002B5B] hover:underline"
                          onClick={() => setViewStudentProfileId(student.studentId)}
                        >
                          {student.fullName || '—'}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-600 align-middle">
                        {studyYearLabel(student.studyYear)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600 align-middle">
                        {student.studyFieldName || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600 align-middle">
                        {student.applicationCount ?? 0}
                      </td>
                      <td className="align-middle px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white',
                            decision === 'APPROVED'
                              ? 'bg-[#20948B]'
                              : decision === 'REJECTED'
                                ? 'bg-amber-600'
                                : 'bg-slate-500'
                          )}
                        >
                          {decision}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right align-middle">
                        <button
                          type="button"
                          className="inline-flex rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          aria-label="Row actions"
                          aria-expanded={studentRowMenu?.key === rowKey}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (studentRowMenu?.key === rowKey) {
                              setStudentRowMenu(null);
                            } else {
                              setStudentRowMenu({
                                key: rowKey,
                                student,
                                anchorRect: e.currentTarget.getBoundingClientRect(),
                              });
                            }
                          }}
                        >
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      {studentRowMenu != null && studentMenuPos != null && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="menu"
              className="fixed z-[200] w-48 rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg"
              style={{
                ...(studentMenuPos.top != null ? { top: studentMenuPos.top } : {}),
                ...(studentMenuPos.bottom != null ? { bottom: studentMenuPos.bottom } : {}),
                right: studentMenuPos.right,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const row = studentRowMenu.student;
                  setStudentRowMenu(null);
                  setSelectedStudent(row);
                }}
              >
                <Eye size={16} className="text-slate-500" aria-hidden />
                View details
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const id = studentRowMenu.student.studentId;
                  setStudentRowMenu(null);
                  setViewStudentProfileId(id);
                }}
              >
                <User size={16} className="text-slate-500" aria-hidden />
                Open profile
              </button>
            </div>,
            document.body
          )
        : null}

      {/* Student detail modal */}
      {selectedStudent && (() => {
        const s = selectedStudent;
        const status = s.applicationStatus;
        const decision: 'WAITING' | 'APPROVED' | 'REJECTED' =
          status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'WAITING';
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setSelectedStudent(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{s.fullName || '—'}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Student Details</p>
                </div>
                <button
                  suppressHydrationWarning
                  onClick={() => setSelectedStudent(null)}
                  className="text-slate-400 hover:text-slate-700 transition-colors text-xl font-bold leading-none"
                >
                  ×
                </button>
              </div>
              <dl className="space-y-4">
                {[
                  { label: 'Full Name', value: s.fullName || '—' },
                  { label: 'Email', value: s.email || '—' },
                  { label: 'Study Year', value: studyYearLabel(s.studyYear) },
                  { label: 'Study Field', value: s.studyFieldName || '—' },
                  { label: 'CGPA', value: s.cgpa != null ? String(s.cgpa) : '—' },
                  { label: 'Application Count', value: String(s.applicationCount ?? 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</dt>
                    <dd className="text-sm font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2">
                  <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">Application Status</dt>
                  <dd>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white',
                        decision === 'APPROVED'
                          ? 'bg-[#20948B]'
                          : decision === 'REJECTED'
                            ? 'bg-amber-600'
                            : 'bg-slate-500'
                      )}
                    >
                      {decision}
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="mt-8 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => {
                    setViewStudentProfileId(s.studentId);
                    setSelectedStudent(null);
                  }}
                  className="px-6 py-2 bg-white border border-slate-200 text-slate-800 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  View full profile
                </button>
                <button
                  suppressHydrationWarning
                  onClick={() => setSelectedStudent(null)}
                  className="px-6 py-2 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#003a7a] transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    );
  };

  const firstPending = filteredApplications.find((a) => a.isApprovedByPPA == null);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            {loading ? <p className="text-sm text-slate-500 mb-4">Loading…</p> : null}
            {renderStats()}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">{renderApplications()}</div>
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <AlertCircle size={18} className="text-amber-500" />
                    Next review
                  </h3>
                  <div className="space-y-4">
                    {firstPending ? (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                        <div className="text-xs font-bold text-amber-800 uppercase mb-1">Awaiting PPA</div>
                        <div className="text-sm font-bold text-slate-900">
                          {firstPending.studentName || 'Student'} — {firstPending.companyName || 'Company'}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Submitted {firstPending.createdAt || '—'}. Approve or reject from the table.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No pending professional practice reviews.</p>
                    )}
                  </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl text-white">
                  <h3 className="font-bold mb-4">PPA</h3>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-[#002B5B] rounded-full flex items-center justify-center font-bold text-xl">
                      {(currentUserName || '?')[0]}
                    </div>
                    <div>
                      <div className="font-bold">{currentUserName}</div>
                      <div className="text-xs text-slate-400">Professional Practice Advisor</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scope</div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Applications and student lists use your account&apos;s{' '}
                      <span className="font-mono">linked_entity_id</span> as{' '}
                      <span className="font-mono">ppa_id</span>, matched to your department and{' '}
                      <span className="font-mono">ppa_studyfield</span> assignments.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      case 'applications':
        return renderApplications();
      case 'students':
        return renderStudents();
      default:
        return <UnderDevelopment moduleName={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} />;
    }
  };

  return (
    <Dashboard
      title=""
      userName={currentUserName}
      userRole={currentUserRoleLabel}
      onToggleSidebar={onToggleSidebar}
      notificationUnreadCount={unreadCount}
      notificationPanel={(close) => (
        <NotificationsPanel
          onClose={() => {
            void refreshUnreadNotifications();
            close();
          }}
          onUnreadMayHaveChanged={refreshUnreadNotifications}
          onActivateApplication={(applicationId) => {
            void openApplicationFromNotification(applicationId);
            close();
          }}
          className="max-w-none mx-0 h-full min-h-0 flex flex-col shadow-2xl ring-1 ring-slate-200/80"
        />
      )}
    >
      {renderContent()}
      {applicationDetailForView && ppaModalStudent ? (
        <SubmitApplicationModal
          key={applicationDetailForView.applicationId ?? 'ppa-app-view'}
          mode="view"
          opportunity={{
            title: applicationDetailForView.opportunityTitle ?? 'Opportunity',
            company: applicationDetailForView.companyName ?? '',
          }}
          student={ppaModalStudent}
          onClose={closeApplicationViewModal}
          viewReview={{
            applicationId: applicationDetailForView.applicationId,
            status: applicationDetailForView.status ?? ppaRowDecision(applicationDetailForView),
            createdAt: applicationDetailForView.createdAt,
            isApprovedByPPA: applicationDetailForView.isApprovedByPPA,
            isApprovedByCompany: applicationDetailForView.isApprovedByCompany,
          }}
          viewFields={{
            phoneNumber: applicationDetailForView.phoneNumber,
            applicationType: applicationDetailForView.applicationType,
            accuracyConfirmed: applicationDetailForView.accuracyConfirmed ?? null,
          }}
          viewHeaderActions={
            <PpaApplicationReviewHeaderMenu
              waiting={ppaRowDecision(applicationDetailForView) === 'WAITING'}
              decisionLoading={ppaDecisionLoading}
              onApprove={() => void submitPpaDecision(applicationDetailForView, true)}
              onReject={() => void submitPpaDecision(applicationDetailForView, false)}
            />
          }
          viewExtraActions={
            <>
              {applicationDetailForView.studentId != null ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-[#002B5B] hover:bg-slate-50"
                  onClick={() => setViewStudentProfileId(applicationDetailForView.studentId!)}
                >
                  <Users size={16} />
                  Open student profile
                </button>
              ) : null}
              {applicationDetailForView.opportunityId != null ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-[#002B5B] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setPpaOpportunityOverlayOpen(true)}
                >
                  <Briefcase size={16} />
                  Open opportunity information
                </button>
              ) : null}
            </>
          }
        />
      ) : null}
      <ViewerOpportunityOverlay
        open={ppaOpportunityOverlayOpen && applicationDetailForView != null}
        opportunity={applicationListingDetail}
        loading={applicationListingDetailLoading}
        onClose={() => setPpaOpportunityOverlayOpen(false)}
        sidebarExpanded={sidebarExpanded}
      />
      {viewStudentProfileId != null ? (
        <ViewerStudentProfileOverlay
          studentId={viewStudentProfileId}
          onClose={() => setViewStudentProfileId(null)}
          apiSegment="ppa"
          sidebarExpanded={sidebarExpanded}
        />
      ) : null}
    </Dashboard>
  );
};

export default PPADashboard;
