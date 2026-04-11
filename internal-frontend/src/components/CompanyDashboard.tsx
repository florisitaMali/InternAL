'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Dashboard from './Dashboard';
import AddOpportunityForm from './AddOpportunityForm';
import UnderDevelopment from './UnderDevelopment';
import OpportunityRecordCard from '@/src/components/OpportunityRecordCard';
import CompanyOpportunityManageRow from '@/src/components/CompanyOpportunityManageRow';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import {
  profileImageDisplayUrl,
  uploadCompanyProfilePhoto,
} from '@/src/lib/supabase/companyProfilePhotos';
import {
  fetchCompanyProfile,
  fetchCompanyOpportunities,
  fetchCompanyOpportunityDetail,
  updateCompanyProfile,
  type CompanyProfileUpdatePayload,
} from '@/src/lib/auth/company';
import { getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import { mockCompanies, mockApplications } from '@/src/lib/mockData';
import { 
  Briefcase, 
  Building2, 
  Edit2,
  Plus, 
  Search, 
  CheckCircle, 
  Clock, 
  ArrowLeft,
  Calendar,
  Users,
  MapPin,
  Link as LinkIcon,
  Building,
  Upload,
  X,
  Star,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';
import type { CompanyProfileFromApi, Opportunity } from '@/src/types';

interface CompanyDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  onToggleSidebar?: () => void;
  onNavigateTab?: (tab: string) => void;
}

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
  onToggleSidebar,
  onNavigateTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingOpportunity, setIsAddingOpportunity] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [profileSection, setProfileSection] = useState<'about' | 'opportunities'>('about');
  const [selectedOpportunityDetail, setSelectedOpportunityDetail] = useState<Opportunity | null>(null);
  const [detailOpenedFrom, setDetailOpenedFrom] = useState<'profile' | 'manage' | 'dashboard'>('profile');
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileFromApi | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [oppListLoading, setOppListLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<CompanyProfileUpdatePayload>({});
  const [profileLogoFile, setProfileLogoFile] = useState<File | null>(null);
  const [profileCoverFile, setProfileCoverFile] = useState<File | null>(null);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [coverObjectUrl, setCoverObjectUrl] = useState<string | null>(null);
  /** Bumped after saving new logo/cover so <img> / CSS url() refetch even if the base path is unchanged. */
  const [profileMediaDisplayRev, setProfileMediaDisplayRev] = useState(0);
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

  const fallbackCompany = mockCompanies[0];
  const companyIdStr = companyProfile ? String(companyProfile.companyId) : fallbackCompany.id;
  const displayName = companyProfile?.name ?? fallbackCompany.name;
  const displayIndustry = companyProfile?.industry ?? fallbackCompany.industry;
  const displayDescription = companyProfile?.description ?? fallbackCompany.description;

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
    if (activeTab === 'profile' || activeTab === 'dashboard' || activeTab === 'opportunities') {
      void loadCompanyOpportunities();
    }
  }, [activeTab, profileSection, loadCompanyOpportunities]);

  const openOpportunityDetail = async (opportunity: Opportunity, from: 'profile' | 'manage' | 'dashboard') => {
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

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
        { label: 'My Opportunities', value: opportunities.length, icon: Briefcase, color: 'bg-[#002B5B]' },
        { label: 'Total Applicants', value: mockApplications.filter(a => a.companyId === fallbackCompany.id).length, icon: Users, color: 'bg-blue-500' },
        { label: 'Pending Decisions', value: mockApplications.filter(a => a.companyId === fallbackCompany.id && a.isApprovedByCompany === undefined).length, icon: Clock, color: 'bg-amber-500' },
        { label: 'Hired Interns', value: mockApplications.filter(a => a.companyId === fallbackCompany.id && a.isApprovedByCompany === true).length, icon: CheckCircle, color: 'bg-emerald-500' },
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
      companyId={companyIdStr}
      companyName={displayName}
      onSave={() => {
        setIsAddingOpportunity(false);
        void loadCompanyOpportunities();
      }}
      onCancel={() => setIsAddingOpportunity(false)}
    />
  ) : null;

  /** Compact list for the dashboard column (unchanged behavior). */
  const renderOpportunitiesEmbedded = () => {
    if (isAddingOpportunity) {
      return opportunityForm;
    }

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900">My Internship Opportunities</h2>
          <button
            onClick={() => setIsAddingOpportunity(true)}
            suppressHydrationWarning
            className="flex items-center gap-2 px-4 py-2 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#001F42] transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} />
            Create New
          </button>
        </div>
        <div className="p-6 space-y-3">
          {oppListLoading ? (
            <p className="text-sm text-slate-500">Loading opportunities…</p>
          ) : opportunities.length === 0 ? (
            <p className="text-sm text-slate-500">No opportunities yet. Create one to get started.</p>
          ) : (
            opportunities.map((opp) => (
              <OpportunityRecordCard
                key={opp.id}
                opportunity={opp}
                onViewDetails={() => void openOpportunityDetail(opp, 'dashboard')}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  /** Full “My Opportunities” experience from the sidebar (wireframe layout). */
  const renderSidebarOpportunitiesPage = () => {
    if (isAddingOpportunity) {
      return opportunityForm;
    }

    const companyApps = mockApplications.filter((a) => String(a.companyId) === String(companyIdStr));
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
        value: pendingReview,
        label: 'Pending Review',
        sub: 'Awaiting decision',
        subClass: 'text-slate-500',
        icon: Clock,
      },
      {
        value: hired,
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
                postedLabel={postedDisplay(opp)}
                onViewApplications={() => onNavigateTab?.('applications')}
                onViewDetails={() => void openOpportunityDetail(opp, 'manage')}
                onEdit={() => toast.info('Edit opportunity will be available soon.')}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  const renderApplications = () => (
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
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <th className="px-6 py-4">Applicant</th>
              <th className="px-6 py-4">Opportunity</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockApplications.filter(a => a.companyId === fallbackCompany.id).map((app) => (
              <tr key={app.id} className="hover:bg-slate-50 transition-all group">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{app.studentName}</div>
                  <div className="text-xs text-slate-500">ID: {app.studentId}</div>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-700">{app.opportunityTitle}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                    app.type === 'PROFESSIONAL_PRACTICE' ? "bg-[#002B5B]/10 text-[#002B5B]" : "bg-slate-100 text-slate-700"
                  )}>
                    {app.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" />
                    {app.createdAt}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  {app.isApprovedByCompany === undefined ? (
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleDecision(app.studentName, 'Approve')}
                        suppressHydrationWarning
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleDecision(app.studentName, 'Reject')}
                        suppressHydrationWarning
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      app.isApprovedByCompany === true ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    )}>
                      {app.isApprovedByCompany ? "Approved" : "Rejected"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );


  const defaultApplicationStats = { total: 0, inReview: 0, approved: 0, rejected: 0 };

  const postedDisplay = (opp: Opportunity) => {
    if (opp.postedLabel) return opp.postedLabel;
    if (opp.postedAt) {
      try {
        return `Posted ${new Date(opp.postedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
      } catch {
        return '—';
      }
    }
    return '—';
  };

  const renderOpportunityDetail = (opportunity: Opportunity) => {
    const stats = opportunity.applicationStats ?? defaultApplicationStats;
    const jobType = opportunity.jobTypeLabel ?? opportunity.type ?? '—';
    const duration = opportunity.durationLabel ?? '—';
    const location = opportunity.location ?? '—';
    const workMode = opportunity.workMode ?? '—';
    const startDate = opportunity.startDateLabel ?? '—';

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setSelectedOpportunityDetail(null)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#0E2A50] hover:text-[#002B5B]"
        >
          <ArrowLeft size={18} />
          Back to Opportunities
        </button>

        <div className="bg-white rounded-xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-1 flex-col gap-4 min-w-0 sm:flex-row sm:items-start">
              <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-[#002B5B]" />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-[#0E2A50]">{opportunity.title}</h1>
                <p className="mt-1 text-sm text-slate-500">{opportunity.companyName}</p>
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
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  onNavigateTab?.('applications');
                  setSelectedOpportunityDetail(null);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#002B5B] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#001F42]"
              >
                <Users size={18} />
                View Applications ({stats.total})
              </button>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => toast.info('Edit opportunity will be available when connected to the backend.')}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[#0E2A50] hover:bg-slate-50"
              >
                Edit Opportunity
              </button>
              <p className="text-right text-xs text-slate-400">{postedDisplay(opportunity)}</p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
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
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                <h3 className="text-base font-bold text-slate-900">Overview</h3>
                <dl className="mt-4 space-y-3">
                  {[
                    ['JOB TYPE', jobType],
                    ['DURATION', duration],
                    ['LOCATION', location],
                    ['WORK MODE', workMode],
                    ['START DATE', startDate],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</dt>
                      <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

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
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompanyInfoCard = () => {
    const website = companyProfile?.website;
    const employees =
      companyProfile?.employeeCount != null ? String(companyProfile.employeeCount) : '—';
    const hq = companyProfile?.location ?? '—';
    const founded = companyProfile?.foundedYear != null ? String(companyProfile.foundedYear) : '—';
    const specialties = companyProfile?.specialties ?? '—';
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-5">Company Info</h3>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Website</p>
            {website ? (
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#002B5B] font-medium hover:underline break-all"
              >
                {website}
              </a>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Industry</p>
            <p className="text-sm text-slate-700 font-medium">{displayIndustry || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Number of Employees</p>
            <p className="text-sm text-slate-700 font-medium">{employees}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Headquarters</p>
            <p className="text-sm text-slate-700 font-medium">{hq}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Founded</p>
            <p className="text-sm text-slate-700 font-medium">{founded}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Specialties</p>
            <p className="text-sm text-slate-700 font-medium">{specialties}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderProfileAbout = () => {
    if (profileLoading && !companyProfile && !isEditingProfile) {
      return (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading company profile…
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mt-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h3 className="text-2xl font-bold text-slate-900">About</h3>
            <button
              type="button"
              onClick={beginEditProfile}
              disabled={!companyProfile}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-[#0E2A50] hover:bg-slate-50 disabled:opacity-50"
            >
              <Edit2 size={16} />
              Edit profile
            </button>
          </div>
          <p className="text-sm text-slate-600 leading-7 whitespace-pre-wrap">
            {displayDescription?.trim() ? displayDescription : 'No overview yet. Click Edit profile to add one.'}
          </p>
        </div>
        {renderCompanyInfoCard()}
      </div>
    );
  };

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
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {(logoObjectUrl || profileDraft.logoUrl)?.trim() ? (
                          <img
                            src={logoObjectUrl || profileDraft.logoUrl || ''}
                            alt=""
                            className="h-full w-full object-cover"
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

  const renderProfileOpportunities = () => (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mt-6">
      <div>
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
      </div>
      {renderCompanyInfoCard()}
    </div>
  );

  const renderCompanyProfile = () => (
    <>
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {companyProfile?.coverUrl ? (
          <div
            className="h-44 w-full bg-cover bg-center"
            style={{
              backgroundImage: `url(${JSON.stringify(profileImageDisplayUrl(companyProfile.coverUrl, profileMediaDisplayRev))})`,
            }}
          />
        ) : (
          <div className="h-44 bg-gradient-to-r from-[#003A83] to-[#00A7A0]" />
        )}
        <div className="px-6 pb-3">
          {companyProfile?.logoUrl ? (
            <img
              key={`${companyProfile.logoUrl}-${profileMediaDisplayRev}`}
              src={profileImageDisplayUrl(companyProfile.logoUrl, profileMediaDisplayRev)}
              alt=""
              className="-mt-14 h-24 w-24 rounded-xl border-4 border-white object-cover shadow-sm bg-white"
            />
          ) : (
            <div className="-mt-14 h-24 w-24 rounded-xl border-4 border-white bg-slate-100 shadow-sm" />
          )}
          <div className="mt-3">
            <h2 className="text-4xl font-bold text-[#0E2A50] leading-tight">{displayName}</h2>
            <p className="text-slate-500 text-sm mt-1 line-clamp-2">
              {companyProfile?.description?.trim()
                ? companyProfile.description.split('\n')[0].slice(0, 160)
                : 'Add an overview in the About section.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-3">
              <span className="flex items-center gap-1.5">
                <MapPin size={13} />
                {companyProfile?.location ?? '—'}
              </span>
              <span className="flex items-center gap-1.5">
                <Building size={13} />
                {companyProfile?.employeeCount != null ? `${companyProfile.employeeCount} employees` : '—'}
              </span>
              <span className="flex items-center gap-1.5">
                <LinkIcon size={13} />
                {companyProfile?.website ?? '—'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-5 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setProfileSection('about')}
              className={cn(
                'pb-2 text-sm font-semibold border-b-2 transition-colors',
                profileSection === 'about'
                  ? 'text-[#0E2A50] border-[#0E2A50]'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              )}
            >
              About
            </button>
            <button
              type="button"
              onClick={() => setProfileSection('opportunities')}
              className={cn(
                'pb-2 text-sm font-semibold border-b-2 transition-colors',
                profileSection === 'opportunities'
                  ? 'text-[#0E2A50] border-[#0E2A50]'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              )}
            >
              Opportunities
            </button>
          </div>
        </div>
      </div>
      {profileSection === 'about' ? renderProfileAbout() : renderProfileOpportunities()}
    </div>
    {renderEditProfileModal()}
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        if (selectedOpportunityDetail && detailOpenedFrom === 'dashboard') {
          return renderOpportunityDetail(selectedOpportunityDetail);
        }
        return (
          <>
            {renderStats()}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                {renderApplications()}
              </div>
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Building2 size={18} className="text-[#002B5B]" />
                    Company Profile
                  </h3>
                  <div className="space-y-4">
                    <div className="text-sm font-bold text-slate-900">{displayName}</div>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{displayDescription}</p>
                    <div className="pt-4 border-t border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Industry</div>
                      <div className="text-xs font-bold text-slate-700">{displayIndustry}</div>
                    </div>
                  </div>
                </div>
                {renderOpportunitiesEmbedded()}
              </div>
            </div>
          </>
        );
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
    >
      {renderContent()}
    </Dashboard>
  );
};

export default CompanyDashboard;
