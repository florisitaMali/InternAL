'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo, type MutableRefObject } from 'react';
import Image from 'next/image';
import Dashboard from './Dashboard';
import AddOpportunityForm from './AddOpportunityForm';
import CompanyProfileTabbedView from '@/src/components/CompanyProfileTabbedView';
import UnderDevelopment from './UnderDevelopment';
import NotificationsPanel from './NotificationsPanel';
import OpportunityRecordCard from '@/src/components/OpportunityRecordCard';
import CompanyOpportunityManageRow from '@/src/components/CompanyOpportunityManageRow';
import OpportunityDetailView from '@/src/components/OpportunityDetailView';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import {
  uploadCompanyProfilePhoto,
} from '@/src/lib/supabase/companyProfilePhotos';
import {
  fetchCompanyApplications,
  fetchCompanyProfile,
  fetchCompanyOpportunities,
  fetchCompanyOpportunityDetail,
  updateCompanyProfile,
  type CompanyProfileUpdatePayload,
} from '@/src/lib/auth/company';
import type { ApplicationResponse } from '@/src/lib/auth/opportunities';
import { getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import {
  createCompanyOpportunity,
  updateCompanyOpportunity,
  type CompanyOpportunityCreateBody,
} from '@/src/lib/auth/companyOpportunities';
import { useNotificationUnreadCount } from '@/src/lib/auth/useNotificationUnreadCount';
import { 
  Briefcase, 
  Building2,
  Building,
  Edit2,
  Plus, 
  Search, 
  Clock, 
  Calendar,
  MapPin,
  Users,
  Link as LinkIcon,
  Upload,
  X,
  Star,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  formatDeadline,
  formatOpportunityType,
  formatPostedDisplay,
} from '@/src/lib/opportunityFormat';
import { toast } from 'sonner';
import type { Application, CompanyProfileFromApi, Opportunity } from '@/src/types';

interface CompanyDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  onToggleSidebar?: () => void;
  onNavigateTab?: (tab: string) => void;
  accessToken?: string | null;
  accessTokenRef?: MutableRefObject<string | null>;
  linkedEntityId?: string | number | null;
}

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
  onToggleSidebar,
  onNavigateTab,
  accessTokenRef,
  linkedEntityId,
}) => {
  const { unreadCount, refresh: refreshUnreadNotifications } = useNotificationUnreadCount();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingOpportunity, setIsAddingOpportunity] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [profileSection, setProfileSection] = useState<'about' | 'opportunities'>('about');
  const [selectedOpportunityDetail, setSelectedOpportunityDetail] = useState<Opportunity | null>(null);
  const [selectedApplicationDetail, setSelectedApplicationDetail] = useState<Application | null>(null);
  const [detailOpenedFrom, setDetailOpenedFrom] = useState<'profile' | 'manage'>('profile');
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileFromApi | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [oppListLoading, setOppListLoading] = useState(false);
  const [isPublishingOpportunity, setIsPublishingOpportunity] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<CompanyProfileUpdatePayload>({});
  const [profileLogoFile, setProfileLogoFile] = useState<File | null>(null);
  const [profileCoverFile, setProfileCoverFile] = useState<File | null>(null);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [coverObjectUrl, setCoverObjectUrl] = useState<string | null>(null);
  /** Bumped after saving new logo/cover so <img> / CSS url() refetch even if the base path is unchanged. */
  const [profileMediaDisplayRev, setProfileMediaDisplayRev] = useState(0);
  const [companyApplications, setCompanyApplications] = useState<ApplicationResponse[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const isEditingProfileRef = useRef(isEditingProfile);
  isEditingProfileRef.current = isEditingProfile;

  useEffect(() => {
    if (!profileLogoFile) {
      setLogoObjectUrl(null);
      return;
    }
    const u = URL.createObjectURL(profileLogoFile);
    setLogoObjectUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [profileLogoFile]);

  useEffect(() => {
    if (!profileCoverFile) {
      setCoverObjectUrl(null);
      return;
    }
    const u = URL.createObjectURL(profileCoverFile);
    setCoverObjectUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [profileCoverFile]);

  const canEditProfile = useMemo(() => {
    if (!companyProfile || linkedEntityId == null) return false;
    return String(companyProfile.companyId) === String(linkedEntityId);
  }, [companyProfile, linkedEntityId]);

  const postedDisplayLabel = (opp: Opportunity) => {
    if (opp.draft === true) {
      return 'Draft — not posted. Students cannot see this listing yet.';
    }
    if (opp.postedLabel) return opp.postedLabel;
    if (opp.postedAt) return formatPostedDisplay(opp.postedAt);
    return '—';
  };

  const loadCompanyApplications = useCallback(async () => {
    setApplicationsLoading(true);
    try {
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        setApplicationsLoading(false);
        return;
      }
      const { data, errorMessage } = await fetchCompanyApplications(accessToken);
      if (errorMessage) {
        toast.error(errorMessage);
        setCompanyApplications([]);
      } else {
        setCompanyApplications(data || []);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load applications');
      setCompanyApplications([]);
    } finally {
      setApplicationsLoading(false);
    }
  }, []);

  const loadCompanyOpportunities = useCallback(async () => {
    setOppListLoading(true);
    try {
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        setOppListLoading(false);
        return;
      }
      const { data, errorMessage } = await fetchCompanyOpportunities(accessToken);
      if (errorMessage) {
        toast.error(errorMessage);
        setOppListLoading(false);
        return;
      }
      setOpportunities(data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load opportunities');
    } finally {
      setOppListLoading(false);
    }
  }, []);

  const handlePublishOpportunity = useCallback(
    async (opportunity: Opportunity) => {
      setIsPublishingOpportunity(true);
      try {
        const token = await getSessionAccessToken();
        if (!token) {
          toast.error('Not signed in. Refresh the page or sign in again.');
          return;
        }
        const { data, errorMessage } = await updateCompanyOpportunity(token, opportunity.id, {
          draft: false,
        });
        if (errorMessage || !data) {
          toast.error(errorMessage || 'Could not publish opportunity.');
          return;
        }
        setSelectedOpportunityDetail(data);
        await loadCompanyOpportunities();
        toast.success('Opportunity published. Students can now see this listing.');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not publish opportunity.');
      } finally {
        setIsPublishingOpportunity(false);
      }
    },
    [loadCompanyOpportunities]
  );

  const loadCompanyProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        setProfileLoading(false);
        return;
      }
      const { data, errorMessage } = await fetchCompanyProfile(accessToken);
      if (errorMessage) {
        toast.error(errorMessage);
        setProfileLoading(false);
        return;
      }
      setCompanyProfile(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load profile');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'profile' && !isEditingProfileRef.current) {
      void loadCompanyProfile();
    }
  }, [activeTab, loadCompanyProfile]);

  const closeEditProfileModal = useCallback(() => {
    setProfileLogoFile(null);
    setProfileCoverFile(null);
    setIsEditingProfile(false);
    if (activeTab === 'profile') {
      void loadCompanyProfile();
    }
  }, [activeTab, loadCompanyProfile]);

  useEffect(() => {
    if (!isEditingProfile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEditProfileModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditingProfile, closeEditProfileModal]);

  useEffect(() => {
    if (!isEditingProfile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isEditingProfile]);

  useEffect(() => {
    if (
      isEditingProfile &&
      (activeTab !== 'profile' || profileSection !== 'about')
    ) {
      setProfileLogoFile(null);
      setProfileCoverFile(null);
      setIsEditingProfile(false);
    }
  }, [activeTab, profileSection, isEditingProfile]);

  useEffect(() => {
    if (activeTab === 'profile' || activeTab === 'opportunities') {
      void loadCompanyOpportunities();
    }
  }, [activeTab, profileSection, loadCompanyOpportunities]);

  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'opportunities' || activeTab === 'applications') {
      void loadCompanyApplications();
    }
  }, [activeTab, loadCompanyApplications]);

  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'opportunities' || activeTab === 'applications') {
      void loadCompanyApplications();
    }
  }, [activeTab, loadCompanyApplications]);


  const openOpportunityDetail = async (opportunity: Opportunity, from: 'profile' | 'manage') => {
    setDetailOpenedFrom(from);
    try {
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        setSelectedOpportunityDetail(opportunity);
        return;
      }
      const { data, errorMessage } = await fetchCompanyOpportunityDetail(accessToken, opportunity.id);
      if (data) {
        setSelectedOpportunityDetail(data);
      } else {
        if (errorMessage) toast.error(errorMessage);
        setSelectedOpportunityDetail(opportunity);
      }
    } catch {
      setSelectedOpportunityDetail(opportunity);
    }
  };

  const beginEditProfile = () => {
    if (!companyProfile) return;
    setProfileLogoFile(null);
    setProfileCoverFile(null);
    setProfileDraft({
      name: companyProfile.name,
      location: companyProfile.location ?? '',
      description: companyProfile.description ?? '',
      website: companyProfile.website ?? '',
      industry: companyProfile.industry ?? '',
      employeeCount: companyProfile.employeeCount,
      foundedYear: companyProfile.foundedYear,
      specialties: companyProfile.specialties ?? '',
      logoUrl: companyProfile.logoUrl ?? '',
      coverUrl: companyProfile.coverUrl ?? '',
    });
    setIsEditingProfile(true);
  };

  const saveProfileEdit = async () => {
    if (!companyProfile) {
      toast.error('Profile not loaded');
      return;
    }
    try {
      const supabase = getSupabaseBrowserClient();
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        toast.error('Not signed in');
        return;
      }
      const cid = companyProfile.companyId;
      let logoUrl = profileDraft.logoUrl ?? '';
      let coverUrl = profileDraft.coverUrl ?? '';

      if (profileLogoFile) {
        const up = await uploadCompanyProfilePhoto(supabase, 'logo', cid, profileLogoFile);
        if (up.errorMessage || !up.publicUrl) {
          toast.error(up.errorMessage || 'Could not upload logo');
          return;
        }
        logoUrl = up.publicUrl;
      }
      if (profileCoverFile) {
        const up = await uploadCompanyProfilePhoto(supabase, 'cover', cid, profileCoverFile);
        if (up.errorMessage || !up.publicUrl) {
          toast.error(up.errorMessage || 'Could not upload cover image');
          return;
        }
        coverUrl = up.publicUrl;
      }

      const { data, errorMessage } = await updateCompanyProfile(accessToken, {
        ...profileDraft,
        logoUrl,
        coverUrl,
      });
      if (!data || errorMessage) {
        toast.error(errorMessage || 'Could not save profile');
        return;
      }
      const savedNewPhoto = profileLogoFile != null || profileCoverFile != null;
      setProfileLogoFile(null);
      setProfileCoverFile(null);
      if (savedNewPhoto) {
        setProfileMediaDisplayRev((r) => r + 1);
      }
      setCompanyProfile(data);
      setIsEditingProfile(false);
      toast.success('Profile updated');
      void loadCompanyProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save profile');
    }
  };

  const handleDecision = (studentName: string, decision: 'Approve' | 'Reject') => {
    toast.success(`${decision}d application for ${studentName}!`);
  };

  const formatApplicationTypeLabel = (t: string | null) => {
    if (!t) return '—';
    if (t === 'PROFESSIONAL_PRACTICE') return 'Professional Practice';
    if (t === 'INDIVIDUAL_GROWTH') return 'Individual Growth';
    return t.replace(/_/g, ' ');
  };

  const totalApplicants = companyApplications.length;
  const pendingCompany = companyApplications.filter((a) => a.isApprovedByCompany == null).length;
  const hiredCompany = companyApplications.filter((a) => a.isApprovedByCompany === true).length;

  const filteredCompanyApplications = companyApplications.filter((a) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    const hay = `${a.studentName ?? ''} ${a.opportunityTitle ?? ''}`.toLowerCase();
    return hay.includes(q);
  });

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
        { label: 'My Opportunities', value: opportunities.length, icon: Briefcase, color: 'bg-[#002B5B]' },
        { label: 'Total Applicants', value: totalApplicants, icon: Users, color: 'bg-blue-500' },
        { label: 'Pending Decisions', value: pendingCompany, icon: Clock, color: 'bg-amber-500' },
        { label: 'Hired Interns', value: hiredCompany, icon: CheckCircle, color: 'bg-emerald-500' },
      ].map((stat, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className={cn("p-3 rounded-xl text-white", stat.color)}>
              <stat.icon size={20} />
            </div>
            <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
        </div>
      ))}
    </div>
  );

  const opportunityForm = isAddingOpportunity ? (
    <AddOpportunityForm
      getAccessToken={async () => {
        const fromRef = accessTokenRef?.current?.trim();
        if (fromRef && fromRef.length > 20) return fromRef;
        return getSessionAccessToken();
      }}
      onSave={async (payload: CompanyOpportunityCreateBody) => {
        const fromRef = accessTokenRef?.current?.trim();
        const token =
          fromRef && fromRef.length > 20 ? fromRef : (await getSessionAccessToken());
        if (!token) {
          throw new Error('Not signed in. Refresh the page or sign in again.');
        }
        const { errorMessage } = await createCompanyOpportunity(token, payload);
        if (errorMessage) {
          throw new Error(errorMessage);
        }
        setIsAddingOpportunity(false);
        void loadCompanyOpportunities();
      }}
      onCancel={() => setIsAddingOpportunity(false)}
    />
  ) : null;

  /** Full “My Opportunities” experience from the sidebar (wireframe layout). */
  const renderSidebarOpportunitiesPage = () => {
    if (isAddingOpportunity) {
      return opportunityForm;
    }

    const companyApps: Application[] = [];
    const totalApplicants = companyApps.length;
    const pendingReview = companyApps.filter((a) => a.isApprovedByCompany === undefined).length;
    const hired = companyApps.filter((a) => a.isApprovedByCompany === true).length;

    const statCards = [
      {
        value: opportunities.length,
        label: 'Total Opportunities',
        sub: 'All Active',
        subClass: 'text-emerald-600 font-semibold',
        icon: Briefcase,
      },
      {
        value: totalApplicants,
        label: 'Total Applicants',
        sub: 'Across all jobs',
        subClass: 'text-slate-500',
        icon: Users,
      },
      {
        value: pendingCompany,
        label: 'Pending Review',
        sub: 'Awaiting decision',
        subClass: 'text-slate-500',
        icon: Clock,
      },
      {
        value: hiredCompany,
        label: 'Hired',
        sub: 'Successfully placed',
        subClass: 'text-slate-500',
        icon: Star,
      },
    ] as const;

    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0E2A50] md:text-4xl">My Opportunities</h1>
            <p className="mt-2 text-sm text-slate-500 md:text-base">
              Manage and track your internship opportunities
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingOpportunity(true)}
            suppressHydrationWarning
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#002B5B] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#001F42]"
          >
            <Plus size={18} strokeWidth={2.5} />
            Create New Opportunity
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                  <card.icon size={20} strokeWidth={2} />
                </div>
                <span className="text-3xl font-bold tabular-nums text-[#0E2A50]">{card.value}</span>
              </div>
              <p className="mt-4 text-sm font-bold text-slate-900">{card.label}</p>
              <p className={cn('mt-1 text-xs', card.subClass)}>{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {oppListLoading ? (
            <p className="text-sm text-slate-500">Loading opportunities…</p>
          ) : opportunities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-16 text-center">
              <p className="text-sm font-medium text-slate-600">No opportunities yet.</p>
              <p className="mt-1 text-xs text-slate-500">Create one with the button above to get started.</p>
            </div>
          ) : (
            opportunities.map((opp) => (
              <CompanyOpportunityManageRow
                key={opp.id}
                opportunity={opp}
                postedLabel={postedDisplayLabel(opp)}
                onViewApplications={() => onNavigateTab?.('applications')}
                onViewDetails={() => void openOpportunityDetail(opp, 'manage')}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  const renderApplications = () => {
    const q = searchTerm.trim().toLowerCase();
    const apps = ([] as Application[])
      .filter(
        (a) =>
          !q ||
          [a.studentName, a.studentEmail, a.opportunityTitle, a.opportunityDescription]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
      );

    const detail = selectedApplicationDetail;

    const appDetailDl = (label: string, value: string | null | undefined) => (
      <div key={label}>
        <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-slate-800 whitespace-pre-wrap">
          {value != null && String(value).trim() !== '' ? value : '—'}
        </dd>
      </div>
    );

    return (
      <>
        {detail ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
            onClick={() => setSelectedApplicationDetail(null)}
            role="presentation"
          >
            <div
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="application-detail-title"
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
                <div>
                  <h2 id="application-detail-title" className="text-lg font-bold text-[#0E2A50]">
                    Application details
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {detail.studentName} · {detail.opportunityTitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedApplicationDetail(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-8 p-6">
                <section>
                  <h3 className="text-sm font-bold text-slate-900">Applicant</h3>
                  <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {appDetailDl('Name', detail.studentName)}
                    {appDetailDl('Email', detail.studentEmail)}
                    {appDetailDl('Student ID', detail.studentId)}
                    {appDetailDl('Applied on', formatDeadline(detail.createdAt))}
                    {appDetailDl('Application type', detail.type.replaceAll('_', ' '))}
                    {appDetailDl(
                      'PPA approved',
                      detail.isApprovedByPPA === true
                        ? 'Yes'
                        : detail.isApprovedByPPA === false
                          ? 'No'
                          : '—'
                    )}
                    {appDetailDl(
                      'Company decision',
                      detail.isApprovedByCompany === true
                        ? 'Approved'
                        : detail.isApprovedByCompany === false
                          ? 'Rejected'
                          : 'Pending'
                    )}
                    {appDetailDl('Status', detail.status)}
                  </dl>
                </section>
                <section>
                  <h3 className="text-sm font-bold text-slate-900">Opportunity snapshot</h3>
                  <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {appDetailDl('Title', detail.opportunityTitle)}
                    {appDetailDl(
                      'Category',
                      detail.opportunityTypeLabel ?? formatOpportunityType(detail.type)
                    )}
                    {appDetailDl('Description', detail.opportunityDescription)}
                    {appDetailDl(
                      'Required skills',
                      detail.opportunityRequiredSkills?.length
                        ? detail.opportunityRequiredSkills.join(', ')
                        : undefined
                    )}
                    {appDetailDl(
                      'Application deadline',
                      detail.opportunityDeadline
                        ? formatDeadline(detail.opportunityDeadline)
                        : undefined
                    )}
                    {appDetailDl(
                      'Expected start',
                      detail.opportunityStartDate
                        ? formatDeadline(detail.opportunityStartDate)
                        : undefined
                    )}
                    {appDetailDl('Location', detail.opportunityLocation)}
                    {appDetailDl('Work mode', detail.opportunityWorkMode)}
                    {appDetailDl('Job type', detail.opportunityJobTypeLabel)}
                    {appDetailDl('Duration', detail.opportunityDurationLabel)}
                    {appDetailDl(
                      'Paid',
                      detail.opportunityIsPaid === true
                        ? 'Yes'
                        : detail.opportunityIsPaid === false
                          ? 'No'
                          : '—'
                    )}
                    {appDetailDl(
                      'Monthly salary',
                      detail.opportunityIsPaid === true && detail.opportunitySalaryMonthly != null
                        ? `${detail.opportunitySalaryMonthly.toLocaleString()} / month`
                        : '—'
                    )}
                  </dl>
                  {detail.opportunityNiceToHave?.trim() ? (
                    <div className="mt-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Additional notes (nice to have)
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {detail.opportunityNiceToHave}
                      </p>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        ) : null}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-900">Incoming Applications</h2>
            <div className="flex gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search applicants..."
                  suppressHydrationWarning
                  className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {apps.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-500">
                No applications match your search.
              </p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Applicant</th>
                    <th className="px-6 py-4">Opportunity</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {apps.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50 transition-all group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{app.studentName}</div>
                        <div className="text-xs text-slate-500">ID: {app.studentId}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-700">
                        {app.opportunityTitle}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider',
                            app.type === 'PROFESSIONAL_PRACTICE'
                              ? 'bg-[#002B5B]/10 text-[#002B5B]'
                              : 'bg-slate-100 text-slate-700'
                          )}
                        >
                          {app.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          {formatDeadline(app.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            suppressHydrationWarning
                            onClick={() => setSelectedApplicationDetail(app)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#0E2A50] hover:bg-slate-50"
                          >
                            <Eye size={14} />
                            View
                          </button>
                          {app.isApprovedByCompany === undefined ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleDecision(app.studentName, 'Approve')}
                                suppressHydrationWarning
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDecision(app.studentName, 'Reject')}
                                suppressHydrationWarning
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span
                              className={cn(
                                'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                                app.isApprovedByCompany === true
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-red-50 text-red-700'
                              )}
                            >
                              {app.isApprovedByCompany ? 'Approved' : 'Rejected'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </>
    );
  };


  const renderOpportunityDetail = (opportunity: Opportunity) => (
    <OpportunityDetailView
      variant="company"
      opportunity={opportunity}
      onBack={() => setSelectedOpportunityDetail(null)}
      onNavigateToApplications={() => {
        onNavigateTab?.('applications');
        setSelectedOpportunityDetail(null);
      }}
      isPublishingOpportunity={isPublishingOpportunity}
      onPublishOpportunity={handlePublishOpportunity}
    />
  );

  const renderEditProfileModal = () => {
    if (!isEditingProfile) return null;
    return (
      <div
        className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-10 sm:py-14 md:items-center md:py-8"
        role="presentation"
        onClick={closeEditProfileModal}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
          className="relative my-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <h3 id="edit-profile-title" className="text-xl font-bold text-slate-900 sm:text-2xl">
              Edit profile
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeEditProfileModal}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={closeEditProfileModal}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>
          </div>
          <div className="max-h-[min(85vh,calc(100vh-7rem))] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-700">Company name</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={profileDraft.name ?? ''}
                      onChange={(e) => setProfileDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-700">Headquarters / location</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={profileDraft.location ?? ''}
                      onChange={(e) => setProfileDraft((d) => ({ ...d, location: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="font-semibold text-slate-700">Overview / description</span>
                    <textarea
                      rows={4}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={profileDraft.description ?? ''}
                      onChange={(e) => setProfileDraft((d) => ({ ...d, description: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-700">Website</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={profileDraft.website ?? ''}
                      onChange={(e) => setProfileDraft((d) => ({ ...d, website: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-700">Industry</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={profileDraft.industry ?? ''}
                      onChange={(e) => setProfileDraft((d) => ({ ...d, industry: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-700">Number of employees</span>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={profileDraft.employeeCount ?? ''}
                      onChange={(e) =>
                        setProfileDraft((d) => ({
                          ...d,
                          employeeCount: e.target.value === '' ? null : Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-700">Founded year</span>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={profileDraft.foundedYear ?? ''}
                      onChange={(e) =>
                        setProfileDraft((d) => ({
                          ...d,
                          foundedYear: e.target.value === '' ? null : Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="font-semibold text-slate-700">Specialties</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={profileDraft.specialties ?? ''}
                      onChange={(e) => setProfileDraft((d) => ({ ...d, specialties: e.target.value }))}
                    />
                  </label>
                  <div className="block text-sm md:col-span-2">
                    <span className="font-semibold text-slate-700">Logo</span>
                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setProfileLogoFile(f);
                        e.target.value = '';
                      }}
                    />
                    <div className="mt-2 space-y-2">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {(logoObjectUrl || profileDraft.logoUrl)?.trim() ? (
                          <Image
                            src={logoObjectUrl || profileDraft.logoUrl || ''}
                            alt=""
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="80px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                            No logo
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Upload size={14} />
                          Upload logo
                        </button>
                        {(logoObjectUrl || profileDraft.logoUrl)?.trim() ? (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileLogoFile(null);
                              setProfileDraft((d) => ({ ...d, logoUrl: '' }));
                            }}
                            className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="block text-sm md:col-span-2">
                    <span className="font-semibold text-slate-700">Cover image</span>
                    <input
                      ref={coverFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setProfileCoverFile(f);
                        e.target.value = '';
                      }}
                    />
                    <div className="mt-2 space-y-2">
                      <div className="h-28 w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        {(coverObjectUrl || profileDraft.coverUrl)?.trim() ? (
                          <div
                            className="h-full w-full bg-cover bg-center"
                            style={{
                              backgroundImage: `url(${coverObjectUrl || profileDraft.coverUrl})`,
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                            No cover image
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => coverFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Upload size={14} />
                          Upload cover
                        </button>
                        {(coverObjectUrl || profileDraft.coverUrl)?.trim() ? (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileCoverFile(null);
                              setProfileDraft((d) => ({ ...d, coverUrl: '' }));
                            }}
                            className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void saveProfileEdit()}
                  className="rounded-xl bg-[#002B5B] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#001F42]"
                >
                  Save changes
                </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProfileOpportunitiesPanel = () => (
    <>
      <h3 className="text-3xl font-bold text-slate-900 mb-4">
        {opportunities.length} Opportunities Available
      </h3>
      <div className="space-y-3">
        {oppListLoading ? (
          <p className="text-sm text-slate-500">Loading opportunities…</p>
        ) : opportunities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center text-sm text-slate-500">
            You have not created any opportunities yet. Use <strong>My Opportunities</strong> in the sidebar to add one.
          </div>
        ) : (
          opportunities.map((opportunity) => (
            <OpportunityRecordCard
              key={opportunity.id}
              opportunity={opportunity}
              onViewDetails={() => void openOpportunityDetail(opportunity, 'profile')}
            />
          ))
        )}
      </div>
    </>
  );

  const renderCompanyProfile = () => (
    <>
      <CompanyProfileTabbedView
        profile={companyProfile}
        mediaRev={profileMediaDisplayRev}
        section={profileSection}
        onSectionChange={setProfileSection}
        canEditProfile={canEditProfile}
        onEditProfile={beginEditProfile}
        aboutLoading={profileLoading && !companyProfile && !isEditingProfile}
        opportunitiesPanel={renderProfileOpportunitiesPanel()}
      />
      {renderEditProfileModal()}
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'opportunities':
        if (selectedOpportunityDetail && detailOpenedFrom === 'manage') {
          return renderOpportunityDetail(selectedOpportunityDetail);
        }
        return renderSidebarOpportunitiesPage();
      case 'applications':
        return renderApplications();
      case 'profile':
        if (selectedOpportunityDetail && detailOpenedFrom === 'profile') {
          return renderOpportunityDetail(selectedOpportunityDetail);
        }
        return renderCompanyProfile();
      default:
        return <UnderDevelopment moduleName={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} />;
    }
  };

  return (
    <Dashboard
      title=""
      subtitle={null}
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
          className="max-w-none mx-0 h-full min-h-0 flex flex-col shadow-2xl ring-1 ring-slate-200/80"
        />
      )}
    >
      {renderContent()}
    </Dashboard>
  );
};

export default CompanyDashboard;
