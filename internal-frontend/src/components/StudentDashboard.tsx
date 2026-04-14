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
import { mockApplications, mockStudents } from '@/src/lib/mockData';
import {
  Briefcase,
  Calendar,
  ChevronRight,
  FileText,
  Filter,
  Search,
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
import { fetchStudentOpportunities, type StudentOpportunityFilters } from '@/src/lib/auth/opportunities';
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
};

const EMPTY_FILTERS: OpportunityFilterState = {
  q: '',
  type: '',
  location: '',
  skills: [],
};

const typeOptions = [
  { value: '', label: 'All types' },
  { value: 'PROFESSIONAL_PRACTICE', label: 'Professional Practice' },
  { value: 'INDIVIDUAL_GROWTH', label: 'Individual Growth' },
];

function buildOpportunityFilters(filters: OpportunityFilterState): StudentOpportunityFilters {
  return {
    q: filters.q || undefined,
    type: filters.type || undefined,
    location: filters.location || undefined,
    skills: filters.skills.length ? filters.skills : undefined,
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
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);
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

  const availableSkillOptions = useMemo(() => {
    const ownSkills = student.extendedProfile?.skills || [];
    const requiredSkills = opportunities.flatMap((opportunity) => opportunity.requiredSkills || []);
    return Array.from(new Set([...ownSkills, ...requiredSkills])).sort((a, b) => a.localeCompare(b));
  }, [opportunities, student.extendedProfile?.skills]);

  const handleApply = (opportunityTitle: string) => {
    toast.info(`Application flow for ${opportunityTitle} is not wired to a backend endpoint yet.`);
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Filters</h3>
          <p className="text-sm text-slate-500">Refine your matched opportunities.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpportunityFilters(EMPTY_FILTERS)}
          className="text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          Reset
        </button>
      </div>

      <label className="block">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Type</span>
        <select
          value={opportunityFilters.type}
          onChange={(e) => setOpportunityFilters((prev) => ({ ...prev, type: e.target.value }))}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-[#002B5B]"
        >
          {typeOptions.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Location</span>
        <input
          type="text"
          value={opportunityFilters.location}
          onChange={(e) => setOpportunityFilters((prev) => ({ ...prev, location: e.target.value }))}
          placeholder="City, country, or remote"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-[#002B5B]"
        />
      </label>

      <div className="space-y-3">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Required Skills</span>
          <p className="text-sm text-slate-500 mt-1">Filter within your matched opportunities by specific skills.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={skillFilterInput}
            onChange={(e) => setSkillFilterInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSkillFilter(skillFilterInput);
              }
            }}
            placeholder="Add a skill"
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-[#002B5B]"
          />
          <button
            type="button"
            onClick={() => addSkillFilter(skillFilterInput)}
            className="px-4 py-3 rounded-xl bg-[#002B5B] text-sm font-bold text-white hover:bg-[#001F42]"
          >
            Add
          </button>
        </div>
        {!!availableSkillOptions.length && (
          <div className="flex flex-wrap gap-2">
            {availableSkillOptions.slice(0, 12).map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => addSkillFilter(skill)}
                className="px-3 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                {skill}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {opportunityFilters.skills.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => removeSkillFilter(skill)}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#002B5B]/10 text-xs font-bold text-[#002B5B]"
            >
              {skill}
              <X size={12} />
            </button>
          ))}
        </div>
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
              onClick={() => handleApply(selectedOpportunity.title)}
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
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Available Opportunities</h2>
          <p className="text-sm text-slate-500 mt-1">
            Opportunities available to your university, sorted by how well they match your skills.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search title, company, skill..."
              suppressHydrationWarning
              className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none w-full sm:w-80"
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
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      <div className={cn('grid grid-cols-1 gap-6 items-start', showFilters && 'xl:grid-cols-[300px_minmax(0,1fr)]')}>
        {showFilters ? renderFilterPanel() : null}

        <div className="space-y-6">
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
            <div className="space-y-3">
              {opportunities.map((opp) => (
                <OpportunityRecordCard
                  key={opp.id}
                  opportunity={opp}
                  onViewDetails={() => setSelectedOpportunity(opp)}
                  showApply
                  onApply={() => handleApply(opp.title)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

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
      title={`Hello, ${currentUserName}`}
      userName={currentUserName}
      userRole={currentUserRoleLabel}
      onToggleSidebar={onToggleSidebar}
      topBarVariant={profileBrowseMode ? 'brand' : 'default'}
      hidePageIntro={profileBrowseMode}
    >
      {renderContent()}
    </Dashboard>
  );
};

export default StudentDashboard;
