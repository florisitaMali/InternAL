'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo, type MutableRefObject, type ReactNode } from 'react';
import Image from 'next/image';
import Dashboard from './Dashboard';
import AddOpportunityForm from './AddOpportunityForm';
import CompanyProfileTabbedView from '@/src/components/CompanyProfileTabbedView';
import UniversityProfileReadOnlyView from '@/src/components/UniversityProfileReadOnlyView';
import UnderDevelopment from './UnderDevelopment';
import NotificationsPanel from './NotificationsPanel';
import OpportunityRecordCard from '@/src/components/OpportunityRecordCard';
import CompanyOpportunityManageRow from '@/src/components/CompanyOpportunityManageRow';
import OpportunityDetailView from '@/src/components/OpportunityDetailView';
import SubmitApplicationModal from './SubmitApplicationModal';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import {
  uploadCompanyProfilePhoto,
} from '@/src/lib/supabase/companyProfilePhotos';
import {
  approveCompanyApplication,
  fetchCompanyApplications,
  fetchCompanyProfile,
  fetchCompanyOpportunities,
  fetchCompanyOpportunityDetail,
  fetchCompanyStudentProfile,
  rejectCompanyApplication,
  updateCompanyProfile,
  type CompanyProfileUpdatePayload,
} from '@/src/lib/auth/company';
import type { ApplicationResponse } from '@/src/lib/auth/opportunities';
import {
  downloadStudentProfileFile,
  fetchStudentProfileBlob,
  mapStudentProfileToStudent,
} from '@/src/lib/auth/userAccount';
import StudentProfileView from '@/src/components/StudentProfileView';
import { getAccessTokenForMutatingApi, getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import {
  deleteCompanyPartnership,
  fetchCompanyPartnershipUniversities,
  fetchCompanyPartnershipUniversityProfile,
  postCompanyPartnershipRequest,
  postCompanyPartnershipRespond,
  type InstitutionalPartnershipUniversityRow,
} from '@/src/lib/auth/partnerships';
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
  MoreVertical,
  Download,
  GraduationCap,
  User as UserIcon,
  FileText,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  formatDeadline,
  formatDbDuration,
  formatDbWorkType,
  formatOpportunityType,
  formatPostedDisplay,
} from '@/src/lib/opportunityFormat';
import { toast } from 'sonner';
import type { Application, CompanyProfileFromApi, Opportunity, Student, UniversityProfileFromApi } from '@/src/types';

