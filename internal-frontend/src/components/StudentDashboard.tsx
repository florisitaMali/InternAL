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
import { ApplicationFormData } from './SubmitApplicationModal';
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  MapPin,
  Search,
  Tag,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';
import type {
  Application,
  Opportunity,
  Student,
  StudentExperience,
  StudentProfileFile,
  StudentProject,
} from '../types';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';
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
import OpportunityRecordCard from '@/src/components/OpportunityRecordCard';
import {
  formatDbDuration,
  formatDbWorkType,
  formatDeadline,
  formatOpportunityType,
  formatRelativePosted,
  formatTargetUniversitiesDisplay,
} from '@/src/lib/opportunityFormat';

interface StudentDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  currentStudent?: Student | null;
  onToggleSidebar?: () => void;
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

function normalizeWorkTypeKey(wt: string | undefined): string | null {
  if (!wt?.trim()) return null;
  return wt.trim().toUpperCase().replace(/-/g, '_');
}

function matchesFlexibleWorkType(workType: string | undefined): boolean {
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

function formatWorkMode(mode?: string | null): string {
  if (!mode) return '';
  const map: Record<string, string> = {
    REMOTE: 'Remote',
    HYBRID: 'Hybrid',
    IN_PERSON: 'In-person',
  };
  return map[mode] ?? mode;
}

function formatPostedLabel(iso?: string | null): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
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
}) => {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [student, setStudent] = useState<Student>(currentStudent ?? createPlaceholderStudent());
  const [opportunityFilters, setOpportunityFilters] = useState<OpportunityFilterState>(EMPTY_FILTERS);
  const [discoveredLocations, setDiscoveredLocations] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
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
    if (!currentStudent) return;
    setStudent(currentStudent);
    setIsEditingProfile(false);
  }, [currentStudent]);

  const withAccessToken = async <T,>(work: (accessToken: string) => Promise<T>): Promise<T> => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Could not find the current session token.');
    }

    return work(session.access_token);
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

      const withSkillMatches = data.filter((o) => (o.skillMatchCount ?? 0) > 0);
      const visible = applyClientOpportunityFilters(withSkillMatches, filters);
      setOpportunities(visible);
      setSelectedOpportunity((current) =>
        current ? (visible.find((item) => item.id === current.id) ?? null) : null
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load opportunities.';
      setOpportunities([]);
      setSelectedOpportunity(null);
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

  const renderOpportunityDetails = () => {
    if (!selectedOpportunity) {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-sm text-slate-500">
          Select an opportunity to view its details.
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#002B5B]/10 text-[11px] font-bold uppercase tracking-wider text-[#002B5B]">
                  {formatOpportunityType(selectedOpportunity.type)}
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  {selectedOpportunity.skillMatchCount || 0} skill match{selectedOpportunity.skillMatchCount === 1 ? '' : 'es'}
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">{selectedOpportunity.title}</h3>
                <p className="text-sm font-semibold text-[#20948B] mt-1">{selectedOpportunity.companyName}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={hasAppliedToOpportunity(selectedOpportunity)}
              onClick={() => handleApply(selectedOpportunity)}
              className={cn(
                'px-5 py-3 rounded-xl text-sm font-bold transition-colors',
                hasAppliedToOpportunity(selectedOpportunity)
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-[#002B5B] text-white hover:bg-[#001F42]'
              )}
            >
              {hasAppliedToOpportunity(selectedOpportunity) ? 'Applied' : 'Apply Now'}
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Deadline</div>
              <div className="text-sm font-semibold text-slate-900">{formatDeadline(selectedOpportunity.deadline)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Location</div>
              <div className="text-sm font-semibold text-slate-900">{selectedOpportunity.location || 'Not specified'}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Reference code</div>
              <div className="text-sm font-semibold text-slate-900">{selectedOpportunity.code || '—'}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Workplace</div>
              <div className="text-sm font-semibold text-slate-900">
                {selectedOpportunity.workMode || '—'}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Employment type</div>
              <div className="text-sm font-semibold text-slate-900">
                {formatDbWorkType(selectedOpportunity.workType)}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Duration</div>
              <div className="text-sm font-semibold text-slate-900">
                {formatDbDuration(selectedOpportunity.duration)}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Start date</div>
              <div className="text-sm font-semibold text-slate-900">
                {selectedOpportunity.startDate ? formatDeadline(selectedOpportunity.startDate) : '—'}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Posted</div>
              <div className="text-sm font-semibold text-slate-900">{formatPostedLabel(selectedOpportunity.createdAt)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Open positions</div>
              <div className="text-sm font-semibold text-slate-900">
                {selectedOpportunity.positionCount != null ? String(selectedOpportunity.positionCount) : '—'}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Monthly salary</div>
              <div className="text-sm font-semibold text-slate-900">
                {selectedOpportunity.salaryMonthly != null && selectedOpportunity.salaryMonthly > 0
                  ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(selectedOpportunity.salaryMonthly)} / month`
                  : '—'}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 md:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Target universities
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {formatTargetUniversitiesDisplay(selectedOpportunity)}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Overview</h4>
            <p className="text-sm leading-7 text-slate-600">
              {selectedOpportunity.description || 'No description was provided for this opportunity.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Required Skills</h4>
              <div className="flex flex-wrap gap-2">
                {(selectedOpportunity.requiredSkills || []).length ? (
                  selectedOpportunity.requiredSkills.map((skill) => (
                    <span key={skill} className="px-3 py-1 rounded-lg bg-[#002B5B]/10 text-xs font-bold text-[#002B5B]">
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No skill requirements were provided.</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Experience</h4>
              <p className="text-sm leading-7 text-slate-600">
                {selectedOpportunity.requiredExperience || 'No experience requirement was provided.'}
              </p>
            </div>
          </div>

          {selectedOpportunity.niceToHave?.trim() ? (
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Nice to have</h4>
              <div className="text-sm leading-7 text-slate-600 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4">
                {selectedOpportunity.niceToHave}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Qualifications</h4>
              <p className="text-sm leading-7 text-slate-600">
                {(selectedOpportunity.requiredSkills || []).length
                  ? `Candidates should be comfortable with ${selectedOpportunity.requiredSkills.join(', ')}.`
                  : 'Qualifications were not specified separately for this opportunity.'}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Compensation notes</h4>
              <p className="text-sm leading-7 text-slate-600">
                {selectedOpportunity.isPaid === false
                  ? 'This role is listed as unpaid.'
                  : selectedOpportunity.isPaid === true
                    ? 'This role is listed as paid; see monthly salary above if provided.'
                    : 'Paid status was not specified for this listing.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOpportunityModal = () => {
    if (!selectedOpportunity) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/50">
        <div className="flex min-h-full justify-center px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:px-6 sm:pb-20 sm:pt-8">
          <div className="w-full max-w-5xl sm:my-4">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedOpportunity(null)}
              className="inline-flex items-center justify-center gap-2 min-h-11 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-md border border-slate-200 hover:bg-slate-50"
            >
              <X size={22} strokeWidth={2.25} className="shrink-0" aria-hidden />
              Close
            </button>
          </div>
          {renderOpportunityDetails()}
          </div>
        </div>
      </div>
    );
  };

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

  const applicationListingDetails = (app: ApplicationResponse): ReactNode => {
    const oppId = app.opportunityId != null ? String(app.opportunityId) : '';
    const opp = opportunityById.get(oppId);
    if (!opp) {
      return (
        <p className="text-sm text-gray-600 rounded-md bg-gray-50 px-3 py-2">
          Full listing details are unavailable for this application.
        </p>
      );
    }
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">Listing details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</div>
            <div className="font-medium text-gray-900">{opp.location || '—'}</div>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Workplace</div>
            <div className="font-medium text-gray-900">{formatWorkMode(opp.workMode) || opp.workMode || '—'}</div>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Employment type</div>
            <div className="font-medium text-gray-900">{formatDbWorkType(opp.workType)}</div>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Duration</div>
            <div className="font-medium text-gray-900">{formatDbDuration(opp.duration)}</div>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reference code</div>
            <div className="font-medium text-gray-900">{opp.code || '—'}</div>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deadline</div>
            <div className="font-medium text-gray-900">{formatDeadline(opp.deadline)}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderOpportunities = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-[#002B5B] tracking-tight">Explore Opportunities</h2>
        <p className="text-sm text-slate-500 mt-1.5">
          Discover internships that match your skills and interests.
        </p>
      </div>

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
            <div
              key={opp.id}
              className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow duration-200 flex flex-col"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-[#002B5B] rounded-lg flex items-center justify-center font-bold text-white text-sm tracking-wide">
                  {getInitials(opp.companyName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[#002B5B] leading-snug">{opp.title}</h3>
                  <p className="text-slate-600 text-sm font-medium mt-0.5">{opp.companyName}</p>
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
                    {formatWorkMode(opp.workMode) || opp.workMode}
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
                    onClick={() => setSelectedOpportunity(opp)}
                    suppressHydrationWarning
                    className="px-4 py-2 border-2 border-[#002B5B] text-[#002B5B] bg-white rounded-xl text-sm font-bold hover:bg-slate-50 transition-all whitespace-nowrap"
                  >
                    View Details
                  </button>
                  <button
                    type="button"
                    disabled={hasAppliedToOpportunity(opp)}
                    onClick={() => handleApply(opp)}
                    suppressHydrationWarning
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-sm',
                      hasAppliedToOpportunity(opp)
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-[#002B5B] text-white hover:bg-[#001F42]'
                    )}
                  >
                    {hasAppliedToOpportunity(opp) ? 'Applied' : 'Apply Now'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedOpportunity ? renderOpportunityModal() : null}
    </div>
  );

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
          listingDetails={applicationListingDetails(selectedApplication)}
        />
      )}
    </Dashboard>
  );
};

export default StudentDashboard;
