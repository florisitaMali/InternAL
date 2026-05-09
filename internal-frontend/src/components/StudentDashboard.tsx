'use client';

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Dashboard from './Dashboard';
import PdfPreviewModal from './PdfPreviewModal';
import {
  CertificationEditModal,
  CertificationUploadModal,
  ExperienceFormModal,
  ProjectFormModal,
} from './ProfileEntityModals';
import ProfileEditor from './ProfileEditor';
import StudentProfileView from './StudentProfileView';
import UnderDevelopment from './UnderDevelopment';
import SubmitApplicationModal from './SubmitApplicationModal';
import NotificationsPanel from './NotificationsPanel';
import { ApplicationFormData } from './SubmitApplicationModal';
import {
  Briefcase,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  Search,
  Tag,
  Wallet,
  X,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';
import type {
  Application,
  CompanyProfileFromApi,
  Opportunity,
  Student,
  StudentExperience,
  StudentProfileFile,
  StudentProject,
} from '../types';
import { getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import {
  createStudentExperience,
  createStudentProject,
  deleteStudentCertification,
  deleteStudentCv,
  deleteStudentExperience,
  deleteStudentProject,
  downloadStudentProfileFile,
  fetchCurrentStudentProfile,
  fetchStudentProfileBlob,
  mapStudentProfileToStudent,
  patchCertificationMetadata,
  saveCurrentStudentProfile,
  updateStudentExperience,
  updateStudentProject,
  uploadProfilePhoto,
  uploadStudentCertification,
  uploadStudentCv,
} from '@/src/lib/auth/userAccount';
import { fetchStudentApplications, fetchStudentOpportunities, getApiBaseUrl, type ApplicationResponse, type StudentOpportunityFilters } from '@/src/lib/auth/opportunities';
import { fetchStudentOpportunityDetail, fetchStudentCompanyProfile, fetchStudentCompanyOpportunities } from '@/src/lib/auth/company';
import { useNotificationUnreadCount } from '@/src/lib/auth/useNotificationUnreadCount';
import OpportunityDetailView from '@/src/components/OpportunityDetailView';
import CompanyProfileTabbedView from '@/src/components/CompanyProfileTabbedView';
import OpportunityRecordCard from '@/src/components/OpportunityRecordCard';
import StudentOpportunityExploreCard from '@/src/components/StudentOpportunityExploreCard';
import StudentBestMatchesTeaser from '@/src/components/StudentBestMatchesTeaser';
import {
  formatDbDuration,
  formatDbWorkType,
  formatDeadline,
  formatRelativePosted,
} from '@/src/lib/opportunityFormat';

interface StudentDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  currentStudent?: Student | null;
  onToggleSidebar?: () => void;
  /** Switch main tab (e.g. open company browse from an application). */
  onNavigateTab?: (tab: string) => void;
  /** Collapse sidebar when an overlay modal opens (e.g. apply / view application). */
  onCloseSidebar?: () => void;
}

type OpportunityFilterState = {
  q: string;
  locationPresets: string[];
  locationOther: string;
  workTypes: Array<'FULL_TIME' | 'PART_TIME' | 'FLEXIBLE'>;
  workModes: Array<'Remote' | 'Hybrid' | 'On-site'>;
  durationBuckets: Array<'<3' | '3-6' | '6+'>;
  paidSelections: Array<'paid' | 'unpaid'>;
  salaryMin: string;
  salaryMax: string;
};

const EMPTY_FILTERS: OpportunityFilterState = {
  q: '',
  locationPresets: [],
  locationOther: '',
  workTypes: [],
  workModes: [],
  durationBuckets: [],
  paidSelections: [],
  salaryMin: '',
  salaryMax: '',
};

type FilterCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

function FilterCheckbox({ checked, onChange, label }: FilterCheckboxProps) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <input type="checkbox" className="sr-only" checked={checked} onChange={() => onChange(!checked)} />
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
          checked ? 'bg-[#002B5B] border-[#002B5B]' : 'border-slate-300 group-hover:border-slate-400'
        )}
        aria-hidden
      >
        {checked ? (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-6" />
          </svg>
        ) : null}
      </span>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

function durationMonthsApprox(duration: string | undefined | null): number | null {
  if (!duration?.trim()) return null;
  const m = /^(\d+)_MONTHS?$/i.exec(duration.trim());
  if (m) return parseInt(m[1], 10);
  const lower = duration.toLowerCase();
  if (lower.includes('1-3') || lower.includes('1 to 3')) return 2;
  if (lower.includes('3-6') || lower.includes('3 to 6')) return 4;
  if (lower.includes('6-12') || lower.includes('6 to 12')) return 9;
  return null;
}

function durationMatchesBucket(duration: string, bucket: string): boolean {
  const months = durationMonthsApprox(duration);
  if (months != null) {
    if (bucket === '<3') return months < 3;
    if (bucket === '3-6') return months >= 3 && months <= 6;
    if (bucket === '6+') return months > 6;
  }
  const lower = duration.toLowerCase();
  if (bucket === '<3') return lower.includes('1-3');
  if (bucket === '3-6') return lower.includes('3-6');
  if (bucket === '6+') return lower.includes('6-12') || lower.includes('12');
  return false;
}

function normalizeWorkTypeKey(wt: string | null | undefined): string | null {
  if (!wt?.trim()) return null;
  return wt.trim().toUpperCase().replace(/-/g, '_');
}

function matchesFlexibleWorkType(workType: string | null | undefined): boolean {
  const w = (workType || '').toLowerCase();
  return w.includes('flex') || w.includes('part');
}

function applyClientOpportunityFilters(opps: Opportunity[], f: OpportunityFilterState): Opportunity[] {
  return opps.filter((opp) => {
    const hay = (opp.location || '').toLowerCase();
    const other = f.locationOther.trim().toLowerCase();
    const hasLoc = f.locationPresets.length > 0 || !!other;
    if (hasLoc) {
      const presetMatch = f.locationPresets.some((p) => hay.includes(p.toLowerCase()));
      const otherMatch = !!other && hay.includes(other);
      if (!presetMatch && !otherMatch) return false;
    }

    if (f.workTypes.length > 0) {
      const ok = f.workTypes.some((choice) => {
        if (choice === 'FLEXIBLE') return matchesFlexibleWorkType(opp.workType);
        return normalizeWorkTypeKey(opp.workType) === choice;
      });
      if (!ok) return false;
    }

    if (f.workModes.length > 0) {
      const wm = opp.workMode;
      if (!wm || !f.workModes.includes(wm as (typeof f.workModes)[number])) return false;
    }

    if (f.durationBuckets.length > 0) {
      const ok = f.durationBuckets.some((b) => durationMatchesBucket(opp.duration || '', b));
      if (!ok) return false;
    }

    if (f.paidSelections.length === 1) {
      const onlyPaid = f.paidSelections[0] === 'paid';
      if (onlyPaid) {
        if (opp.isPaid !== true) return false;
        const minParsed = f.salaryMin.trim() ? Number(f.salaryMin) : null;
        const maxParsed = f.salaryMax.trim() ? Number(f.salaryMax) : null;
        if (minParsed != null && !Number.isNaN(minParsed)) {
          if (opp.salaryMonthly == null || opp.salaryMonthly < minParsed) return false;
        }
        if (maxParsed != null && !Number.isNaN(maxParsed)) {
          if (opp.salaryMonthly == null || opp.salaryMonthly > maxParsed) return false;
        }
      } else if (opp.isPaid === true) {
        return false;
      }
    }

    return true;
  });
}