interface CompanyDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  onToggleSidebar?: () => void;
  onNavigateTab?: (tab: string) => void;
  onCloseSidebar?: () => void;
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
  onCloseSidebar,
  accessTokenRef,
  linkedEntityId,
}) => {
  const { unreadCount, refresh: refreshUnreadNotifications } = useNotificationUnreadCount();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingOpportunity, setIsAddingOpportunity] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [profileSection, setProfileSection] = useState<'about' | 'opportunities'>('about');
  const [selectedOpportunityDetail, setSelectedOpportunityDetail] = useState<Opportunity | null>(null);
  const [selectedApplicationDetail, setSelectedApplicationDetail] = useState<ApplicationResponse | null>(null);
  const [applicationListingDetail, setApplicationListingDetail] = useState<Opportunity | null>(null);
  const [applicationListingDetailLoading, setApplicationListingDetailLoading] = useState(false);
  const [selectedStudentProfile, setSelectedStudentProfile] = useState<ApplicationResponse | null>(null);
  const [studentProfileLoading, setStudentProfileLoading] = useState(false);
  const [studentProfileLoaded, setStudentProfileLoaded] = useState<Student | null>(null);
  const [studentProfileError, setStudentProfileError] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<{
    application: ApplicationResponse;
    top: number;
    right: number;
  } | null>(null);
  const [applicationsFilterOpportunityId, setApplicationsFilterOpportunityId] = useState<number | null>(null);
  const [applicationsFilterOpportunityTitle, setApplicationsFilterOpportunityTitle] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{ application: ApplicationResponse; approved: boolean } | null>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);
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
  const [partnershipUniversities, setPartnershipUniversities] = useState<InstitutionalPartnershipUniversityRow[]>(
    []
  );
  const [partnershipUniversitiesLoading, setPartnershipUniversitiesLoading] = useState(false);
  const [partnershipFilter, setPartnershipFilter] = useState<'all' | 'collaborators' | 'non'>('all');
  const [partnershipSearch, setPartnershipSearch] = useState('');
  const [partnershipRowBusyId, setPartnershipRowBusyId] = useState<number | null>(null);
  const [partnershipUniversityBrowseId, setPartnershipUniversityBrowseId] = useState<number | null>(null);
  const [partnershipUniversityBrowseProfile, setPartnershipUniversityBrowseProfile] =
    useState<UniversityProfileFromApi | null>(null);
  const [partnershipUniversityBrowseLoading, setPartnershipUniversityBrowseLoading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const isEditingProfileRef = useRef(isEditingProfile);
  isEditingProfileRef.current = isEditingProfile;

  useEffect(() => {
    if (selectedApplicationDetail || isEditingProfile || selectedStudentProfile || pendingDecision) {
      onCloseSidebar?.();
    }
  }, [selectedApplicationDetail, isEditingProfile, selectedStudentProfile, pendingDecision, onCloseSidebar]);

  useEffect(() => {
    const oid = selectedApplicationDetail?.opportunityId;
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
        const accessToken = await getSessionAccessToken();
        if (!accessToken || cancelled) return;
        const { data, errorMessage } = await fetchCompanyOpportunityDetail(accessToken, String(oid));
        if (cancelled) return;
        if (data) {
          setApplicationListingDetail(data);
        } else {
          toast.error(errorMessage || 'Could not load opportunity details.');
        }
      } catch {
        if (!cancelled) toast.error('Could not load opportunity details.');
      } finally {
        if (!cancelled) setApplicationListingDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedApplicationDetail?.opportunityId, selectedApplicationDetail?.applicationId]);

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

  const filteredPartnershipUniversities = useMemo(() => {
    const q = partnershipSearch.trim().toLowerCase();
    let list = partnershipUniversities;
    if (partnershipFilter === 'collaborators') {
      list = list.filter((r) => r.status === 'APPROVED');
    } else if (partnershipFilter === 'non') {
      list = list.filter((r) => r.status !== 'APPROVED');
    }
    if (q) {
      list = list.filter((r) => r.universityName.toLowerCase().includes(q));
    }
    return list;
  }, [partnershipUniversities, partnershipFilter, partnershipSearch]);

  const postedDisplayLabel = (opp: Opportunity) => {
    if (opp.draft === true) {
      return 'Draft ΓÇö not posted. Students cannot see this listing yet.';
    }
    if (opp.postedLabel) return opp.postedLabel;
    if (opp.postedAt) return formatPostedDisplay(opp.postedAt);
    return 'ΓÇö';
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

  const getPartnershipAccessToken = useCallback(async () => {
    const fromRef = accessTokenRef?.current?.trim();
    if (fromRef && fromRef.length > 20) return fromRef;
    let t = await getSessionAccessToken();
    if (t) return t;
    t = await getAccessTokenForMutatingApi();
    if (t) return t;
    const refAgain = accessTokenRef?.current?.trim();
    return refAgain && refAgain.length > 0 ? refAgain : null;
  }, [accessTokenRef]);

  const loadPartnershipUniversities = useCallback(async () => {
    setPartnershipUniversitiesLoading(true);
    try {
      const token = await getPartnershipAccessToken();
      if (!token) {
        toast.error('Not signed in.');
        return;
      }
      const { data, errorMessage } = await fetchCompanyPartnershipUniversities(token);
      if (errorMessage) {
        toast.error(errorMessage);
        return;
      }
      setPartnershipUniversities(data ?? []);
    } finally {
      setPartnershipUniversitiesLoading(false);
    }
  }, [getPartnershipAccessToken]);

  useEffect(() => {
    if (activeTab === 'universities') {
      void loadPartnershipUniversities();
    } else {
      setPartnershipUniversityBrowseId(null);
      setPartnershipUniversityBrowseProfile(null);
      setPartnershipUniversityBrowseLoading(false);
    }
  }, [activeTab, loadPartnershipUniversities]);

  const openPartnershipUniversityProfile = useCallback(
    async (universityId: number) => {
      setPartnershipUniversityBrowseId(universityId);
      setPartnershipUniversityBrowseProfile(null);
      setPartnershipUniversityBrowseLoading(true);
      try {
        const token = await getPartnershipAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const { data, errorMessage } = await fetchCompanyPartnershipUniversityProfile(token, universityId);
        if (errorMessage) {
          toast.error(errorMessage);
        } else {
          setPartnershipUniversityBrowseProfile(data);
        }
      } finally {
        setPartnershipUniversityBrowseLoading(false);
      }
    },
    [getPartnershipAccessToken]
  );

  const closePartnershipUniversityProfile = useCallback(() => {
    setPartnershipUniversityBrowseId(null);
    setPartnershipUniversityBrowseProfile(null);
  }, []);

  const handlePartnershipRequest = useCallback(
    async (universityId: number) => {
      setPartnershipRowBusyId(universityId);
      try {
        const token = await getPartnershipAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const { errorMessage } = await postCompanyPartnershipRequest(token, universityId);
        if (errorMessage) {
          toast.error(errorMessage);
        } else {
          toast.success('Collaboration request sent.');
          await loadPartnershipUniversities();
          void refreshUnreadNotifications();
        }
      } finally {
        setPartnershipRowBusyId(null);
      }
    },
    [getPartnershipAccessToken, loadPartnershipUniversities, refreshUnreadNotifications]
  );

  const handlePartnershipRespond = useCallback(
    async (universityId: number, approve: boolean) => {
      setPartnershipRowBusyId(universityId);
      try {
        const token = await getPartnershipAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const { errorMessage } = await postCompanyPartnershipRespond(token, universityId, approve);
        if (errorMessage) {
          toast.error(errorMessage);
        } else {
          toast.success(approve ? 'Collaboration accepted.' : 'Collaboration declined.');
          await loadPartnershipUniversities();
          void refreshUnreadNotifications();
        }
      } finally {
        setPartnershipRowBusyId(null);
      }
    },
    [getPartnershipAccessToken, loadPartnershipUniversities, refreshUnreadNotifications]
  );

  const handlePartnershipEnd = useCallback(
    async (universityId: number) => {
      setPartnershipRowBusyId(universityId);
      try {
        const token = await getPartnershipAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const { errorMessage } = await deleteCompanyPartnership(token, universityId);
        if (errorMessage) {
          toast.error(errorMessage);
        } else {
          toast.success('Institutional collaboration ended.');
          await loadPartnershipUniversities();
          void refreshUnreadNotifications();
        }
      } finally {
        setPartnershipRowBusyId(null);
      }
    },
    [getPartnershipAccessToken, loadPartnershipUniversities, refreshUnreadNotifications]
  );

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

  // Load the full read-only profile when the company opens the student-profile modal.
  useEffect(() => {
    if (!selectedStudentProfile?.studentId) {
      setStudentProfileLoaded(null);
      setStudentProfileError(null);
      return;
    }
    let cancelled = false;
    const studentId = selectedStudentProfile.studentId;
    setStudentProfileLoading(true);
    setStudentProfileError(null);
    setStudentProfileLoaded(null);
    void (async () => {
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        if (!cancelled) {
          setStudentProfileError('Not signed in.');
          setStudentProfileLoading(false);
        }
        return;
      }
      const { data, errorMessage } = await fetchCompanyStudentProfile(accessToken, studentId);
      if (cancelled) return;
      if (errorMessage) {
        setStudentProfileError(errorMessage);
      } else if (data) {
        setStudentProfileLoaded(mapStudentProfileToStudent(data));
      }
      setStudentProfileLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStudentProfile]);


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

  const openOpportunityFromNotification = useCallback(
    async (opportunityId: number) => {
      onNavigateTab?.('opportunities');
      setDetailOpenedFrom('manage');
      setSelectedOpportunityDetail(null);
      try {
        const accessToken = await getSessionAccessToken();
        if (!accessToken) {
          toast.error('Not signed in.');
          return;
        }
        const { data, errorMessage } = await fetchCompanyOpportunityDetail(
          accessToken,
          String(opportunityId)
        );
        if (data) {
          setSelectedOpportunityDetail(data);
        } else if (errorMessage) {
          toast.error(errorMessage);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not load opportunity.');
      }
    },
    [onNavigateTab]
  );

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

  const executeDecision = async (application: ApplicationResponse, approved: boolean) => {
    if (application.applicationId == null) return;
    const id = application.applicationId;
    setDecidingId(id);
    try {
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        toast.error('Not signed in. Refresh the page or sign in again.');
        return;
      }
      const { errorMessage } = approved
        ? await approveCompanyApplication(accessToken, id)
        : await rejectCompanyApplication(accessToken, id);
      if (errorMessage) {
        toast.error(errorMessage);
        return;
      }
      toast.success(approved ? 'Application approved' : 'Application rejected');
      await loadCompanyApplications();
    } finally {
      setDecidingId(null);
      setPendingDecision(null);
    }
  };

  const formatApplicationTypeLabel = (t: string | null) => {
    if (!t) return 'ΓÇö';
    if (t === 'PROFESSIONAL_PRACTICE') return 'Professional Practice';
    if (t === 'INDIVIDUAL_GROWTH') return 'Individual Growth';
    return t.replace(/_/g, ' ');
  };

  const studentPropsFromCompanyApplication = (api: ApplicationResponse) => ({
    fullName: api.studentName?.trim() || '—',
    email: api.studentEmail?.trim() || '—',
    university: api.studentUniversityName?.trim() || '—',
    department: (api.studentDepartmentName ?? api.studentFacultyName)?.trim() || '',
    studyField: (api.studentStudyFieldName ?? api.studentFieldName)?.trim() || '',
    studyYear: api.studentStudyYear ?? 1,
    cgpa: api.studentCgpa ?? 0,
    cvFileName: api.studentCvFilename?.trim() || 'No CV uploaded',
  });

  const renderCompanyApplicationListingDetails = (): ReactNode => {
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
    const hasCollaborationTargets = (opp.targetUniversities?.length ?? 0) > 0;
    const overviewItems: [string, string][] = [
      ...(hasCollaborationTargets
        ? []
        : ([
            [
              'Target universities',
              opp.targetUniversities?.map((u) => u.name).join(', ') || 'All universities',
            ],
          ] as [string, string][])),
      ['Application deadline', formatDeadline(opp.deadline)],
      ['Start date', formatDeadline(opp.startDate)],
      ['Positions', opp.positionCount != null ? String(opp.positionCount) : '—'],
    ];

    return (
      <div>
        <h4 className="text-base font-bold text-slate-950">Opportunity</h4>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <div className="mt-1 h-12 w-12 shrink-0 rounded-xl bg-[#002B5B]" aria-hidden />
              <div className="min-w-0">
                <h5 className="text-xl font-bold text-[#0E2A50]">{opp.title}</h5>
                <div className="mt-0.5 text-sm font-semibold text-slate-700">{opp.companyName ?? '—'}</div>
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
                  <p className="mt-0.5 text-sm font-semibold text-slate-700">{value || '—'}</p>
                </div>
              ))}
              {hasCollaborationTargets ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    University collaboration
                  </p>
                  <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/90 p-2">
                    {(opp.targetUniversities ?? []).map((t) => {
                      const raw = (t.collaborationStatus ?? '').trim().toUpperCase();
                      const statusLabel =
                        raw === 'APPROVED' ? 'Approved' : raw === 'REJECTED' ? 'Declined' : 'Pending';
                      return (
                        <li
                          key={t.universityId}
                          className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-xs shadow-sm"
                        >
                          <span className="min-w-0 truncate font-semibold text-slate-800">{t.name}</span>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                              raw === 'APPROVED' && 'bg-emerald-100 text-emerald-900',
                              raw === 'REJECTED' && 'bg-slate-200 text-slate-700',
                              raw !== 'APPROVED' && raw !== 'REJECTED' && 'bg-amber-100 text-amber-900'
                            )}
                          >
                            {statusLabel}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const formatAppliedDate = (value: string | null) => formatDeadline(value ?? undefined);

  const totalApplicants = companyApplications.length;
  const pendingCompany = companyApplications.filter((a) => a.isApprovedByCompany == null).length;
  const hiredCompany = companyApplications.filter((a) => a.isApprovedByCompany === true).length;

  const filteredCompanyApplications = companyApplications.filter((a) => {
    if (applicationsFilterOpportunityId != null && a.opportunityId !== applicationsFilterOpportunityId) {
      return false;
    }
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

  /** Full ΓÇ£My OpportunitiesΓÇ¥ experience from the sidebar (wireframe layout). */
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
            <p className="text-sm text-slate-500">Loading opportunitiesΓÇª</p>
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
                onViewApplications={() => {
                  const idNum = Number(opp.id);
                  if (!Number.isNaN(idNum)) {
                    setApplicationsFilterOpportunityId(idNum);
                    setApplicationsFilterOpportunityTitle(opp.title ?? null);
                  }
                  onNavigateTab?.('applications');
                }}
                onViewDetails={() => void openOpportunityDetail(opp, 'manage')}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  const renderStudentProfilePage = () => {
    const studentId = selectedStudentProfile?.studentId;
    const cvPath = studentId != null ? `/api/company/students/${studentId}/cv` : null;
    const certPath = (certificationId: number | undefined) =>
      studentId != null && certificationId != null
        ? `/api/company/students/${studentId}/certifications/${certificationId}`
        : null;

    const openInNewTab = async (path: string, fallbackName: string) => {
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        toast.error('Not signed in.');
        return;
      }
      const { blob, errorMessage } = await fetchStudentProfileBlob(accessToken, path);
      if (!blob || errorMessage) {
        toast.error(errorMessage || 'Could not open the file.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        // popup blocked ΓåÆ fall back to a download
        const a = document.createElement('a');
        a.href = url;
        a.download = fallbackName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      // Object URL is left for the new tab to consume; the browser frees it on tab close.
    };

    const downloadFile = async (path: string, filename: string) => {
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        toast.error('Not signed in.');
        return;
      }
      const { errorMessage } = await downloadStudentProfileFile(accessToken, path, filename);
      if (errorMessage) toast.error(errorMessage);
    };

    return (
      <div>
        <button
          type="button"
          onClick={() => setSelectedStudentProfile(null)}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Back to applications
        </button>
        {studentProfileLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-sm text-slate-500">
            Loading profileΓÇª
          </div>
        ) : studentProfileError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center text-sm text-rose-600">
            {studentProfileError}
          </div>
        ) : studentProfileLoaded ? (
          <StudentProfileView
            student={studentProfileLoaded}
            projects={studentProfileLoaded.projects ?? []}
            readOnly
            onEdit={() => { /* read-only */ }}
            onPreviewCv={() => {
              if (!cvPath) return;
              const name =
                studentProfileLoaded.extendedProfile?.cvFile?.originalFilename ||
                studentProfileLoaded.extendedProfile?.cvFilename ||
                'cv.pdf';
              void openInNewTab(cvPath, name);
            }}
            onDownloadCv={() => {
              if (!cvPath) return;
              const name =
                studentProfileLoaded.extendedProfile?.cvFile?.originalFilename ||
                studentProfileLoaded.extendedProfile?.cvFilename ||
                'cv.pdf';
              void downloadFile(cvPath, name);
            }}
            onPreviewCertification={(file) => {
              const path = certPath(file.certificationId);
              if (!path) return;
              void openInNewTab(path, file.originalFilename || file.displayName);
            }}
            onDownloadCertification={(file) => {
              const path = certPath(file.certificationId);
              if (!path) return;
              void downloadFile(path, file.originalFilename || file.displayName);
            }}
            /* Edit/add/delete props omitted ΓÇö StudentProfileView gates each affordance on its callback being defined. */
          />
        ) : null}
      </div>
    );
  };

  const renderApplications = () => {
    if (selectedStudentProfile) {
      return renderStudentProfilePage();
    }

    const apps = filteredCompanyApplications;
    const totalApps = companyApplications.length;

    const statusPill = (status: string | null, isApprovedByCompany: boolean | null) => {
      const label = (status ?? 'WAITING').toUpperCase();
      let bg = '#5DADE2'; // Waiting
      if (isApprovedByCompany === true || label === 'APPROVED') bg = '#20948B'; // Approved
      else if (isApprovedByCompany === false || label === 'REJECTED') bg = '#E74C3C'; // Rejected
      const display = isApprovedByCompany === true
        ? 'APPROVED'
        : isApprovedByCompany === false
          ? 'REJECTED'
          : label;
      return (
        <span
          className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: bg }}
        >
          {display}
        </span>
      );
    };

    const openActionMenu = (app: ApplicationResponse, e: React.MouseEvent<HTMLButtonElement>) => {
      const targetId = app.applicationId;
      if (actionMenu?.application.applicationId === targetId) {
        setActionMenu(null);
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      setActionMenu({
        application: app,
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    };

    return (
      <>
        <h1 className="text-3xl font-extrabold text-[#002B5B] mb-6">Review Applications</h1>

        {applicationsFilterOpportunityId != null ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#002B5B]/20 bg-[#002B5B]/5 px-4 py-2 text-sm font-medium text-[#002B5B]">
            <span className="text-xs uppercase tracking-wider text-slate-500">Filtered by</span>
            <span>{applicationsFilterOpportunityTitle ?? `Opportunity #${applicationsFilterOpportunityId}`}</span>
            <button
              type="button"
              aria-label="Clear opportunity filter"
              onClick={() => {
                setApplicationsFilterOpportunityId(null);
                setApplicationsFilterOpportunityTitle(null);
              }}
              className="ml-1 rounded-full p-1 text-slate-500 hover:bg-slate-200/60 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search student name or role..."
            suppressHydrationWarning
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#002B5B]/20 focus:border-[#002B5B] outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {applicationsLoading ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">Loading applications...</p>
          ) : totalApps === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                <FileText size={20} />
              </div>
              <p className="text-sm font-medium text-slate-700">No applications yet.</p>
              <p className="mt-1 text-xs text-slate-400">
                Students will appear here when they apply to your opportunities.
              </p>
            </div>
          ) : apps.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">
              No applications match your search.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#002B5B] text-white text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4 text-center">Name</th>
                    <th className="px-6 py-4 text-center">Date Applied</th>
                    <th className="px-6 py-4 text-center">Opportunity</th>
                    <th className="px-6 py-4 text-center">Type</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {apps.map((app) => {
                    const id = app.applicationId;
                    return (
                      <tr key={id ?? Math.random()} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            suppressHydrationWarning
                            onClick={() => setSelectedStudentProfile(app)}
                            className="font-medium text-slate-800 hover:underline focus:outline-none focus:ring-2 focus:ring-[#002B5B] rounded"
                          >
                            {app.studentName ?? 'ΓÇö'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">
                          {formatAppliedDate(app.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-slate-700">
                          {app.opportunityTitle ?? 'ΓÇö'}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">
                          {formatApplicationTypeLabel(app.applicationType)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {statusPill(app.status, app.isApprovedByCompany)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            suppressHydrationWarning
                            aria-label={`Actions for ${app.studentName ?? 'application'}`}
                            onClick={(e) => openActionMenu(app, e)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedApplicationDetail ? (
          <SubmitApplicationModal
            key={selectedApplicationDetail.applicationId ?? 'company-app-view'}
            mode="view"
            opportunity={{
              title: selectedApplicationDetail.opportunityTitle ?? 'Opportunity',
              company: selectedApplicationDetail.companyName ?? '',
            }}
            student={studentPropsFromCompanyApplication(selectedApplicationDetail)}
            onClose={() => setSelectedApplicationDetail(null)}
            viewReview={{
              applicationId: selectedApplicationDetail.applicationId,
              status: selectedApplicationDetail.status,
              createdAt: selectedApplicationDetail.createdAt,
              isApprovedByPPA: selectedApplicationDetail.isApprovedByPPA,
              isApprovedByCompany: selectedApplicationDetail.isApprovedByCompany,
            }}
            viewFields={{
              phoneNumber: selectedApplicationDetail.phoneNumber ?? selectedApplicationDetail.studentPhone,
              applicationType: selectedApplicationDetail.applicationType,
              accuracyConfirmed: selectedApplicationDetail.accuracyConfirmed ?? null,
            }}
            listingDetails={renderCompanyApplicationListingDetails()}
            canApplyForPP
          />
        ) : null}

        {/* Fixed-position action menu ΓÇö rendered outside the table so the last row's menu doesn't get clipped */}
        {actionMenu ? (
          <>
            <div
              className="fixed inset-0 z-[80]"
              onClick={() => setActionMenu(null)}
              role="presentation"
            />
            <div
              className="fixed z-[90] w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-2"
              style={{ top: actionMenu.top, right: actionMenu.right }}
            >
              <button
                type="button"
                onClick={() => {
                  const app = actionMenu.application;
                  setActionMenu(null);
                  setSelectedApplicationDetail(app);
                }}
                style={{ color: '#5FA8D3' }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50"
              >
                <Eye size={16} />
                View
              </button>
              {actionMenu.application.isApprovedByCompany == null ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const app = actionMenu.application;
                      setActionMenu(null);
                      setPendingDecision({ application: app, approved: true });
                    }}
                    style={{ color: '#2FA4A9' }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    <CheckCircle size={16} />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const app = actionMenu.application;
                      setActionMenu(null);
                      setPendingDecision({ application: app, approved: false });
                    }}
                    style={{ color: '#E53935' }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    <X size={16} />
                    Reject
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : null}

        {/* Confirm dialog for Approve / Reject */}
        {pendingDecision ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
            onClick={() => decidingId == null && setPendingDecision(null)}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h2 className="text-lg font-bold text-[#002B5B]">
                {pendingDecision.approved ? 'Approve application?' : 'Reject application?'}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {pendingDecision.approved
                  ? `Approve ${pendingDecision.application.studentName}'s application for "${pendingDecision.application.opportunityTitle ?? 'this opportunity'}"?`
                  : `Reject ${pendingDecision.application.studentName}'s application for "${pendingDecision.application.opportunityTitle ?? 'this opportunity'}"?`}
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={decidingId != null}
                  onClick={() => setPendingDecision(null)}
                  className="px-5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={decidingId != null}
                  onClick={() => void executeDecision(pendingDecision.application, pendingDecision.approved)}
                  className={cn(
                    'px-5 py-2 rounded-xl text-white font-bold disabled:opacity-50',
                    pendingDecision.approved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  )}
                >
                  {decidingId != null ? 'WorkingΓÇª' : pendingDecision.approved ? 'Approve' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  };

  const renderOpportunityDetail = (opportunity: Opportunity) => (
    <OpportunityDetailView
      variant="company"
      opportunity={opportunity}
      onBack={() => setSelectedOpportunityDetail(null)}
      onNavigateToApplications={() => {
        const idNum = Number(opportunity.id);
        if (!Number.isNaN(idNum)) {
          setApplicationsFilterOpportunityId(idNum);
          setApplicationsFilterOpportunityTitle(opportunity.title ?? null);
        }
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

  const renderUniversitiesPartnerships = () => {
    const browseId = partnershipUniversityBrowseId;
    if (browseId != null) {
      const row = partnershipUniversities.find((r) => r.universityId === browseId);
      const partnershipRow: InstitutionalPartnershipUniversityRow =
        row ??
        ({
          universityId: browseId,
          universityName: '',
          status: 'NONE',
          requestedByRole: null,
          requestedById: null,
          canRequest: true,
          canAccept: false,
          canReject: false,
          canEnd: false,
        } satisfies InstitutionalPartnershipUniversityRow);

      const statusDisplay = (r: InstitutionalPartnershipUniversityRow) => {
        const st = r.status;
        if (st === 'APPROVED') {
          return (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-emerald-600">
              Approved
            </span>
          );
        }
        if (st === 'REJECTED') {
          return (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-red-500">
              Rejected
            </span>
          );
        }
        if (st === 'PENDING') {
          const waiting = !r.canAccept && !r.canRequest;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-amber-500 w-fit">
                Pending
              </span>
              {waiting ? (
                <span className="text-xs text-slate-600">Waiting for the university to respond.</span>
              ) : (
                <span className="text-xs text-slate-600">Your response is needed.</span>
              )}
            </div>
          );
        }
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-200 w-fit">
            Not connected
          </span>
        );
      };

      const rowBusy = partnershipRowBusyId === browseId;

      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={closePartnershipUniversityProfile}
            className="text-sm font-bold text-[#002B5B] hover:text-[#001F42] text-left"
          >
            ← Back to universities
          </button>

          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between bg-gradient-to-b from-slate-50/95 to-white border-b border-slate-100/90">
              <div className="min-w-0 flex flex-wrap items-center gap-3">{statusDisplay(partnershipRow)}</div>
              <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                {partnershipRow.canRequest ? (
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => void handlePartnershipRequest(browseId)}
                    className="inline-flex items-center justify-center min-h-9 rounded-lg bg-[#002B5B] px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#001F42] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {rowBusy ? '…' : 'Request collaboration'}
                  </button>
                ) : null}
                {partnershipRow.canAccept ? (
                  <>
                    <button
                      type="button"
                      disabled={rowBusy}
                      onClick={() => void handlePartnershipRespond(browseId, true)}
                      className="inline-flex items-center justify-center min-h-9 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={rowBusy}
                      onClick={() => void handlePartnershipRespond(browseId, false)}
                      className="inline-flex items-center justify-center min-h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Reject
                    </button>
                  </>
                ) : null}
                {partnershipRow.canEnd ? (
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => void handlePartnershipEnd(browseId)}
                    className="inline-flex items-center justify-center min-h-9 rounded-lg border border-red-200 bg-red-50/90 px-3.5 text-sm font-semibold text-red-800 shadow-sm hover:bg-red-100 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    End collaboration
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {partnershipUniversityBrowseLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500 text-sm font-medium">
              <Loader2 className="animate-spin" size={20} />
              Loading profile…
            </div>
          ) : partnershipUniversityBrowseProfile ? (
            <UniversityProfileReadOnlyView profile={partnershipUniversityBrowseProfile} mediaRev={0} />
          ) : (
            <p className="text-sm text-slate-500">Could not load university profile.</p>
          )}
        </div>
      );
    }

    const filterBtn = (key: 'all' | 'collaborators' | 'non', label: string) => (
      <button
        key={key}
        type="button"
        onClick={() => setPartnershipFilter(key)}
        className={cn(
          'rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150',
          partnershipFilter === key
            ? 'bg-white text-[#002B5B] shadow-sm ring-1 ring-slate-200/90'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
        )}
      >
        {label}
      </button>
    );

    const listStatusDisplay = (r: InstitutionalPartnershipUniversityRow) => {
      const st = r.status;
      if (st === 'APPROVED') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-emerald-600">
            Approved
          </span>
        );
      }
      if (st === 'REJECTED') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-red-500">
            Rejected
          </span>
        );
      }
      if (st === 'PENDING') {
        const waiting = !r.canAccept && !r.canRequest;
        return (
          <div className="flex flex-col gap-0.5 items-center">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-amber-500">
              Pending
            </span>
            {waiting ? (
              <span className="text-[10px] text-slate-500 font-medium text-center max-w-[160px]">
                Waiting for the university
              </span>
            ) : (
              <span className="text-[10px] text-slate-500 font-medium">Your response needed</span>
            )}
          </div>
        );
      }
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-200">
          Not connected
        </span>
      );
    };

    const rowBusy = (id: number) => partnershipRowBusyId === id;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-[#002B5B]">Universities</h1>
          <p className="mt-1 text-sm text-slate-600">
            Institutional partners are global pairings with a university, separate from collaboration on individual opportunities. Click a university name to open its full profile; you can also act from this table.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-sm">
          {filterBtn('all', 'All')}
          {filterBtn('collaborators', 'Collaborators')}
          {filterBtn('non', 'Non-collaborators')}
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search university name…"
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#002B5B]/20 focus:border-[#002B5B] outline-none shadow-sm"
            value={partnershipSearch}
            onChange={(e) => setPartnershipSearch(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {partnershipUniversitiesLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm font-medium">
              <Loader2 className="animate-spin" size={20} />
              Loading universities…
            </div>
          ) : partnershipUniversities.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-500">No universities are available yet.</p>
          ) : filteredPartnershipUniversities.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-500">No universities match this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#002B5B] text-white text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4 text-left">University</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPartnershipUniversities.map((row) => (
                    <tr key={row.universityId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => void openPartnershipUniversityProfile(row.universityId)}
                          className="text-left text-sm font-semibold text-[#002B5B] hover:underline focus:outline-none focus:ring-2 focus:ring-[#002B5B]/30 rounded"
                        >
                          {row.universityName}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">{listStatusDisplay(row)}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {row.canRequest ? (
                            <button
                              type="button"
                              disabled={rowBusy(row.universityId)}
                              onClick={() => void handlePartnershipRequest(row.universityId)}
                              className="inline-flex items-center justify-center min-h-9 rounded-lg bg-[#002B5B] px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#001F42] disabled:opacity-50 disabled:pointer-events-none"
                            >
                              {rowBusy(row.universityId) ? '…' : 'Request collaboration'}
                            </button>
                          ) : null}
                          {row.canAccept ? (
                            <>
                              <button
                                type="button"
                                disabled={rowBusy(row.universityId)}
                                onClick={() => void handlePartnershipRespond(row.universityId, true)}
                                className="inline-flex items-center justify-center min-h-9 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                disabled={rowBusy(row.universityId)}
                                onClick={() => void handlePartnershipRespond(row.universityId, false)}
                                className="inline-flex items-center justify-center min-h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                          {row.canEnd ? (
                            <button
                              type="button"
                              disabled={rowBusy(row.universityId)}
                              onClick={() => void handlePartnershipEnd(row.universityId)}
                              className="inline-flex items-center justify-center min-h-9 rounded-lg border border-red-200 bg-red-50/90 px-3.5 text-sm font-semibold text-red-800 shadow-sm hover:bg-red-100 disabled:opacity-50 disabled:pointer-events-none"
                            >
                              End collaboration
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
          <p className="text-sm text-slate-500">Loading opportunitiesΓÇª</p>
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
      case 'universities':
        return renderUniversitiesPartnerships();
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
          onActivateOpportunity={(id) => void openOpportunityFromNotification(id)}
          onActivatePartnership={(ctx) => {
            onNavigateTab?.('universities');
            void loadPartnershipUniversities();
            const uid = ctx.partnershipUniversityId;
            if (uid != null) void openPartnershipUniversityProfile(uid);
            close();
          }}
          className="max-w-none mx-0 h-full min-h-0 flex flex-col shadow-2xl ring-1 ring-slate-200/80"
        />
      )}
    >
      {renderContent()}
    </Dashboard>
  );
};

export default CompanyDashboard;
