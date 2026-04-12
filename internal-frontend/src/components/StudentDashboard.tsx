'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Dashboard from './Dashboard';
import ProfileEditor from './ProfileEditor';
import UnderDevelopment from './UnderDevelopment';
import SubmitApplicationModal from './SubmitApplicationModal';
import { ApplicationFormData } from './SubmitApplicationModal';
import { mockApplications, mockStudents } from '@/src/lib/mockData';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Edit2,
  FileText,
  Filter,
  MapPin,
  Search,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';
import type { Opportunity, Student } from '../types';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import {
  deleteStudentCertification,
  deleteStudentCv,
  downloadStudentProfileFile,
  saveCurrentStudentProfile,
  uploadStudentCertification,
  uploadStudentCv,
} from '@/src/lib/auth/userAccount';
import { fetchStudentOpportunities, getApiBaseUrl, type StudentOpportunityFilters } from '@/src/lib/auth/opportunities';

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

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
        { label: 'My Applications', value: mockApplications.filter((a) => a.studentId === student.id).length, icon: FileText, color: 'bg-blue-500' },
        { label: 'Approved', value: mockApplications.filter((a) => a.studentId === student.id && a.status === 'APPROVED').length, icon: CheckCircle, color: 'bg-emerald-500' },
        { label: 'Pending', value: mockApplications.filter((a) => a.studentId === student.id && a.status === 'PENDING').length, icon: Clock, color: 'bg-amber-500' },
        { label: 'Rejected', value: mockApplications.filter((a) => a.studentId === student.id && a.status === 'REJECTED').length, icon: XCircle, color: 'bg-red-500' },
      ].map((stat, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className={cn('p-3 rounded-xl text-white', stat.color)}>
              <stat.icon size={20} />
            </div>
            <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
        </div>
      ))}
    </div>
  );

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

  const renderApplications = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900">My Applications</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {mockApplications.filter((a) => a.studentId === student.id).map((app) => (
          <div key={app.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-400">
                {app.companyName[0]}
              </div>
              <div>
                <div className="font-bold text-slate-900">{app.opportunityTitle}</div>
                <div className="text-xs text-slate-500">{app.companyName} • {app.type}</div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</div>
                <span
                  className={cn(
                    'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                    app.status === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-700'
                      : app.status === 'REJECTED'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                  )}
                >
                  {app.status}
                </span>
              </div>
              <button suppressHydrationWarning className="p-2 text-slate-400 hover:text-[#002B5B] transition-all">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderProfile = () => {
    if (isEditingProfile) {
      return (
        <ProfileEditor
          student={student}
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
            toast.success('CV removed.');
          }}
          onUploadCertification={async (file: File, displayName?: string) => {
            const { data, errorMessage } = await withAccessToken((accessToken) =>
              uploadStudentCertification(accessToken, file, displayName)
            );

            if (!data || errorMessage) {
              throw new Error(errorMessage || 'Could not upload certification.');
            }

            setStudent((prev) => ({
              ...prev,
              extendedProfile: {
                ...prev.extendedProfile!,
                certificationFiles: [data, ...(prev.extendedProfile?.certificationFiles || [])],
              },
            }));
            toast.success('Certification uploaded successfully.');
          }}
          onDeleteCertification={async (certificationId: number) => {
            const { ok, errorMessage } = await withAccessToken((accessToken) =>
              deleteStudentCertification(accessToken, certificationId)
            );

            if (!ok || errorMessage) {
              throw new Error(errorMessage || 'Could not delete certification.');
            }

            setStudent((prev) => ({
              ...prev,
              extendedProfile: {
                ...prev.extendedProfile!,
                certificationFiles: (prev.extendedProfile?.certificationFiles || []).filter(
                  (file) => file.certificationId !== certificationId
                ),
              },
            }));
            toast.success('Certification removed.');
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
      );
    }

    return (
      <div className="space-y-8">
        <div
          className={cn(
            'rounded-2xl border px-4 py-4 flex items-center gap-3',
            student.hasCompletedPP ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
          )}
        >
          {student.hasCompletedPP ? (
            <CheckCircle size={20} className="text-emerald-600 shrink-0" />
          ) : (
            <ArrowRight size={20} className="text-red-600 shrink-0" />
          )}
          <p
            className={cn(
              'text-sm font-semibold',
              student.hasCompletedPP ? 'text-emerald-700' : 'text-red-700'
            )}
          >
            {student.hasCompletedPP
              ? 'You have successfully completed the Professional Practice.'
              : 'You have not completed the Professional Practice yet.'}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="w-24 h-24 bg-[#002B5B] rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-3xl text-white shadow-xl shadow-indigo-500/20">
                {student.fullName[0]}
              </div>
              <h2 className="text-xl font-bold text-slate-900">{student.fullName}</h2>
              <p className="text-slate-500 text-sm mb-6">{student.email}</p>
              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Study Year</div>
                  <div className="text-sm font-bold text-slate-900">{student.studyYear}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">CGPA</div>
                  <div className="text-sm font-bold text-slate-900">{student.cgpa}</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 p-6 rounded-2xl text-white">
              <h3 className="font-bold mb-4">Academic Info</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">University</div>
                  <div className="text-sm font-medium">{student.university}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Department</div>
                  <div className="text-sm font-medium">{student.departmentName || 'Not set'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Study Field</div>
                  <div className="text-sm font-medium">{student.studyFieldName || 'Not set'}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900">Extended Profile</h3>
                <button
                  onClick={() => setIsEditingProfile(true)}
                  suppressHydrationWarning
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-[#002B5B] rounded-xl text-sm font-bold hover:bg-indigo-50 transition-all"
                >
                  <Edit2 size={16} />
                  Edit Profile
                </button>
              </div>
              <div className="space-y-8">
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">About Me</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {student.extendedProfile?.description || 'No profile description added yet.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {(student.extendedProfile?.skills || []).map((skill) => (
                        <span key={skill} className="px-3 py-1 bg-[#002B5B]/10 text-[#002B5B] rounded-lg text-xs font-bold">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Languages</h4>
                    <div className="flex flex-wrap gap-2">
                      {(student.extendedProfile?.languages || []).map((lang) => (
                        <span key={lang} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Experience</h4>
                  <div className="space-y-3">
                    {(student.extendedProfile?.experience || []).map((exp, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <Briefcase size={16} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">{exp}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Hobbies</h4>
                  <div className="flex flex-wrap gap-2">
                    {(student.extendedProfile?.hobbies || []).length ? (
                      (student.extendedProfile?.hobbies || []).map((hobby) => (
                        <span key={hobby} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                          {hobby}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No hobbies added yet.</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">CV</h4>
                    {student.extendedProfile?.cvFile ? (
                      <button
                        onClick={() => {
                          void withAccessToken((accessToken) =>
                            downloadStudentProfileFile(
                              accessToken,
                              student.extendedProfile?.cvFile?.downloadUrl || '/api/student/profile/cv',
                              student.extendedProfile?.cvFile?.originalFilename || 'cv.pdf'
                            )
                          );
                        }}
                        className="px-4 py-3 bg-slate-50 text-[#002B5B] rounded-xl text-sm font-bold hover:bg-indigo-50 transition-all"
                      >
                        Download {student.extendedProfile.cvFile.originalFilename}
                      </button>
                    ) : (
                      <p className="text-sm text-slate-500">No CV uploaded.</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Certification Files</h4>
                    <div className="space-y-2">
                      {(student.extendedProfile?.certificationFiles || []).length ? (
                        (student.extendedProfile?.certificationFiles || []).map((file) => (
                          <button
                            key={file.certificationId ?? file.originalFilename}
                            onClick={() => {
                              void withAccessToken((accessToken) =>
                                downloadStudentProfileFile(
                                  accessToken,
                                  file.downloadUrl || `/api/student/profile/certifications/${file.certificationId}`,
                                  file.originalFilename
                                )
                              );
                            }}
                            className="w-full text-left px-4 py-3 bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-all"
                          >
                            {file.displayName || file.originalFilename}
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No certification files uploaded.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            {renderStats()}
            <div className="grid grid-cols-1 gap-8">
              {renderOpportunities()}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">{renderApplications()}</div>
                <div className="space-y-8">
                  <div className="bg-[#002B5B] p-6 rounded-2xl text-white shadow-xl shadow-indigo-500/20">
                    <h3 className="font-bold mb-2">Need Help?</h3>
                    <p className="text-indigo-100 text-xs mb-4">
                      Contact your PPA for guidance on Professional Practice applications.
                    </p>
                    <button suppressHydrationWarning className="w-full py-2.5 bg-white text-[#002B5B] rounded-xl text-xs font-bold hover:bg-indigo-50 transition-all">
                      Message PPA
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
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

  return (
    <Dashboard
      title=""
      userName={currentUserName}
      userRole={currentUserRoleLabel}
      onToggleSidebar={onToggleSidebar}
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
