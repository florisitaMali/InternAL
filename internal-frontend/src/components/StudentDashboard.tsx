'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { mockApplications, mockStudents } from '@/src/lib/mockData';
import {
  Briefcase,
  Building2,
  Calendar,
  ChevronRight,
  FileText,
  Filter,
  Search,
  Tag,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';
import type { Opportunity, Student, StudentExperience, StudentProfileFile, StudentProject } from '../types';
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
import { formatDeadline, formatOpportunityType } from '@/src/lib/opportunityFormat';

interface StudentDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  currentStudent?: Student | null;
  onToggleSidebar?: () => void;
}

type OpportunityFilterState = {
  q: string;
  type: string;
  location: string;
  skills: string[];
  workMode: string;
  isPaid: string;
};

const EMPTY_FILTERS: OpportunityFilterState = {
  q: '',
  type: '',
  location: '',
  skills: [],
  workMode: '',
  isPaid: '',
};

const typeOptions = [
  { value: '', label: 'All types' },
  { value: 'PROFESSIONAL_PRACTICE', label: 'Professional Practice' },
  { value: 'INDIVIDUAL_GROWTH', label: 'Individual Growth' },
];

function formatOpportunityType(type?: string): string {
  if (!type) return 'Opportunity';
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDeadline(deadline?: string): string {
  if (!deadline) return 'No deadline specified';
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
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

function buildOpportunityFilters(filters: OpportunityFilterState): StudentOpportunityFilters {
  return {
    q: filters.q || undefined,
    type: filters.type || undefined,
    location: filters.location || undefined,
    skills: filters.skills.length ? filters.skills : undefined,
    workMode: filters.workMode || undefined,
    isPaid: filters.isPaid === 'true' ? true : filters.isPaid === 'false' ? false : undefined,
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
  const [student, setStudent] = useState<Student>(currentStudent ?? mockStudents[0]);
  const [opportunityFilters, setOpportunityFilters] = useState<OpportunityFilterState>(EMPTY_FILTERS);
  const [skillFilterInput, setSkillFilterInput] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
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

      setOpportunities(data);
      setSelectedOpportunity((current) =>
        current ? (data.find((item) => item.id === current.id) ?? null) : null
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
    void loadOpportunities(opportunityFilters);
  }, [loadOpportunities, student.id, opportunityFilters]);

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

  const availableSkillOptions = useMemo(() => {
    const ownSkills = student.extendedProfile?.skills || [];
    const requiredSkills = opportunities.flatMap((opportunity) => opportunity.requiredSkills || []);
    return Array.from(new Set([...ownSkills, ...requiredSkills])).sort((a, b) => a.localeCompare(b));
  }, [opportunities, student.extendedProfile?.skills]);

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
        if (response.ok) {
          toast.success('Application submitted successfully!');
          setApplicationOpportunity(null);
        } else {
          toast.error('Failed to submit application.');
        }
      });
    } catch {
      toast.error('Failed to submit application.');
    }
  };

  const addSkillFilter = (rawSkill: string) => {
    const skill = rawSkill.trim();
    if (!skill || opportunityFilters.skills.includes(skill)) return;
    setOpportunityFilters((prev) => ({ ...prev, skills: [...prev.skills, skill] }));
    setSkillFilterInput('');
  };

  const removeSkillFilter = (skill: string) => {
    setOpportunityFilters((prev) => ({
      ...prev,
      skills: prev.skills.filter((item) => item !== skill),
    }));
  };

  const renderFilterPanel = () => (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900">Filter Opportunities</h3>
        <button
          type="button"
          onClick={() => setOpportunityFilters(EMPTY_FILTERS)}
          className="text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Location</span>
          <input
            type="text"
            value={opportunityFilters.location}
            onChange={(e) => setOpportunityFilters((prev) => ({ ...prev, location: e.target.value }))}
            placeholder="City, country, or remote"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-[#002B5B]"
          />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Work Type</span>
          {([
            { label: 'Full-time', value: 'PROFESSIONAL_PRACTICE' },
            { label: 'Part-time', value: 'INDIVIDUAL_GROWTH' },
            { label: 'Flexible Hours', value: 'FLEXIBLE' },
          ] as const).map(({ label, value }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={opportunityFilters.type === value}
                onChange={() =>
                  setOpportunityFilters((prev) => ({
                    ...prev,
                    type: prev.type === value ? '' : value,
                  }))
                }
                className="w-4 h-4 rounded border-slate-300 text-[#002B5B] focus:ring-[#002B5B]"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Workplace Type</span>
          {([
            { label: 'Remote', value: 'Remote' },
            { label: 'Hybrid', value: 'Hybrid' },
            { label: 'In-person', value: 'On-site' },
          ] as const).map(({ label, value }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={opportunityFilters.workMode === value}
                onChange={() =>
                  setOpportunityFilters((prev) => ({
                    ...prev,
                    workMode: prev.workMode === value ? '' : value,
                  }))
                }
                className="w-4 h-4 rounded border-slate-300 text-[#002B5B] focus:ring-[#002B5B]"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Duration</span>
          {([
            { label: '<3 months', value: '<3' },
            { label: '3-6 months', value: '3-6' },
            { label: '6+ months', value: '6+' },
          ] as const).map(({ label, value }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={durationFilter === value}
                onChange={() => setDurationFilter((prev) => (prev === value ? '' : value))}
                className="w-4 h-4 rounded border-slate-300 text-[#002B5B] focus:ring-[#002B5B]"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Paid Status</span>
          {([
            { label: 'Paid', value: 'true' },
            { label: 'Unpaid', value: 'false' },
          ] as const).map(({ label, value }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={opportunityFilters.isPaid === value}
                onChange={() =>
                  setOpportunityFilters((prev) => ({
                    ...prev,
                    isPaid: prev.isPaid === value ? '' : value,
                  }))
                }
                className="w-4 h-4 rounded border-slate-300 text-[#002B5B] focus:ring-[#002B5B]"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={() => loadOpportunities(opportunityFilters)}
          className="px-5 py-2.5 bg-[#002B5B] text-white text-sm font-bold rounded-xl hover:bg-[#001F42] transition-all"
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
              onClick={() => handleApply(selectedOpportunity)}
              className="px-5 py-3 rounded-xl bg-[#002B5B] text-sm font-bold text-white hover:bg-[#001F42]"
            >
              Apply Now
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Deadline</div>
              <div className="text-sm font-semibold text-slate-900">{formatDeadline(selectedOpportunity.deadline)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Location</div>
              <div className="text-sm font-semibold text-slate-900">{selectedOpportunity.location || 'Not specified'}</div>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Qualifications</h4>
              <p className="text-sm leading-7 text-slate-600">
                {(selectedOpportunity.requiredSkills || []).length
                  ? `Candidates should be comfortable with ${selectedOpportunity.requiredSkills.join(', ')}.`
                  : 'Qualifications were not specified separately in the backend data.'}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Benefits</h4>
              <p className="text-sm leading-7 text-slate-600">
                Benefits are not stored separately for this opportunity yet.
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
      <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-6">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedOpportunity(null)}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700"
            >
              <X size={16} />
              Close
            </button>
          </div>
          {renderOpportunityDetails()}
        </div>
      </div>
    );
  };

  const renderOpportunities = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Explore Opportunities</h2>
        <p className="text-sm text-slate-500 mt-1">
          Discover internships that match your skills and interests.
        </p>
      </div>

      <div className="flex gap-3 items-center mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search title, company, skill..."
            suppressHydrationWarning
            className="flex-1 w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
            value={opportunityFilters.q}
            onChange={(e) => setOpportunityFilters((prev) => ({ ...prev, q: e.target.value }))}
          />
        </div>
        <button
          type="button"
          suppressHydrationWarning
          onClick={() => setShowFilters((prev) => !prev)}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
        >
          <Filter size={16} />
          Filters
        </button>
      </div>

      {showFilters ? renderFilterPanel() : null}

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all duration-200 flex flex-col"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-500 text-xs tracking-wide">
                  {getInitials(opp.companyName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[#002B5B] leading-snug">{opp.title}</h3>
                  <p className="text-slate-500 text-sm mt-0.5">{opp.companyName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Posted recently</p>
                </div>
              </div>

              <p className="text-slate-500 text-sm mt-3 line-clamp-2">
                {opp.description || 'No description provided.'}
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
                {opp.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={12} className="flex-shrink-0" />
                    {opp.location}
                  </span>
                )}
                {opp.workMode && (
                  <span className="flex items-center gap-1.5">
                    <Building2 size={12} className="flex-shrink-0" />
                    {formatWorkMode(opp.workMode)}
                  </span>
                )}
                {opp.duration && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} className="flex-shrink-0" />
                    {opp.duration}
                  </span>
                )}
                {opp.isPaid === true && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                    Paid
                  </span>
                )}
                {opp.isPaid === false && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                    Unpaid
                  </span>
                )}
              </div>

              {opp.requiredSkills && opp.requiredSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {opp.requiredSkills.slice(0, 5).map((skill) => (
                    <span key={skill} className="px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-600">
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedOpportunity(opp)}
                  suppressHydrationWarning
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all whitespace-nowrap"
                >
                  View Details
                </button>
                <button
                  type="button"
                  onClick={() => handleApply(opp)}
                  suppressHydrationWarning
                  className="px-4 py-2 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#001F42] transition-all whitespace-nowrap"
                >
                  Apply Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedOpportunity ? renderOpportunityModal() : null}
    </div>
  );

  const renderApplications = () => {
    const formatAppId = (id: number | null) =>
      id != null ? `APP${String(id).padStart(3, '0')}` : '—';

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

    const filteredApplications = applicationSearch.trim()
      ? applications.filter((a) => {
          const q = applicationSearch.trim().toLowerCase();
          return (
            (a.companyName ?? '').toLowerCase().includes(q) ||
            formatAppId(a.applicationId).toLowerCase().includes(q)
          );
        })
      : applications;

    return (
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
              placeholder="Search companies or application ID..."
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
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
          >
            <Filter size={16} />
            Filters
          </button>
        </div>

        {showApplicationFilters && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Filter Applications</h3>
              <button type="button" className="text-sm font-semibold text-slate-500 hover:text-slate-900">
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Location</span>
                <input
                  type="text"
                  placeholder="City, country, or remote"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-[#002B5B]"
                />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Work Type</span>
                {(['Full-time', 'Part-time', 'Flexible Hours'] as const).map((label) => (
                  <label key={label} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#002B5B] focus:ring-[#002B5B]" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Workplace Type</span>
                {(['Remote', 'Hybrid', 'In-person'] as const).map((label) => (
                  <label key={label} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#002B5B] focus:ring-[#002B5B]" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Duration</span>
                {(['<3 months', '3-6 months', '6+ months'] as const).map((label) => (
                  <label key={label} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#002B5B] focus:ring-[#002B5B]" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Paid Status</span>
                {(['Paid', 'Unpaid'] as const).map((label) => (
                  <label key={label} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#002B5B] focus:ring-[#002B5B]" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                className="px-5 py-2.5 bg-[#002B5B] text-white text-sm font-bold rounded-xl hover:bg-[#001F42] transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

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
                No applications match your search.
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
                            ID: {formatAppId(app.applicationId)}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-500">PPA Response</span>
                            {approvalIcon(app.isApprovedByPPA ?? null)}
                            <span className={cn('text-xs font-semibold', ppaInfo.color)}>{ppaInfo.label}</span>
                          </div>
                          <div className="w-px h-4 bg-slate-200 flex-shrink-0" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-500">Company Response</span>
                            {approvalIcon(app.isApprovedByCompany ?? null)}
                            <span className={cn('text-xs font-semibold', companyInfo.color)}>{companyInfo.label}</span>
                          </div>
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
          student={{
            fullName: student.fullName,
            email: student.email,
            university: student.university,
            department: student.departmentName ?? '',
            studyField: student.studyFieldName ?? '',
            studyYear: typeof student.studyYear === 'string' ? parseInt(student.studyYear) : student.studyYear,
            cgpa: typeof student.cgpa === 'string' ? parseFloat(student.cgpa) : student.cgpa,
            cvFileName: student.extendedProfile?.cvFilename ?? 'No CV uploaded',
          }}
          onClose={() => setApplicationOpportunity(null)}
          onSubmit={handleSubmitApplication}
        />
      )}
    </Dashboard>
  );
};

export default StudentDashboard;