function getInitials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function formatApplicationIdDisplay(id: number | null): string {
  return id != null ? `APP${String(id).padStart(3, '0')}` : '—';
}

function createPlaceholderStudent(): Student {
  return {
    id: '',
    fullName: '',
    email: '',
    role: 'STUDENT',
    university: '',
    studyYear: 1,
    cgpa: 0,
    hasCompletedPP: false,
  };
}

function buildOpportunityFilters(filters: OpportunityFilterState): StudentOpportunityFilters {
  let location: string | undefined;
  if (filters.locationPresets.length === 1 && !filters.locationOther.trim()) {
    location = filters.locationPresets[0];
  } else if (filters.locationPresets.length === 0 && filters.locationOther.trim()) {
    location = filters.locationOther.trim();
  }

  const workModeParam =
    filters.workModes.length === 1 ? filters.workModes[0] : undefined;

  let isPaid: boolean | undefined;
  if (filters.paidSelections.length === 1) {
    isPaid = filters.paidSelections[0] === 'paid';
  }

  return {
    q: filters.q || undefined,
    location,
    workMode: workModeParam,
    isPaid,
  };
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
  currentStudent,
  onToggleSidebar,
  onNavigateTab,
  onCloseSidebar,
}) => {
  const { unreadCount, refresh: refreshUnreadNotifications } = useNotificationUnreadCount();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [student, setStudent] = useState<Student>(currentStudent ?? createPlaceholderStudent());
  const [opportunityFilters, setOpportunityFilters] = useState<OpportunityFilterState>(EMPTY_FILTERS);
  const [discoveredLocations, setDiscoveredLocations] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [applicationListingDetail, setApplicationListingDetail] = useState<Opportunity | null>(null);
  const [applicationListingDetailLoading, setApplicationListingDetailLoading] = useState(false);
  const [applicationOpportunity, setApplicationOpportunity] = useState<{ id: number; title: string; company: string } | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [applicationSearch, setApplicationSearch] = useState('');
  const [showApplicationFilters, setShowApplicationFilters] = useState(false);
  const [opportunityById, setOpportunityById] = useState<Map<string, Opportunity>>(() => new Map());
  const [selectedApplication, setSelectedApplication] = useState<ApplicationResponse | null>(null);
  const [pendingApplicationFocusId, setPendingApplicationFocusId] = useState<number | null>(null);

  const [selectedExploreOpportunityId, setSelectedExploreOpportunityId] = useState<string | null>(null);
  const [exploreOpportunityDetail, setExploreOpportunityDetail] = useState<Opportunity | null>(null);
  const [exploreOpportunityLoading, setExploreOpportunityLoading] = useState(false);
  const [exploreOpportunityError, setExploreOpportunityError] = useState<string | null>(null);

  const [companyBrowseId, setCompanyBrowseId] = useState<string | null>(null);
  const [companyBrowseSection, setCompanyBrowseSection] = useState<'about' | 'opportunities'>('about');
  const [companyBrowseProfile, setCompanyBrowseProfile] = useState<CompanyProfileFromApi | null>(null);
  const [companyBrowseOpportunities, setCompanyBrowseOpportunities] = useState<Opportunity[]>([]);
  const [companyBrowseLoading, setCompanyBrowseLoading] = useState(false);

  const [bestMatchesList, setBestMatchesList] = useState<Opportunity[]>([]);
  const [bestMatchesLoading, setBestMatchesLoading] = useState(false);
  const [showPremiumExploreBanner, setShowPremiumExploreBanner] = useState(true);

  const [pdfPreview, setPdfPreview] = useState<{
    title: string;
    url: string | null;
    mimeType?: string;
    filenameHint?: string;
    downloadPath: string;
    downloadFilename: string;
  } | null>(null);

  const [expModal, setExpModal] = useState<{ open: boolean; edit: StudentExperience | null }>({
    open: false,
    edit: null,
  });
  const [projModal, setProjModal] = useState<{ open: boolean; edit: StudentProject | null }>({
    open: false,
    edit: null,
  });
  const [certEditTarget, setCertEditTarget] = useState<StudentProfileFile | null>(null);
  const [certUploadOpen, setCertUploadOpen] = useState(false);
  const [certUploading, setCertUploading] = useState(false);

  const closePdfPreview = () => {
    if (pdfPreview?.url) {
      URL.revokeObjectURL(pdfPreview.url);
    }
    setPdfPreview(null);
  };

  const openAuthenticatedPdfPreview = async (
    path: string,
    title: string,
    opts: { downloadFilename: string; mimeType?: string; filenameHint?: string }
  ) => {
    try {
      const { blob, errorMessage } = await withAccessToken((accessToken) =>
        fetchStudentProfileBlob(accessToken, path)
      );
      if (!blob || errorMessage) {
        toast.error(errorMessage || 'Could not open the file.');
        return;
      }
      if (pdfPreview?.url) {
        URL.revokeObjectURL(pdfPreview.url);
      }
      const url = URL.createObjectURL(blob);
      setPdfPreview({
        title,
        url,
        mimeType: blob.type || opts.mimeType,
        filenameHint: opts.filenameHint,
        downloadPath: path,
        downloadFilename: opts.downloadFilename,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open the file.');
    }
  };

  useEffect(() => {
    if (applicationOpportunity || selectedApplication || pdfPreview) {
      onCloseSidebar?.();
    }
  }, [applicationOpportunity, selectedApplication, pdfPreview, onCloseSidebar]);

  useEffect(() => {
    if (!currentStudent) return;
    setStudent((prev) => {
      const merged: Student = { ...prev, ...currentStudent };
      if (currentStudent.canApplyForPP === undefined && prev.canApplyForPP !== undefined) {
        merged.canApplyForPP = prev.canApplyForPP;
      }
      return merged;
    });
    setIsEditingProfile(false);
  }, [currentStudent]);

  const withAccessToken = async <T,>(work: (accessToken: string) => Promise<T>): Promise<T> => {
    const token = await getSessionAccessToken();
    if (!token) {
      throw new Error('Could not find the current session token. Try signing out and back in.');
    }
    return work(token);
  };

  const reloadStudentProfile = useCallback(async () => {
    try {
      const { data, errorMessage } = await withAccessToken((t) => fetchCurrentStudentProfile(t));
      if (data && !errorMessage) {
        setStudent(mapStudentProfileToStudent(data));
      } else if (errorMessage) {
        toast.error(errorMessage);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not refresh profile.');
    }
  }, []);

  useEffect(() => {
    void reloadStudentProfile();
  }, [reloadStudentProfile]);

  const loadOpportunities = useCallback(async (filters: OpportunityFilterState) => {
    setIsLoadingOpportunities(true);
    setOpportunitiesError(null);

    try {
      const { data, errorMessage } = await withAccessToken((accessToken) =>
        fetchStudentOpportunities(accessToken, buildOpportunityFilters(filters))
      );

      if (!data || errorMessage) {
        throw new Error(errorMessage || 'Could not load opportunities.');
      }

      setOpportunityById((prev) => {
        const next = new Map(prev);
        data.forEach((o) => {
          next.set(String(o.id), o);
        });
        return next;
      });

      setDiscoveredLocations((prev) => {
        const s = new Set(prev);
        data.forEach((o) => {
          if (o.location?.trim()) s.add(o.location.trim());
        });
        return Array.from(s).sort((a, b) => a.localeCompare(b));
      });

      const visible = applyClientOpportunityFilters(data, filters);
      setOpportunities(visible);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load opportunities.';
      setOpportunities([]);
      setOpportunitiesError(message);
    } finally {
      setIsLoadingOpportunities(false);
    }
  }, []);

  useEffect(() => {
    if (!student?.id) return;
    if (activeTab !== 'opportunities') return;
    void loadOpportunities(opportunityFilters);
  }, [loadOpportunities, student.id, opportunityFilters, activeTab]);

  const loadApplications = useCallback(async () => {
    setIsLoadingApplications(true);
    setApplicationsError(null);
    try {
      const { data, errorMessage } = await withAccessToken((accessToken) =>
        fetchStudentApplications(accessToken)
      );
      if (!data || errorMessage) {
        throw new Error(errorMessage || 'Could not load applications.');
      }
      setApplications(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load applications.';
      setApplications([]);
      setApplicationsError(message);
    } finally {
      setIsLoadingApplications(false);
    }
  }, []);

  useEffect(() => {
    if (!student?.id) return;
    void loadApplications();
  }, [loadApplications, student.id]);

  useEffect(() => {
    if (pendingApplicationFocusId == null) return;
    const match = applications.find((a) => a.applicationId === pendingApplicationFocusId);
    if (match) {
      setSelectedApplication(match);
      setPendingApplicationFocusId(null);
    }
  }, [applications, pendingApplicationFocusId]);

  useEffect(() => {
    if (!student?.id || activeTab !== 'best-matches') return;
    let cancelled = false;
    setBestMatchesLoading(true);
    void (async () => {
      try {
        await withAccessToken(async (token) => {
          const { data, errorMessage } = await fetchStudentOpportunities(token, {});
          if (cancelled) return;
          if (!data || errorMessage) {
            toast.error(errorMessage || 'Could not load opportunities.');
            setBestMatchesList([]);
            return;
          }
          setOpportunityById((prev) => {
            const next = new Map(prev);
            data.forEach((o) => next.set(String(o.id), o));
            return next;
          });
          const matches = data
            .filter((o) => (o.skillMatchCount ?? 0) > 0)
            .sort((a, b) => (b.skillMatchCount ?? 0) - (a.skillMatchCount ?? 0));
          setBestMatchesList(matches);
        });
      } catch {
        if (!cancelled) {
          toast.error('Could not load best matches.');
          setBestMatchesList([]);
        }
      } finally {
        if (!cancelled) setBestMatchesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, student?.id]);

  useEffect(() => {
    if (activeTab !== 'opportunities') {
      setSelectedExploreOpportunityId(null);
      setExploreOpportunityDetail(null);
      setExploreOpportunityError(null);
      setCompanyBrowseId(null);
      setCompanyBrowseSection('about');
      setCompanyBrowseProfile(null);
      setCompanyBrowseOpportunities([]);
    }
  }, [activeTab]);

  useEffect(() => {
    const oid = selectedApplication?.opportunityId;
    if (oid == null) {
      setApplicationListingDetail(null);
      setApplicationListingDetailLoading(false);
      return;
    }
    let cancelled = false;
    setApplicationListingDetailLoading(true);
    setApplicationListingDetail(null);
    void (async () => {
      try {
        await withAccessToken(async (accessToken) => {
          const { data, errorMessage } = await fetchStudentOpportunityDetail(accessToken, String(oid));
          if (cancelled) return;
          if (data) {
            setApplicationListingDetail(data);
          } else {
            toast.error(errorMessage || 'Could not load opportunity details.');
          }
        });
      } catch {
        if (!cancelled) {
          toast.error('Could not load opportunity details.');
        }
      } finally {
        if (!cancelled) {
          setApplicationListingDetailLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedApplication?.opportunityId, selectedApplication?.applicationId]);

  useEffect(() => {
    if (!selectedExploreOpportunityId) {
      setExploreOpportunityDetail(null);
      setExploreOpportunityError(null);
      setExploreOpportunityLoading(false);
      return;
    }
    let cancelled = false;
    setExploreOpportunityLoading(true);
    setExploreOpportunityError(null);
    setExploreOpportunityDetail(null);
    void (async () => {
      try {
        await withAccessToken(async (accessToken) => {
          const { data, errorMessage } = await fetchStudentOpportunityDetail(
            accessToken,
            selectedExploreOpportunityId
          );
          if (cancelled) return;
          if (data) {
            setExploreOpportunityDetail(data);
            setExploreOpportunityError(null);
          } else {
            setExploreOpportunityDetail(null);
            setExploreOpportunityError(errorMessage || 'Could not load full opportunity details.');
          }
        });
      } catch {
        if (!cancelled) {
          setExploreOpportunityError('Could not load full opportunity details.');
        }
      } finally {
        if (!cancelled) {
          setExploreOpportunityLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedExploreOpportunityId]);

  const handleApply = (opp: Opportunity) => {
    setApplicationOpportunity({ id: typeof opp.id === 'string' ? parseInt(opp.id) : opp.id, title: opp.title, company: opp.companyName ?? '' });
  };

  const handleSubmitApplication = async (data: ApplicationFormData) => {
    try {
      await withAccessToken(async (accessToken) => {
        const response = await fetch(`${getApiBaseUrl()}/api/student/applications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            opportunityId: applicationOpportunity?.id,
            applicationType: data.applicationType,
            phoneNumber: data.phoneNumber,
            accuracyConfirmed: data.confirmed,
          }),
        });
        const errText = response.ok ? '' : await response.text().catch(() => '');
        if (response.ok) {
          toast.success('Application submitted successfully!');
          setApplicationOpportunity(null);
          void loadApplications();
        } else {
          let msg = 'Failed to submit application.';
          try {
            const j = JSON.parse(errText) as { error?: string };
            if (typeof j?.error === 'string' && j.error.trim()) msg = j.error.trim();
          } catch {
            /* ignore */
          }
          toast.error(msg);
        }
      });
    } catch {
      toast.error('Failed to submit application.');
    }
  };

  const loadCompanyBrowseForId = useCallback(async (companyId: string) => {
    setCompanyBrowseLoading(true);
    setCompanyBrowseSection('about');
    setCompanyBrowseProfile(null);
    setCompanyBrowseOpportunities([]);
    try {
      await withAccessToken(async (token) => {
        const [profRes, oppRes] = await Promise.all([
          fetchStudentCompanyProfile(token, companyId),
          fetchStudentCompanyOpportunities(token, companyId),
        ]);
        if (profRes.data && !profRes.errorMessage) {
          setCompanyBrowseProfile(profRes.data);
        } else {
          toast.error(profRes.errorMessage || 'Could not load company profile.');
          setCompanyBrowseId(null);
        }
        if (oppRes.data && !oppRes.errorMessage) {
          setCompanyBrowseOpportunities(oppRes.data);
        } else if (oppRes.errorMessage && profRes.data) {
          toast.error(oppRes.errorMessage || 'Could not load opportunities.');
        }
      });
    } catch {
      toast.error('Could not load company.');
      setCompanyBrowseId(null);
    } finally {
      setCompanyBrowseLoading(false);
    }
  }, []);

  const locationRadioOptions = useMemo(() => {
    if (discoveredLocations.length > 0) return discoveredLocations.slice(0, 6);
    return ['San Francisco, CA', 'New York, NY', 'Austin, TX'];
  }, [discoveredLocations]);

  const filteredApplications = useMemo(() => {
    let list = applications;
    if (applicationSearch.trim()) {
      const q = applicationSearch.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.companyName ?? '').toLowerCase().includes(q) ||
          formatApplicationIdDisplay(a.applicationId).toLowerCase().includes(q) ||
          (a.opportunityTitle ?? '').toLowerCase().includes(q)
      );
    }
    const dim = opportunityFilters;
    const hasDim =
      dim.locationPresets.length > 0 ||
      dim.locationOther.trim() !== '' ||
      dim.workTypes.length > 0 ||
      dim.workModes.length > 0 ||
      dim.durationBuckets.length > 0 ||
      dim.paidSelections.length > 0;
    if (!hasDim) return list;
    return list.filter((app) => {
      const id = app.opportunityId != null ? String(app.opportunityId) : '';
      const opp = opportunityById.get(id);
      if (!opp) return true;
      return applyClientOpportunityFilters([opp], dim).length > 0;
    });
  }, [applications, applicationSearch, opportunityFilters, opportunityById]);

  const appliedOpportunityIds = useMemo(() => {
    const ids = new Set<string>();
    applications.forEach((a) => {
      if (a.opportunityId != null) ids.add(String(a.opportunityId));
    });
    return ids;
  }, [applications]);

  const hasAppliedToOpportunity = (opp: Opportunity) => appliedOpportunityIds.has(String(opp.id));

  const renderExploreFilterPanel = (opts: { title: string; onApply: () => void; panelClassName?: string }) => (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6',
        opts.panelClassName
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-900">{opts.title}</h3>
        <button
          type="button"
          onClick={() => setOpportunityFilters(EMPTY_FILTERS)}
          className="text-sm font-semibold text-slate-500 hover:text-[#002B5B]"
        >
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-6">
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Location</span>
          <div className="space-y-2.5">
            {locationRadioOptions.map((loc) => (
              <FilterCheckbox
                key={loc}
                checked={opportunityFilters.locationPresets.includes(loc)}
                onChange={(checked) =>
                  setOpportunityFilters((prev) => ({
                    ...prev,
                    locationPresets: checked
                      ? [...new Set([...prev.locationPresets, loc])]
                      : prev.locationPresets.filter((x) => x !== loc),
                  }))
                }
                label={loc}
              />
            ))}
          </div>
          <input
            type="text"
            value={opportunityFilters.locationOther}
            onChange={(e) => setOpportunityFilters((prev) => ({ ...prev, locationOther: e.target.value }))}
            placeholder="Other location (contains)…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-[#002B5B] mt-1"
          />
        </div>

        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Work type</span>
          <div className="space-y-2.5">
            {(
              [
                { label: 'Full-time', value: 'FULL_TIME' as const },
                { label: 'Part-time', value: 'PART_TIME' as const },
                { label: 'Flexible hours', value: 'FLEXIBLE' as const },
              ] as const
            ).map(({ label, value }) => (
              <FilterCheckbox
                key={value}
                checked={opportunityFilters.workTypes.includes(value)}
                onChange={(checked) =>
                  setOpportunityFilters((prev) => ({
                    ...prev,
                    workTypes: checked
                      ? [...new Set([...prev.workTypes, value])]
                      : prev.workTypes.filter((x) => x !== value),
                  }))
                }
                label={label}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Workplace type</span>
          <div className="space-y-2.5">
            {(
              [
                { label: 'Remote', value: 'Remote' as const },
                { label: 'Hybrid', value: 'Hybrid' as const },
                { label: 'In-person', value: 'On-site' as const },
              ] as const
            ).map(({ label, value }) => (
              <FilterCheckbox
                key={value}
                checked={opportunityFilters.workModes.includes(value)}
                onChange={(checked) =>
                  setOpportunityFilters((prev) => ({
                    ...prev,
                    workModes: checked
                      ? [...new Set([...prev.workModes, value])]
                      : prev.workModes.filter((x) => x !== value),
                  }))
                }
                label={label}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Duration</span>
          <div className="space-y-2.5">
            {(
              [
                { label: '< 3 months', value: '<3' as const },
                { label: '3–6 months', value: '3-6' as const },
                { label: '6+ months', value: '6+' as const },
              ] as const
            ).map(({ label, value }) => (
              <FilterCheckbox
                key={value}
                checked={opportunityFilters.durationBuckets.includes(value)}
                onChange={(checked) =>
                  setOpportunityFilters((prev) => ({
                    ...prev,
                    durationBuckets: checked
                      ? [...new Set([...prev.durationBuckets, value])]
                      : prev.durationBuckets.filter((x) => x !== value),
                  }))
                }
                label={label}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Paid status</span>
          <div className="space-y-2.5">
            <FilterCheckbox
              checked={opportunityFilters.paidSelections.includes('unpaid')}
              onChange={(checked) =>
                setOpportunityFilters((prev) => ({
                  ...prev,
                  paidSelections: checked
                    ? ([...new Set([...prev.paidSelections, 'unpaid'])] as OpportunityFilterState['paidSelections'])
                    : prev.paidSelections.filter((x) => x !== 'unpaid'),
                }))
              }
              label="Unpaid"
            />
            <FilterCheckbox
              checked={opportunityFilters.paidSelections.includes('paid')}
              onChange={(checked) =>
                setOpportunityFilters((prev) => ({
                  ...prev,
                  paidSelections: checked
                    ? ([...new Set([...prev.paidSelections, 'paid'])] as OpportunityFilterState['paidSelections'])
                    : prev.paidSelections.filter((x) => x !== 'paid'),
                }))
              }
              label="Paid"
            />
          </div>
          {opportunityFilters.paidSelections.length === 1 && opportunityFilters.paidSelections[0] === 'paid' ? (
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600 pt-1">
              <span className="text-slate-500">$</span>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={opportunityFilters.salaryMin}
                onChange={(e) => setOpportunityFilters((prev) => ({ ...prev, salaryMin: e.target.value }))}
                className="w-16 px-2 py-1 rounded-md border border-slate-200 text-sm"
              />
              <span className="text-slate-400">to</span>
              <input
                type="number"
                min={0}
                placeholder="max"
                value={opportunityFilters.salaryMax}
                onChange={(e) => setOpportunityFilters((prev) => ({ ...prev, salaryMax: e.target.value }))}
                className="w-20 px-2 py-1 rounded-md border border-slate-200 text-sm"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end mt-8 pt-2">
        <button
          type="button"
          onClick={opts.onApply}
          className="px-8 py-3 bg-[#002B5B] text-white text-sm font-bold rounded-xl hover:bg-[#001F42] transition-all shadow-sm"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );

  const applicationStudentFormProps = {
    fullName: student.fullName,
    email: student.email,
    university: student.university,
    department: student.departmentName ?? '',
    studyField: student.studyFieldName ?? '',
    studyYear: typeof student.studyYear === 'string' ? parseInt(student.studyYear, 10) : student.studyYear,
    cgpa: typeof student.cgpa === 'string' ? parseFloat(student.cgpa) : student.cgpa,
    cvFileName: student.extendedProfile?.cvFilename ?? 'No CV uploaded',
  };

  const renderApplicationListingDetails = (): ReactNode => {
    if (applicationListingDetailLoading) {
      return <p className="text-sm text-gray-600">Loading listing details…</p>;
    }
    if (!applicationListingDetail) {
      return (
        <p className="text-sm text-gray-600 rounded-md bg-gray-50 px-3 py-2">
          Full listing details are unavailable for this application.
        </p>
      );
    }
    const opp = applicationListingDetail;
    const meta = [
      opp.location,
      opp.workMode,
      formatDbWorkType(opp.workType),
      formatDbDuration(opp.duration),
    ].filter(Boolean);
    const overviewItems = [
      ['Target universities', opp.targetUniversities?.map((u) => u.name).join(', ') || 'All universities'],
      ['Application deadline', formatDeadline(opp.deadline)],
      ['Start date', formatDeadline(opp.startDate)],
      ['Positions', opp.positionCount != null ? String(opp.positionCount) : '—'],
    ];
    const companyButton = (
      <button
        type="button"
        className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
        onClick={() => {
          const cid = opp.companyId;
          setSelectedApplication(null);
          onNavigateTab?.('opportunities');
          setSelectedExploreOpportunityId(null);
          setExploreOpportunityDetail(null);
          setCompanyBrowseId(cid);
          void loadCompanyBrowseForId(cid);
        }}
      >
        {opp.companyName}
      </button>
    );

    return (
      <div>
        <h4 className="text-base font-bold text-slate-950">Opportunity</h4>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <div className="mt-1 h-12 w-12 shrink-0 rounded-xl bg-[#002B5B]" aria-hidden />
              <div className="min-w-0">
                <h5 className="text-xl font-bold text-[#0E2A50]">{opp.title}</h5>
                <div className="mt-0.5 text-sm">{companyButton}</div>
                {meta.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {meta.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                ) : null}
                {opp.requiredSkills?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opp.requiredSkills.slice(0, 5).map((skill) => (
                      <span key={skill} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-600">
              {opp.description ? (
                <div>
                  <p className="font-semibold text-slate-900">About the role</p>
                  <p className="mt-1 leading-6">{opp.description}</p>
                </div>
              ) : null}
              {opp.responsibilities?.length ? (
                <div>
                  <p className="font-semibold text-slate-900">Responsibilities</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {opp.responsibilities.slice(0, 3).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div className="w-full border-t border-slate-100 pt-4 lg:w-64 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <p className="text-sm font-bold text-slate-950">Overview</p>
            <div className="mt-3 space-y-3">
              {overviewItems.map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                  <p className="mt-0.5 text-sm font-bold text-[#0E2A50]">{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBestMatches = () => (
    <div className="space-y-6">
      <StudentBestMatchesTeaser
        loading={bestMatchesLoading}
        matches={bestMatchesList}
        onCompanyBrowse={(opp) => {
          onNavigateTab?.('opportunities');
          setSelectedExploreOpportunityId(null);
          setExploreOpportunityDetail(null);
          setCompanyBrowseId(String(opp.companyId));
          void loadCompanyBrowseForId(String(opp.companyId));
        }}
        onOpenDetail={(opp) => {
          onNavigateTab?.('opportunities');
          setCompanyBrowseSection('about');
          setCompanyBrowseId(null);
          setCompanyBrowseProfile(null);
          setCompanyBrowseOpportunities([]);
          setSelectedExploreOpportunityId(String(opp.id));
        }}
        onApply={handleApply}
        hasAppliedToOpportunity={hasAppliedToOpportunity}
        onUpgrade={() =>
          toast.message('Premium coming soon', {
            description: 'Unlock every skill-ranked opportunity when subscriptions launch.',
          })
        }
        onGoToProfile={() => onNavigateTab?.('profile')}
      />
    </div>
  );

  const renderOpportunities = () => {
    if (selectedExploreOpportunityId) {
      const listOpp = opportunityById.get(selectedExploreOpportunityId) ?? null;
      const displayOpp = exploreOpportunityDetail ?? listOpp;
      if (exploreOpportunityLoading && !exploreOpportunityDetail && !listOpp) {
        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Loading opportunity details…
          </div>
        );
      }
      if (exploreOpportunityError && !exploreOpportunityDetail && !listOpp) {
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-sm text-red-800">
              {exploreOpportunityError}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedExploreOpportunityId(null);
                setExploreOpportunityDetail(null);
                setExploreOpportunityError(null);
              }}
              className="text-sm font-semibold text-[#002B5B] hover:underline"
            >
              ← Back
            </button>
          </div>
        );
      }
      if (!displayOpp) {
        return null;
      }
      return (
        <OpportunityDetailView
          variant="student"
          opportunity={displayOpp}
          onBack={() => {
            setSelectedExploreOpportunityId(null);
            setExploreOpportunityDetail(null);
            setExploreOpportunityError(null);
          }}
          onApply={handleApply}
          applyDisabled={hasAppliedToOpportunity(displayOpp)}
          applyLabel={hasAppliedToOpportunity(displayOpp) ? 'Applied' : 'Apply Now'}
          onCompanyNameClick={() => {
            const cid = displayOpp.companyId;
            setSelectedExploreOpportunityId(null);
            setExploreOpportunityDetail(null);
            setCompanyBrowseId(cid);
            void loadCompanyBrowseForId(cid);
          }}
          showApplicationStats={false}
        />
      );
    }

    if (companyBrowseId) {
      if (companyBrowseLoading && !companyBrowseProfile) {
        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Loading company profile…
          </div>
        );
      }
      if (!companyBrowseProfile) {
        return null;
      }
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setCompanyBrowseId(null);
              setCompanyBrowseProfile(null);
              setCompanyBrowseOpportunities([]);
              setCompanyBrowseSection('about');
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0E2A50] hover:text-[#002B5B]"
          >
            ← Back to opportunities
          </button>

          <CompanyProfileTabbedView
            profile={companyBrowseProfile}
            section={companyBrowseSection}
            onSectionChange={setCompanyBrowseSection}
            canEditProfile={false}
            aboutLoading={false}
            opportunitiesPanel={
              <>
                <h3 className="text-3xl font-bold text-slate-900 mb-4">
                  {companyBrowseOpportunities.length} Opportunities Available
                </h3>
                <div className="space-y-3">
                  {!companyBrowseOpportunities.length ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center text-sm text-slate-500">
                      No visible opportunities from this company right now.
                    </div>
                  ) : (
                    companyBrowseOpportunities.map((opp) => (
                      <OpportunityRecordCard
                        key={opp.id}
                        opportunity={opp}
                        onViewDetails={() => setSelectedExploreOpportunityId(String(opp.id))}
                        showApply={!hasAppliedToOpportunity(opp)}
                        onApply={() => handleApply(opp)}
                      />
                    ))
                  )}
                </div>
              </>
            }
          />
        </div>
      );
    }

    return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-[#002B5B] tracking-tight">Explore Opportunities</h2>
        <p className="text-sm text-slate-500 mt-1.5">
          Browse every opening you are eligible for — filter by location, work mode, and more.
        </p>
      </div>

      {showPremiumExploreBanner ? (
        <div className="relative rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 via-white to-amber-50/40 p-4 pr-12 shadow-sm ring-1 ring-amber-100/70">
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setShowPremiumExploreBanner(false)}
            className="absolute right-2 top-2 rounded-lg p-1.5 text-amber-900/50 hover:bg-amber-100/80 hover:text-amber-950"
          >
            <X size={18} />
          </button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 ring-1 ring-amber-200/80">
                <Sparkles size={20} strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-950">
                  Premium — AI-ranked picks for your profile
                </p>
                <p className="mt-1 text-sm text-slate-600 leading-snug">
                  See your top skill matches first; unlock the full ranked list with Premium when it launches.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('best-matches')}
              className="shrink-0 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-700"
            >
              View Best Matches
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-3 items-stretch mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search opportunities by title, company, or skills..."
            suppressHydrationWarning
            className="flex-1 w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002B5B]/30 focus:border-[#002B5B] outline-none shadow-sm"
            value={opportunityFilters.q}
            onChange={(e) => setOpportunityFilters((prev) => ({ ...prev, q: e.target.value }))}
          />
        </div>
        <button
          type="button"
          suppressHydrationWarning
          onClick={() => setShowFilters((prev) => !prev)}
          className={cn(
            'flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-sm shrink-0',
            showFilters
              ? 'bg-[#001F42] text-white'
              : 'bg-[#002B5B] text-white hover:bg-[#001F42]'
          )}
        >
          <Filter size={18} />
          Filters
        </button>
      </div>

      {showFilters
        ? renderExploreFilterPanel({
            title: 'Filter Opportunities',
            panelClassName: 'mb-10',
            onApply: () => loadOpportunities(opportunityFilters),
          })
        : null}

      {opportunitiesError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {opportunitiesError}
        </div>
      ) : null}

      {isLoadingOpportunities ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-sm text-slate-500">
          Loading opportunities...
        </div>
      ) : null}

      {!isLoadingOpportunities && !opportunitiesError && !opportunities.length ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-2">
          <h3 className="text-lg font-bold text-slate-900">No matching opportunities found</h3>
          <p className="text-sm text-slate-500">
            Try loosening your filters or adding more skills to your profile.
          </p>
        </div>
      ) : null}

      {!!opportunities.length && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {opportunities.map((opp) => (
            <StudentOpportunityExploreCard
              key={opp.id}
              opportunity={opp}
              hasApplied={hasAppliedToOpportunity(opp)}
              onCompanyNameClick={() => {
                setSelectedExploreOpportunityId(null);
                setExploreOpportunityDetail(null);
                setCompanyBrowseId(String(opp.companyId));
                void loadCompanyBrowseForId(String(opp.companyId));
              }}
              onOpenDetail={() => {
                setCompanyBrowseSection('about');
                setCompanyBrowseId(null);
                setCompanyBrowseProfile(null);
                setCompanyBrowseOpportunities([]);
                setSelectedExploreOpportunityId(String(opp.id));
              }}
              onApply={() => handleApply(opp)}
            />
          ))}
        </div>
      )}

    </div>
    );
  };

  const renderApplications = () => {
    const formatDate = (iso: string | null) => {
      if (!iso) return '—';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const formatType = (type: string | null) => {
      if (!type) return '—';
      if (type === 'PROFESSIONAL_PRACTICE') return 'Professional Practice';
      if (type === 'INDIVIDUAL_GROWTH') return 'Individual Growth';
      return type;
    };

    const approvalIcon = (approved: boolean | null) => {
      if (approved === true)
        return <CheckCircle size={16} className="text-white fill-emerald-500 flex-shrink-0" />;
      if (approved === false)
        return <XCircle size={16} className="text-white fill-red-500 flex-shrink-0" />;
      return <Clock size={16} className="text-slate-400 flex-shrink-0" />;
    };

    const approvalText = (approved: boolean | null, status: string | null) => {
      if (approved === true) return { label: 'Approved', color: 'text-emerald-600' };
      if (approved === false) return { label: 'Rejected', color: 'text-red-600' };
      if (status === 'WAITING') return { label: 'Waiting', color: 'text-slate-400' };
      return { label: 'Pending', color: 'text-slate-400' };
    };

    return (
      <>
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">My Applications</h2>
            <p className="text-slate-500 text-sm mt-1">Track and manage your internship applications</p>
          </div>

          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search company, role, or application ID..."
                suppressHydrationWarning
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
                value={applicationSearch}
                onChange={(e) => setApplicationSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setShowApplicationFilters((prev) => !prev)}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all shrink-0',
                showApplicationFilters
                  ? 'bg-[#001F42] text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
            >
              <Filter size={16} />
              Filters
            </button>
          </div>

          {showApplicationFilters
            ? renderExploreFilterPanel({
                title: 'Filter Applications',
                panelClassName: 'rounded-xl p-5 mb-8',
                onApply: () => setShowApplicationFilters(false),
              })
            : null}

        {applicationsError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {applicationsError}
          </div>
        )}

        {isLoadingApplications && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-sm text-slate-500">
            Loading applications...
          </div>
        )}

        {!isLoadingApplications && !applicationsError && applications.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-1">
            <h3 className="text-base font-bold text-slate-900">No applications yet</h3>
            <p className="text-sm text-slate-500">Your submitted applications will appear here.</p>
          </div>
        )}

        {!isLoadingApplications && applications.length > 0 && (
          <div className="space-y-3">
            {filteredApplications.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
                No applications match your search or filters.
              </div>
            ) : (
              filteredApplications.map((app) => {
                const ppaInfo = approvalText(app.isApprovedByPPA ?? null, app.status);
                const companyInfo = approvalText(app.isApprovedByCompany ?? null, app.status);
                return (
                  <div key={app.applicationId} className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                        {getInitials(app.companyName ?? undefined)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-[#0891b2] font-semibold text-lg leading-snug">
                            {app.opportunityTitle
                              ? `${app.opportunityTitle} — ${app.companyName ?? ''}`
                              : (app.companyName ?? '—')}
                          </h3>
                          <span
                            className={cn(
                              'px-3 py-1 rounded text-xs font-bold uppercase tracking-wide flex-shrink-0',
                              app.status === 'APPROVED'
                                ? 'bg-emerald-500 text-white'
                                : app.status === 'REJECTED'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-[#002B5B] text-white'
                            )}
                          >
                            {app.status ?? 'PENDING'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={13} className="flex-shrink-0" />
                            {formatDate(app.createdAt)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Briefcase size={13} className="flex-shrink-0" />
                            {formatType(app.applicationType)}
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <Tag size={13} className="flex-shrink-0" />
                            ID: {formatApplicationIdDisplay(app.applicationId)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-500">PPA Response</span>
                              {approvalIcon(app.isApprovedByPPA ?? null)}
                              <span className={cn('text-xs font-semibold', ppaInfo.color)}>{ppaInfo.label}</span>
                            </div>
                            <div className="w-px h-4 bg-slate-200 flex-shrink-0 hidden sm:block" />
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-500">Company Response</span>
                              {approvalIcon(app.isApprovedByCompany ?? null)}
                              <span className={cn('text-xs font-semibold', companyInfo.color)}>{companyInfo.label}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedApplication(app)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-[#002B5B] text-[#002B5B] text-xs font-bold hover:bg-slate-50 transition-colors"
                          >
                            <Eye size={14} />
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
        </div>
      </>
    );
  };

  const renderProfile = () => {
    const removeExperienceById = async (experienceId: number) => {
      const { ok, errorMessage } = await withAccessToken((t) => deleteStudentExperience(t, experienceId));
      if (!ok || errorMessage) {
        throw new Error(errorMessage || 'Could not delete experience.');
      }
      setStudent((prev) => ({
        ...prev,
        experiences: (prev.experiences || []).filter((e) => e.experienceId !== experienceId),
      }));
      await reloadStudentProfile();
      toast.success('Experience removed.');
    };

    const removeProjectById = async (projectId: number) => {
      const { ok, errorMessage } = await withAccessToken((t) => deleteStudentProject(t, projectId));
      if (!ok || errorMessage) {
        throw new Error(errorMessage || 'Could not delete project.');
      }
      setStudent((prev) => ({
        ...prev,
        projects: (prev.projects || []).filter((p) => p.projectId !== projectId),
      }));
      await reloadStudentProfile();
      toast.success('Project removed.');
    };

    const removeCertificationById = async (certificationId: number) => {
      const { ok, errorMessage } = await withAccessToken((t) => deleteStudentCertification(t, certificationId));
      if (!ok || errorMessage) {
        throw new Error(errorMessage || 'Could not delete certification.');
      }
      setStudent((prev) => ({
        ...prev,
        extendedProfile: {
          ...prev.extendedProfile!,
          certificationFiles: (prev.extendedProfile?.certificationFiles || []).filter(
            (f) => f.certificationId !== certificationId
          ),
        },
      }));
      await reloadStudentProfile();
      toast.success('Certification removed.');
    };

    const profileEntityModals = (
      <>
        <ExperienceFormModal
          open={expModal.open}
          title={expModal.edit ? 'Edit experience' : 'Add experience'}
          initial={expModal.edit}
          onClose={() => setExpModal({ open: false, edit: null })}
          submit={async (body) => {
            try {
              return await withAccessToken(async (token) => {
                if (expModal.edit) {
                  const { errorMessage } = await updateStudentExperience(token, expModal.edit.experienceId, body);
                  return errorMessage;
                }
                const { errorMessage } = await createStudentExperience(token, body);
                return errorMessage;
              });
            } catch (e) {
              return e instanceof Error ? e.message : 'Request failed.';
            }
          }}
          onSuccess={reloadStudentProfile}
        />
        <ProjectFormModal
          open={projModal.open}
          title={projModal.edit ? 'Edit project' : 'Add project'}
          initial={projModal.edit}
          onClose={() => setProjModal({ open: false, edit: null })}
          submit={async (body) => {
            try {
              return await withAccessToken(async (token) => {
                if (projModal.edit) {
                  const { errorMessage } = await updateStudentProject(token, projModal.edit.projectId, body);
                  return errorMessage;
                }
                const { errorMessage } = await createStudentProject(token, body);
                return errorMessage;
              });
            } catch (e) {
              return e instanceof Error ? e.message : 'Request failed.';
            }
          }}
          onSuccess={reloadStudentProfile}
        />
        <CertificationEditModal
          open={!!certEditTarget}
          file={certEditTarget}
          onClose={() => setCertEditTarget(null)}
          submit={async (body) => {
            const id = certEditTarget?.certificationId;
            if (typeof id !== 'number') return 'Invalid certification.';
            try {
              return await withAccessToken(async (token) => {
                const { errorMessage } = await patchCertificationMetadata(token, id, body);
                return errorMessage;
              });
            } catch (e) {
              return e instanceof Error ? e.message : 'Request failed.';
            }
          }}
          onSuccess={reloadStudentProfile}
        />
        <CertificationUploadModal
          open={certUploadOpen}
          onClose={() => setCertUploadOpen(false)}
          uploading={certUploading}
          onPickFile={(file, displayName) => {
            void (async () => {
              setCertUploading(true);
              try {
                const { data, errorMessage } = await withAccessToken((token) =>
                  uploadStudentCertification(token, file, displayName)
                );
                if (!data || errorMessage) {
                  toast.error(errorMessage || 'Could not upload certification.');
                  return;
                }
                await reloadStudentProfile();
                toast.success('Certification uploaded successfully.');
                setCertUploadOpen(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Could not upload certification.');
              } finally {
                setCertUploading(false);
              }
            })();
          }}
        />
      </>
    );

    if (isEditingProfile) {
      return (
        <>
          <ProfileEditor
            student={student}
            onRefreshProfile={reloadStudentProfile}
            onUploadProfilePhoto={async (file: File) => {
              const { data, errorMessage } = await withAccessToken((token) => uploadProfilePhoto(token, file));
              if (!data || errorMessage) {
                throw new Error(errorMessage || 'Could not upload profile photo.');
              }
              await reloadStudentProfile();
              toast.success('Profile photo updated.');
            }}
            onSave={async (updated) => {
              const { data: savedStudent, errorMessage } = await withAccessToken((accessToken) =>
                saveCurrentStudentProfile(accessToken, updated)
              );

              if (!savedStudent || errorMessage) {
                throw new Error(errorMessage || 'Could not save your profile.');
              }

              setStudent(savedStudent);
              setIsEditingProfile(false);
            }}
            onUploadCv={async (file: File) => {
              const { data, errorMessage } = await withAccessToken((accessToken) =>
                uploadStudentCv(accessToken, file)
              );

              if (!data || errorMessage) {
                throw new Error(errorMessage || 'Could not upload CV.');
              }

              setStudent((prev) => ({
                ...prev,
                extendedProfile: {
                  ...prev.extendedProfile!,
                  cvUrl: data.storagePath,
                  cvFilename: data.originalFilename,
                  cvFile: data,
                },
              }));
              await reloadStudentProfile();
              toast.success('CV uploaded successfully.');
            }}
            onDeleteCv={async () => {
              const { ok, errorMessage } = await withAccessToken((accessToken) =>
                deleteStudentCv(accessToken)
              );

              if (!ok || errorMessage) {
                throw new Error(errorMessage || 'Could not delete CV.');
              }

              setStudent((prev) => ({
                ...prev,
                extendedProfile: {
                  ...prev.extendedProfile!,
                  cvUrl: undefined,
                  cvFilename: undefined,
                  cvFile: undefined,
                },
              }));
              await reloadStudentProfile();
              toast.success('CV removed.');
            }}
            onDownloadFile={async (path: string, filename: string) => {
              const { errorMessage } = await withAccessToken((accessToken) =>
                downloadStudentProfileFile(accessToken, path, filename)
              );

              if (errorMessage) {
                throw new Error(errorMessage);
              }
            }}
            onCancel={() => setIsEditingProfile(false)}
          />
          {profileEntityModals}
        </>
      );
    }

    const cvPath =
      student.extendedProfile?.cvFile?.downloadUrl || '/api/student/profile/cv';
    const cvName =
      student.extendedProfile?.cvFile?.originalFilename ||
      student.extendedProfile?.cvFilename ||
      'cv.pdf';

    return (
      <>
        <StudentProfileView
          student={student}
          projects={student.projects ?? []}
          onEdit={() => {
            closePdfPreview();
            setIsEditingProfile(true);
          }}
          onEditExperience={(e) => setExpModal({ open: true, edit: e })}
          onEditProject={(p) => setProjModal({ open: true, edit: p })}
          onEditCertification={(f) => setCertEditTarget(f)}
          onDeleteExperience={(e) => removeExperienceById(e.experienceId)}
          onDeleteProject={(p) => removeProjectById(p.projectId)}
          onDeleteCertification={(f) => {
            const id = f.certificationId;
            if (typeof id !== 'number') {
              return Promise.reject(new Error('Invalid certification.'));
            }
            return removeCertificationById(id);
          }}
          onAddExperience={() => {
            closePdfPreview();
            setExpModal({ open: true, edit: null });
          }}
          onAddProject={() => {
            closePdfPreview();
            setProjModal({ open: true, edit: null });
          }}
          onAddCertification={() => {
            closePdfPreview();
            setCertUploadOpen(true);
          }}
          onPreviewCv={() => {
            void openAuthenticatedPdfPreview(cvPath, cvName, {
              downloadFilename: cvName,
              filenameHint: cvName,
              mimeType: student.extendedProfile?.cvFile?.mimeType,
            });
          }}
          onDownloadCv={() => {
            void withAccessToken((accessToken) =>
              downloadStudentProfileFile(accessToken, cvPath, cvName)
            );
          }}
          onPreviewCertification={(file) => {
            const path =
              file.downloadUrl || `/api/student/profile/certifications/${file.certificationId}`;
            const name = file.displayName || file.originalFilename;
            void openAuthenticatedPdfPreview(path, name, {
              downloadFilename: file.originalFilename,
              filenameHint: file.originalFilename,
              mimeType: file.mimeType,
            });
          }}
          onDownloadCertification={(file) => {
            void withAccessToken((accessToken) =>
              downloadStudentProfileFile(
                accessToken,
                file.downloadUrl || `/api/student/profile/certifications/${file.certificationId}`,
                file.originalFilename
              )
            );
          }}
        />
        <PdfPreviewModal
          open={!!pdfPreview}
          title={pdfPreview?.title ?? ''}
          blobUrl={pdfPreview?.url ?? null}
          mimeType={pdfPreview?.mimeType}
          filenameHint={pdfPreview?.filenameHint}
          onClose={closePdfPreview}
          onDownload={() => {
            if (!pdfPreview) return;
            void withAccessToken((accessToken) =>
              downloadStudentProfileFile(
                accessToken,
                pdfPreview.downloadPath,
                pdfPreview.downloadFilename
              )
            );
          }}
        />
        {profileEntityModals}
      </>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderProfile();
      case 'profile':
        return renderProfile();
      case 'opportunities':
        return renderOpportunities();
      case 'best-matches':
        return renderBestMatches();
      case 'applications':
        return renderApplications();
      default:
        return <UnderDevelopment moduleName={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} />;
    }
  };

  const profileBrowseMode = activeTab === 'profile' && !isEditingProfile;

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
            setPendingApplicationFocusId(applicationId);
            void loadApplications();
            onNavigateTab?.('applications');
            close();
          }}
          className="max-w-none mx-0 h-full min-h-0 flex flex-col shadow-2xl ring-1 ring-slate-200/80"
        />
      )}
      topBarVariant={profileBrowseMode ? 'brand' : 'default'}
      hidePageIntro={profileBrowseMode}
    >
      {renderContent()}
      {applicationOpportunity && (
        <SubmitApplicationModal
          opportunity={{ title: applicationOpportunity.title, company: applicationOpportunity.company }}
          student={applicationStudentFormProps}
          onClose={() => setApplicationOpportunity(null)}
          onSubmit={handleSubmitApplication}
          canApplyForPP={student.canApplyForPP !== false}
        />
      )}
      {selectedApplication && (
        <SubmitApplicationModal
          key={selectedApplication.applicationId ?? 'app-view'}
          mode="view"
          opportunity={{
            title: selectedApplication.opportunityTitle ?? 'Opportunity',
            company: selectedApplication.companyName ?? '',
          }}
          student={applicationStudentFormProps}
          onClose={() => setSelectedApplication(null)}
          viewReview={{
            applicationId: selectedApplication.applicationId,
            status: selectedApplication.status,
            createdAt: selectedApplication.createdAt,
            isApprovedByPPA: selectedApplication.isApprovedByPPA,
            isApprovedByCompany: selectedApplication.isApprovedByCompany,
          }}
          viewFields={{
            phoneNumber: selectedApplication.phoneNumber,
            applicationType: selectedApplication.applicationType,
            accuracyConfirmed: selectedApplication.accuracyConfirmed ?? null,
          }}
          listingDetails={renderApplicationListingDetails()}
        />
      )}
    </Dashboard>
  );
};

export default StudentDashboard;
