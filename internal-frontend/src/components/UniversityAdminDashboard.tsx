'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import Image from 'next/image';
import Dashboard from './Dashboard';
import NotificationsPanel from '@/src/components/NotificationsPanel';
import UniversityProfileReadOnlyView from '@/src/components/UniversityProfileReadOnlyView';
import ViewerStudentProfileOverlay from '@/src/components/ViewerStudentProfileOverlay';
import CompanyProfileTabbedView from '@/src/components/CompanyProfileTabbedView';
import OpportunityRecordCard from '@/src/components/OpportunityRecordCard';
import UnderDevelopment from './UnderDevelopment';
import OpportunityDetailView from '@/src/components/OpportunityDetailView';
import * as XLSX from 'xlsx';
import {
  createAdminPpa,
  deleteAdminPpa,
  importAdminPpaCsv,
  type PpaCsvImportResult,
  type PpaImportMapping,
  fetchAdminCompanies,
  fetchAdminDashboardStats,
  patchAdminOpportunityCollaboration,
  createAdminDepartment,
  createAdminStudyField,
  deleteAdminDepartment,
  deleteAdminStudyField,
  fetchAdminDepartments,
  fetchAdminOpportunities,
  fetchAdminOpportunityDetail,
  fetchAdminPpas,
  fetchAdminStudents,
  fetchAdminStudyFields,
  mapAdminOpportunityDetailToOpportunity,
  mapAdminOpportunitySummaryToOpportunity,
  updateAdminDepartment,
  updateAdminPpa,
  updateAdminStudyField,
  type AdminOpportunityRow,
} from '@/src/lib/auth/admin';
import {
  deleteAdminPartnership,
  fetchUniversityAdminPartnershipCompanies,
  fetchUniversityAdminPartnershipCompanyProfile,
  fetchUniversityAdminPartnershipCompanyOpportunities,
  postAdminPartnershipRequest,
  postAdminPartnershipRespond,
  type InstitutionalPartnershipCompanyRow,
} from '@/src/lib/auth/partnerships';
import { getAccessTokenForMutatingApi, getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import { useNotificationUnreadCount } from '@/src/lib/auth/useNotificationUnreadCount';
import {
  fetchUniversityProfile,
  updateUniversityProfile,
  type UniversityProfileUpdatePayload,
} from '@/src/lib/auth/universityProfile';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { uploadUniversityProfilePhoto } from '@/src/lib/supabase/companyProfilePhotos';
import {
  formatDbDuration,
  formatExploreWorkMode,
  formatRelativePosted,
  formatTargetUniversitiesDisplay,
  getOpportunityCardInitials,
} from '@/src/lib/opportunityFormat';
import type {
  Application,
  CompanyProfileFromApi,
  DashboardStats,
  Department,
  Opportunity,
  PPAApprover,
  Student,
  StudyField,
  UniversityProfileFromApi,
} from '@/src/types';
import { toast } from 'sonner';
import {
  Users,
  GraduationCap,
  Briefcase,
  FileText,
  Plus,
  Upload,
  Search,
  Building2,
  Clock,
  MapPin,
  Trash2,
  Edit2,
  X,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Library,
  Filter,
  Loader2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface UniversityAdminDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  onToggleSidebar?: () => void;
  /** Switch sidebar tab (e.g. open Opportunities from a notification). */
  onNavigateTab?: (tab: string) => void;
  accessToken?: string | null;
  accessTokenRef?: MutableRefObject<string | null>;
  linkedEntityId?: string | number | null;
}

const UniversityAdminDashboard: React.FC<UniversityAdminDashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
  onToggleSidebar,
  onNavigateTab,
  accessToken,
  accessTokenRef,
  linkedEntityId,
}) => {
  const { unreadCount, refresh: refreshUnreadNotifications } = useNotificationUnreadCount();
  const [searchTerm, setSearchTerm] = useState('');
  const [adminStudentsSearch, setAdminStudentsSearch] = useState('');
  const [showAdminStudentFilters, setShowAdminStudentFilters] = useState(false);
  const [adminStudentYearFilter, setAdminStudentYearFilter] = useState<string[]>([]);
  const [adminStudentFieldFilter, setAdminStudentFieldFilter] = useState<string[]>([]);
  const [adminStudentDepartmentFilter, setAdminStudentDepartmentFilter] = useState<string[]>([]);
  const [adminStudentStatusFilter, setAdminStudentStatusFilter] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [studyFields, setStudyFields] = useState<StudyField[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalDepartments: 0,
    totalStudyFields: 0,
    ppaApprovers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [viewStudentProfileId, setViewStudentProfileId] = useState<number | null>(null);
  const [adminOpportunities, setAdminOpportunities] = useState<AdminOpportunityRow[]>([]);
  const [oppDeadlineFilter, setOppDeadlineFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [adminExploreSelectedId, setAdminExploreSelectedId] = useState<string | null>(null);
  const [adminExploreDetail, setAdminExploreDetail] = useState<Opportunity | null>(null);
  const [adminExploreDetailLoading, setAdminExploreDetailLoading] = useState(false);
  const [adminExploreDetailError, setAdminExploreDetailError] = useState<string | null>(null);
  const [collaborationBusy, setCollaborationBusy] = useState(false);
  const [adminApplications, setAdminApplications] = useState<Application[]>([]);
  const [adminCompanies, setAdminCompanies] = useState<{ companyId: number; name: string; industry: string | null }[]>([]);
  const [partnershipCompanies, setPartnershipCompanies] = useState<InstitutionalPartnershipCompanyRow[]>([]);
  const [partnershipCompaniesLoading, setPartnershipCompaniesLoading] = useState(false);
  const [partnershipFilter, setPartnershipFilter] = useState<'all' | 'collaborators' | 'non'>('all');
  const [partnershipSearch, setPartnershipSearch] = useState('');
  const [partnershipRowBusyId, setPartnershipRowBusyId] = useState<number | null>(null);
  const [partnershipCompanyBrowseId, setPartnershipCompanyBrowseId] = useState<number | null>(null);
  const [partnershipCompanyBrowseProfile, setPartnershipCompanyBrowseProfile] =
    useState<CompanyProfileFromApi | null>(null);
  const [partnershipCompanyBrowseLoading, setPartnershipCompanyBrowseLoading] = useState(false);
  const [partnershipCompanyBrowseSection, setPartnershipCompanyBrowseSection] = useState<
    'about' | 'opportunities'
  >('about');
  const [partnershipCompanyBrowseOpportunities, setPartnershipCompanyBrowseOpportunities] = useState<
    Opportunity[]
  >([]);
  const [partnershipCompanyBrowseOppSelectedId, setPartnershipCompanyBrowseOppSelectedId] = useState<string | null>(
    null
  );
  const [partnershipCompanyBrowseOppDetail, setPartnershipCompanyBrowseOppDetail] = useState<Opportunity | null>(
    null
  );
  const [partnershipCompanyBrowseOppLoading, setPartnershipCompanyBrowseOppLoading] = useState(false);
  const [partnershipCompanyBrowseOppError, setPartnershipCompanyBrowseOppError] = useState<string | null>(null);
  const [ppas, setPpas] = useState<PPAApprover[]>([]);
  const [editingPpa, setEditingPpa] = useState<PPAApprover | null>(null);
  const [isSavingPpa, setIsSavingPpa] = useState(false);
  /** Remount the study-field dropdown after each pick so it resets to the placeholder option. */
  const [studyFieldPickerKey, setStudyFieldPickerKey] = useState(0);
  const [ppaForm, setPpaForm] = useState({
    fullName: '',
    email: '',
    departmentId: '',
    studyFieldIds: [] as string[],
  });
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState<PpaCsvImportResult | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importMapping, setImportMapping] = useState<PpaImportMapping>({
    nameColumn: '', emailColumn: '', departmentColumn: '', studyFieldColumn: '',
  });
  const [showImportModal, setShowImportModal] = useState(false);

  const [academicDeptName, setAcademicDeptName] = useState('');
  const [academicDeptError, setAcademicDeptError] = useState<string | null>(null);
  const [academicSavingDept, setAcademicSavingDept] = useState(false);
  const [academicFieldName, setAcademicFieldName] = useState('');
  const [academicFieldDeptId, setAcademicFieldDeptId] = useState('');
  const [academicFieldError, setAcademicFieldError] = useState<string | null>(null);
  const [academicSavingField, setAcademicSavingField] = useState(false);
  const [academicFieldFilterDeptId, setAcademicFieldFilterDeptId] = useState('');
  const [academicDeptSortDesc, setAcademicDeptSortDesc] = useState(false);
  const [academicFieldSortDesc, setAcademicFieldSortDesc] = useState(false);
  const [academicDeptSearch, setAcademicDeptSearch] = useState('');
  const [academicFieldSearch, setAcademicFieldSearch] = useState('');
  const [academicEditingDeptId, setAcademicEditingDeptId] = useState<string | null>(null);
  const [academicEditDeptName, setAcademicEditDeptName] = useState('');
  const [academicDeptRowBusyId, setAcademicDeptRowBusyId] = useState<string | null>(null);
  const [academicEditingFieldId, setAcademicEditingFieldId] = useState<string | null>(null);
  const [academicEditFieldName, setAcademicEditFieldName] = useState('');
  const [academicEditFieldDeptId, setAcademicEditFieldDeptId] = useState('');
  const [academicFieldRowBusyId, setAcademicFieldRowBusyId] = useState<string | null>(null);

  const [uniProfile, setUniProfile] = useState<UniversityProfileFromApi | null>(null);
  const [uniProfileLoading, setUniProfileLoading] = useState(false);
  const [isEditingUniProfile, setIsEditingUniProfile] = useState(false);
  const [uniProfileDraft, setUniProfileDraft] = useState<UniversityProfileUpdatePayload | null>(null);
  const [uniProfileLogoFile, setUniProfileLogoFile] = useState<File | null>(null);
  const [uniProfileCoverFile, setUniProfileCoverFile] = useState<File | null>(null);
  const [uniLogoObjectUrl, setUniLogoObjectUrl] = useState<string | null>(null);
  const [uniCoverObjectUrl, setUniCoverObjectUrl] = useState<string | null>(null);
  const [uniProfileMediaRev, setUniProfileMediaRev] = useState(0);
  const uniLogoFileInputRef = useRef<HTMLInputElement>(null);
  const uniCoverFileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Prefer Supabase session (with refresh) so POST/PUT always send a current JWT. Relying only on ref/prop can
   * yield a missing Authorization header in edge cases (e.g. ref cleared) while getSession still has a session —
   * the backend then responds 401 with "Authentication required. Sign in and send a valid Bearer token."
   */
  const resolveAccessToken = useCallback(async (): Promise<string | null> => {
    const fresh = await getSessionAccessToken();
    if (fresh) return fresh;
    const refreshed = await getAccessTokenForMutatingApi();
    if (refreshed) return refreshed;
    const fromRef = accessTokenRef?.current?.trim();
    if (fromRef) return fromRef;
    const fromProp = accessToken?.trim();
    if (fromProp) return fromProp;
    return null;
  }, [accessToken, accessTokenRef]);

  const loadPartnershipCompanies = useCallback(async () => {
    setPartnershipCompaniesLoading(true);
    try {
      const token = await resolveAccessToken();
      if (!token) {
        toast.error('Not signed in.');
        return;
      }
      const { data, errorMessage } = await fetchUniversityAdminPartnershipCompanies(token);
      if (errorMessage) {
        toast.error(errorMessage);
        return;
      }
      setPartnershipCompanies(data ?? []);
    } finally {
      setPartnershipCompaniesLoading(false);
    }
  }, [resolveAccessToken]);

  useEffect(() => {
    if (activeTab === 'companies') {
      void loadPartnershipCompanies();
    } else {
      setPartnershipCompanyBrowseId(null);
      setPartnershipCompanyBrowseProfile(null);
      setPartnershipCompanyBrowseLoading(false);
      setPartnershipCompanyBrowseSection('about');
      setPartnershipCompanyBrowseOpportunities([]);
      setPartnershipCompanyBrowseOppSelectedId(null);
      setPartnershipCompanyBrowseOppDetail(null);
      setPartnershipCompanyBrowseOppLoading(false);
      setPartnershipCompanyBrowseOppError(null);
    }
  }, [activeTab, loadPartnershipCompanies]);

  const openPartnershipCompanyProfile = useCallback(
    async (companyId: number) => {
      setPartnershipCompanyBrowseSection('opportunities');
      setPartnershipCompanyBrowseOppSelectedId(null);
      setPartnershipCompanyBrowseOppDetail(null);
      setPartnershipCompanyBrowseOppError(null);
      setPartnershipCompanyBrowseOppLoading(false);
      setPartnershipCompanyBrowseId(companyId);
      setPartnershipCompanyBrowseProfile(null);
      setPartnershipCompanyBrowseOpportunities([]);
      setPartnershipCompanyBrowseLoading(true);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const [profRes, oppRes] = await Promise.all([
          fetchUniversityAdminPartnershipCompanyProfile(token, companyId),
          fetchUniversityAdminPartnershipCompanyOpportunities(token, companyId),
        ]);
        if (profRes.errorMessage) {
          toast.error(profRes.errorMessage);
        } else {
          setPartnershipCompanyBrowseProfile(profRes.data);
        }
        if (oppRes.data && !oppRes.errorMessage) {
          setPartnershipCompanyBrowseOpportunities(oppRes.data);
        } else if (oppRes.errorMessage && profRes.data) {
          toast.error(oppRes.errorMessage);
        }
      } finally {
        setPartnershipCompanyBrowseLoading(false);
      }
    },
    [resolveAccessToken]
  );

  const closePartnershipCompanyBrowseOpportunity = useCallback(() => {
    setPartnershipCompanyBrowseOppSelectedId(null);
    setPartnershipCompanyBrowseOppDetail(null);
    setPartnershipCompanyBrowseOppError(null);
    setPartnershipCompanyBrowseOppLoading(false);
  }, []);

  const openPartnershipCompanyBrowseOpportunity = useCallback(
    async (opportunityId: number) => {
      setPartnershipCompanyBrowseOppSelectedId(String(opportunityId));
      setPartnershipCompanyBrowseOppDetail(null);
      setPartnershipCompanyBrowseOppLoading(true);
      setPartnershipCompanyBrowseOppError(null);
      const token = await resolveAccessToken();
      if (!token) {
        setPartnershipCompanyBrowseOppLoading(false);
        toast.error('Not signed in.');
        setPartnershipCompanyBrowseOppSelectedId(null);
        return;
      }
      const res = await fetchAdminOpportunityDetail(token, opportunityId);
      setPartnershipCompanyBrowseOppLoading(false);
      if (res.errorMessage) {
        setPartnershipCompanyBrowseOppError(res.errorMessage);
        toast.error(res.errorMessage);
      } else if (res.data) {
        setPartnershipCompanyBrowseOppDetail(mapAdminOpportunityDetailToOpportunity(res.data));
      }
    },
    [resolveAccessToken]
  );

  const closePartnershipCompanyProfile = useCallback(() => {
    setPartnershipCompanyBrowseId(null);
    setPartnershipCompanyBrowseProfile(null);
    setPartnershipCompanyBrowseSection('about');
    setPartnershipCompanyBrowseOpportunities([]);
    closePartnershipCompanyBrowseOpportunity();
  }, [closePartnershipCompanyBrowseOpportunity]);

  const handleAdminPartnershipRequest = useCallback(
    async (companyId: number) => {
      setPartnershipRowBusyId(companyId);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const { errorMessage } = await postAdminPartnershipRequest(token, companyId);
        if (errorMessage) {
          toast.error(errorMessage);
        } else {
          toast.success('Collaboration request sent.');
          await loadPartnershipCompanies();
          void refreshUnreadNotifications();
        }
      } finally {
        setPartnershipRowBusyId(null);
      }
    },
    [resolveAccessToken, loadPartnershipCompanies, refreshUnreadNotifications]
  );

  const handleAdminPartnershipRespond = useCallback(
    async (companyId: number, approve: boolean) => {
      setPartnershipRowBusyId(companyId);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const { errorMessage } = await postAdminPartnershipRespond(token, companyId, approve);
        if (errorMessage) {
          toast.error(errorMessage);
        } else {
          toast.success(approve ? 'Collaboration accepted.' : 'Collaboration declined.');
          await loadPartnershipCompanies();
          void refreshUnreadNotifications();
        }
      } finally {
        setPartnershipRowBusyId(null);
      }
    },
    [resolveAccessToken, loadPartnershipCompanies, refreshUnreadNotifications]
  );

  const handleAdminPartnershipEnd = useCallback(
    async (companyId: number) => {
      setPartnershipRowBusyId(companyId);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const { errorMessage } = await deleteAdminPartnership(token, companyId);
        if (errorMessage) {
          toast.error(errorMessage);
        } else {
          toast.success('Institutional collaboration ended.');
          await loadPartnershipCompanies();
          void refreshUnreadNotifications();
        }
      } finally {
        setPartnershipRowBusyId(null);
      }
    },
    [resolveAccessToken, loadPartnershipCompanies, refreshUnreadNotifications]
  );

  useEffect(() => {
    if (!uniProfileLogoFile) {
      setUniLogoObjectUrl(null);
      return;
    }
    const u = URL.createObjectURL(uniProfileLogoFile);
    setUniLogoObjectUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [uniProfileLogoFile]);

  useEffect(() => {
    if (!uniProfileCoverFile) {
      setUniCoverObjectUrl(null);
      return;
    }
    const u = URL.createObjectURL(uniProfileCoverFile);
    setUniCoverObjectUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [uniProfileCoverFile]);

  useEffect(() => {
    if (activeTab !== 'profile') return;
    let cancelled = false;
    (async () => {
      setUniProfileLoading(true);
      try {
        const token = await resolveAccessToken();
        if (!token || cancelled) return;
        const res = await fetchUniversityProfile(token);
        if (cancelled) return;
        if (res.errorMessage) {
          toast.error(res.errorMessage);
          setUniProfile(null);
        } else if (res.data) {
          setUniProfile(res.data);
        }
      } finally {
        if (!cancelled) setUniProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, resolveAccessToken]);

  const canEditUniProfile = useMemo(() => {
    if (!uniProfile || linkedEntityId == null) return false;
    return String(uniProfile.universityId) === String(linkedEntityId);
  }, [uniProfile, linkedEntityId]);

  const filteredPartnershipCompanies = useMemo(() => {
    const q = partnershipSearch.trim().toLowerCase();
    let list = partnershipCompanies;
    if (partnershipFilter === 'collaborators') {
      list = list.filter((r) => r.status === 'APPROVED');
    } else if (partnershipFilter === 'non') {
      list = list.filter((r) => r.status !== 'APPROVED');
    }
    if (q) {
      list = list.filter(
        (r) =>
          r.companyName.toLowerCase().includes(q) || (r.industry ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [partnershipCompanies, partnershipFilter, partnershipSearch]);

  const closeUniProfileModal = useCallback(() => {
    setIsEditingUniProfile(false);
    setUniProfileDraft(null);
    setUniProfileLogoFile(null);
    setUniProfileCoverFile(null);
  }, []);

  const beginEditUniProfile = useCallback(() => {
    if (!uniProfile) return;
    setUniProfileLogoFile(null);
    setUniProfileCoverFile(null);
    setUniProfileDraft({
      name: uniProfile.name,
      location: uniProfile.location ?? '',
      description: uniProfile.description ?? '',
      website: uniProfile.website ?? '',
      email: uniProfile.email ?? '',
      employeeCount: uniProfile.employeeCount,
      foundedYear: uniProfile.foundedYear,
      specialties: uniProfile.specialties ?? '',
      logoUrl: uniProfile.logoUrl ?? '',
      coverUrl: uniProfile.coverUrl ?? '',
    });
    setIsEditingUniProfile(true);
  }, [uniProfile]);

  const saveUniProfile = useCallback(async () => {
    if (!uniProfile || !uniProfileDraft) {
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
      const uid = uniProfile.universityId;
      let logoUrl = uniProfileDraft.logoUrl ?? '';
      let coverUrl = uniProfileDraft.coverUrl ?? '';
      if (uniProfileLogoFile) {
        const up = await uploadUniversityProfilePhoto(supabase, 'logo', uid, uniProfileLogoFile);
        if (up.errorMessage || !up.publicUrl) {
          toast.error(up.errorMessage || 'Could not upload logo');
          return;
        }
        logoUrl = up.publicUrl;
      }
      if (uniProfileCoverFile) {
        const up = await uploadUniversityProfilePhoto(supabase, 'cover', uid, uniProfileCoverFile);
        if (up.errorMessage || !up.publicUrl) {
          toast.error(up.errorMessage || 'Could not upload cover image');
          return;
        }
        coverUrl = up.publicUrl;
      }
      const { data, errorMessage } = await updateUniversityProfile(accessToken, {
        ...uniProfileDraft,
        logoUrl,
        coverUrl,
      });
      if (!data || errorMessage) {
        toast.error(errorMessage || 'Could not save profile');
        return;
      }
      const savedPhoto = uniProfileLogoFile != null || uniProfileCoverFile != null;
      setUniProfileLogoFile(null);
      setUniProfileCoverFile(null);
      if (savedPhoto) setUniProfileMediaRev((r) => r + 1);
      setUniProfile(data);
      closeUniProfileModal();
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save profile');
    }
  }, [uniProfile, uniProfileDraft, uniProfileLogoFile, uniProfileCoverFile, closeUniProfileModal]);

  const reloadAcademicCatalog = useCallback(async () => {
    const token = await resolveAccessToken();
    if (!token) {
      toast.error('Not signed in.');
      return;
    }
    const [departmentsRes, fieldsRes, statsRes] = await Promise.all([
      fetchAdminDepartments(token),
      fetchAdminStudyFields(token),
      fetchAdminDashboardStats(token),
    ]);
    if (departmentsRes.errorMessage) toast.error(departmentsRes.errorMessage);
    else if (departmentsRes.data) setDepartments(departmentsRes.data);
    if (fieldsRes.errorMessage) toast.error(fieldsRes.errorMessage);
    else if (fieldsRes.data) setStudyFields(fieldsRes.data);
    if (statsRes.errorMessage) toast.error(statsRes.errorMessage);
    else if (statsRes.data) setStats(statsRes.data);
  }, [resolveAccessToken]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const [studentsRes, departmentsRes, fieldsRes, statsRes, companiesRes, ppasRes] = await Promise.all([
          fetchAdminStudents(token),
          fetchAdminDepartments(token),
          fetchAdminStudyFields(token),
          fetchAdminDashboardStats(token),
          fetchAdminCompanies(token, 10),
          fetchAdminPpas(token),
        ]);
        if (studentsRes.errorMessage) toast.error(studentsRes.errorMessage);
        else if (studentsRes.data) setStudents(studentsRes.data);
        if (departmentsRes.errorMessage) toast.error(departmentsRes.errorMessage);
        else if (departmentsRes.data) setDepartments(departmentsRes.data);
        if (fieldsRes.errorMessage) toast.error(fieldsRes.errorMessage);
        else if (fieldsRes.data) setStudyFields(fieldsRes.data);
        if (statsRes.errorMessage) toast.error(statsRes.errorMessage);
        else if (statsRes.data) setStats(statsRes.data);
        if (companiesRes.errorMessage) toast.error(companiesRes.errorMessage);
        else if (companiesRes.data) setAdminCompanies(companiesRes.data);
        if (ppasRes.errorMessage) toast.error(ppasRes.errorMessage);
        else if (ppasRes.data) setPpas(ppasRes.data);
      } catch (error) {
        console.error('Failed to load admin data', error);
        toast.error('Could not load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [resolveAccessToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await resolveAccessToken();
      if (!token || cancelled) return;
      const res = await fetchAdminOpportunities(token, { limit: 200, status: oppDeadlineFilter });
      if (cancelled) return;
      if (res.errorMessage) toast.error(res.errorMessage);
      else if (res.data) setAdminOpportunities(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [oppDeadlineFilter, resolveAccessToken]);

  const adminOpportunityById = useMemo(() => {
    const m = new Map<string, Opportunity>();
    for (const row of adminOpportunities) {
      m.set(String(row.opportunityId), mapAdminOpportunitySummaryToOpportunity(row));
    }
    return m;
  }, [adminOpportunities]);

  const linkedUniversityIdForCollab = useMemo(() => {
    if (linkedEntityId === null || linkedEntityId === undefined || linkedEntityId === '') return NaN;
    const n = Number(linkedEntityId);
    return Number.isFinite(n) ? n : NaN;
  }, [linkedEntityId]);

  const openOpportunityDetail = useCallback(
    async (id: number) => {
      setAdminExploreSelectedId(String(id));
      setAdminExploreDetail(null);
      setAdminExploreDetailLoading(true);
      setAdminExploreDetailError(null);
      const token = await resolveAccessToken();
      if (!token) {
        setAdminExploreDetailLoading(false);
        toast.error('Not signed in.');
        setAdminExploreSelectedId(null);
        return;
      }
      const res = await fetchAdminOpportunityDetail(token, id);
      setAdminExploreDetailLoading(false);
      if (res.errorMessage) {
        setAdminExploreDetailError(res.errorMessage);
        toast.error(res.errorMessage);
      } else if (res.data) {
        setAdminExploreDetail(mapAdminOpportunityDetailToOpportunity(res.data));
      }
    },
    [resolveAccessToken]
  );

  const openOpportunityFromNotification = useCallback(
    (opportunityId: number) => {
      onNavigateTab?.('opportunities');
      void openOpportunityDetail(opportunityId);
    },
    [onNavigateTab, openOpportunityDetail]
  );

  const submitCollaborationDecision = useCallback(
    async (approved: boolean) => {
      const rawId =
        partnershipCompanyBrowseOppSelectedId != null
          ? partnershipCompanyBrowseOppSelectedId
          : (adminExploreDetail?.id ?? adminExploreSelectedId);
      const id = rawId != null && String(rawId).trim() !== '' ? Number(rawId) : NaN;
      if (!Number.isFinite(id)) return;
      setCollaborationBusy(true);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const res = await patchAdminOpportunityCollaboration(token, id, approved);
        if (res.errorMessage) {
          toast.error(res.errorMessage);
          return;
        }
        if (res.data) {
          const mapped = mapAdminOpportunityDetailToOpportunity(res.data);
          setAdminExploreDetail(mapped);
          if (partnershipCompanyBrowseOppSelectedId != null) {
            setPartnershipCompanyBrowseOppDetail(mapped);
          }
        }
        toast.success(approved ? 'Collaboration approved.' : 'Collaboration declined.');
      } finally {
        setCollaborationBusy(false);
      }
    },
    [
      adminExploreDetail?.id,
      adminExploreSelectedId,
      partnershipCompanyBrowseOppSelectedId,
      resolveAccessToken,
    ]
  );

  const studyYearLabel = useCallback((year: number | null | undefined) => {
    if (year == null) return '—';
    const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
    return `${year}${suffixes[year] ?? 'th'} Year`;
  }, []);

  /** All departments / study fields for the university (from API), not only those with students. */
  const adminStudentFilterDepartments = useMemo(
    () =>
      [...departments].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      ),
    [departments]
  );

  const departmentNameByIdForFilters = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of departments) {
      m.set(d.id, d.name || '');
    }
    return m;
  }, [departments]);

  const adminStudentFilterStudyFields = useMemo(
    () =>
      [...studyFields].sort((a, b) => {
        const deptA = departmentNameByIdForFilters.get(a.departmentId) || '';
        const deptB = departmentNameByIdForFilters.get(b.departmentId) || '';
        const byDept = deptA.localeCompare(deptB, undefined, { sensitivity: 'base' });
        if (byDept !== 0) return byDept;
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }),
    [studyFields, departmentNameByIdForFilters]
  );

  const filteredStudents = useMemo(() => {
    const q = adminStudentsSearch.trim().toLowerCase();
    return students.filter((student) => {
      if (q) {
        const deptLabel =
          student.departmentName?.trim() ||
          (student.departmentId
            ? departments.find((d) => d.id === student.departmentId)?.name?.trim()
            : '') ||
          '';
        const fieldLabel =
          student.studyFieldName?.trim() ||
          (student.studyFieldId
            ? studyFields.find((f) => f.id === student.studyFieldId)?.name?.trim()
            : '') ||
          '';
        const hay = [student.fullName, student.email, student.departmentName, student.studyFieldName, deptLabel, fieldLabel]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (adminStudentYearFilter.length > 0) {
        const label = studyYearLabel(student.studyYear);
        if (label === '—' || !adminStudentYearFilter.includes(label)) return false;
      }
      if (adminStudentFieldFilter.length > 0) {
        const fid = student.studyFieldId;
        if (!fid || !adminStudentFieldFilter.includes(fid)) return false;
      }
      if (adminStudentDepartmentFilter.length > 0) {
        const did = student.departmentId;
        if (!did || !adminStudentDepartmentFilter.includes(did)) return false;
      }
      if (adminStudentStatusFilter.length > 0) {
        const status = student.applicationStatus;
        const label =
          status === 'APPROVED' ? 'Accepted' : status === 'REJECTED' ? 'Rejected' : 'Waiting Review';
        if (!adminStudentStatusFilter.includes(label)) return false;
      }
      return true;
    });
  }, [
    students,
    adminStudentsSearch,
    departments,
    studyFields,
    adminStudentYearFilter,
    adminStudentFieldFilter,
    adminStudentDepartmentFilter,
    adminStudentStatusFilter,
    studyYearLabel,
  ]);

  const filteredAdminOpportunities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = !q
      ? adminOpportunities
      : adminOpportunities.filter((o) => {
          const targets = (o.targetUniversityNames ?? []).join(' ').toLowerCase();
          const skills = (o.requiredSkills ?? []).join(' ').toLowerCase();
          const desc = (o.description ?? '').toLowerCase();
          return (
            (o.title || '').toLowerCase().includes(q) ||
            (o.companyName || '').toLowerCase().includes(q) ||
            (o.type || '').toLowerCase().includes(q) ||
            (o.location || '').toLowerCase().includes(q) ||
            (o.affiliatedUniversityName || '').toLowerCase().includes(q) ||
            targets.includes(q) ||
            skills.includes(q) ||
            desc.includes(q)
          );
        });
    return [...base].sort((a, b) => {
      const ap = (a.viewerCollaborationStatus ?? '').trim().toUpperCase() === 'PENDING' ? 0 : 1;
      const bp = (b.viewerCollaborationStatus ?? '').trim().toUpperCase() === 'PENDING' ? 0 : 1;
      return ap - bp;
    });
  }, [adminOpportunities, searchTerm]);

  const opportunityCountLabel = useMemo(() => {
    if (oppDeadlineFilter === 'active') return 'Active opportunities';
    if (oppDeadlineFilter === 'expired') return 'Expired opportunities';
    return 'All opportunities';
  }, [oppDeadlineFilter]);

  const filteredPpas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return ppas;
    return ppas.filter((p) =>
      `${p.fullName} ${p.email} ${p.departmentName} ${p.assignedStudyFields.map((f) => f.name).join(' ')}`
        .toLowerCase()
        .includes(q)
    );
  }, [ppas, searchTerm]);

  const fieldsForSelectedDepartment = useMemo(
    () => studyFields.filter((f) => f.departmentId === ppaForm.departmentId),
    [studyFields, ppaForm.departmentId]
  );

  const fieldsAvailableToAdd = useMemo(
    () => fieldsForSelectedDepartment.filter((f) => !ppaForm.studyFieldIds.includes(f.id)),
    [fieldsForSelectedDepartment, ppaForm.studyFieldIds]
  );

  const openCreatePpa = () => {
    setEditingPpa(null);
    setStudyFieldPickerKey((k) => k + 1);
    setPpaForm({ fullName: '', email: '', departmentId: '', studyFieldIds: [] });
  };

  const openEditPpa = (ppa: PPAApprover) => {
    setEditingPpa(ppa);
    setStudyFieldPickerKey((k) => k + 1);
    setPpaForm({
      fullName: ppa.fullName,
      email: ppa.email,
      departmentId: ppa.departmentId,
      studyFieldIds: ppa.assignedStudyFields.map((f) => f.id),
    });
  };

  const savePpa = async () => {
    const fullName = ppaForm.fullName.trim();
    const email = ppaForm.email.trim();
    const departmentId = ppaForm.departmentId.trim();
    const selectedFieldIds = ppaForm.studyFieldIds.filter((id) => id.trim() !== '');

    if (!fullName) {
      toast.error('Full name is required.');
      return;
    }
    if (!email) {
      toast.error('Email is required.');
      return;
    }
    if (!departmentId) {
      toast.error('Department is required.');
      return;
    }
    if (selectedFieldIds.length === 0) {
      toast.error('Please select at least one study field.');
      return;
    }
    const deptId = Number(departmentId);
    const fieldIds = selectedFieldIds.map(Number).filter((v) => Number.isFinite(v));
    const allMatch = fieldIds.every((fid) => studyFields.some((f) => Number(f.id) === fid && Number(f.departmentId) === deptId));
    if (!allMatch) {
      toast.error('Assigned study fields must belong to the selected department.');
      return;
    }

    const token = await resolveAccessToken();
    if (!token) {
      toast.error('Not signed in.');
      return;
    }
    setIsSavingPpa(true);
    const payload = {
      fullName,
      email: email.toLowerCase(),
      departmentId: deptId,
      studyFieldIds: fieldIds,
    };
    try {
      if (editingPpa) {
        const { data, errorMessage } = await updateAdminPpa(token, editingPpa.id, payload);
        if (!data || errorMessage) {
          toast.error(errorMessage || 'Could not update PP approver.');
          return;
        }
        setPpas((prev) => prev.map((p) => (p.id === data.id ? data : p)));
        toast.success('PP approver updated.');
      } else {
        const { data, errorMessage } = await createAdminPpa(token, payload);
        if (!data || errorMessage) {
          toast.error(errorMessage || 'Could not create PP approver.');
          return;
        }
        setPpas((prev) => [data, ...prev]);
        setStats((prev) => ({ ...prev, ppaApprovers: (prev.ppaApprovers ?? 0) + 1 }));
        toast.success('PP approver created.');
      }
      setEditingPpa(null);
      setStudyFieldPickerKey((k) => k + 1);
      setPpaForm({ fullName: '', email: '', departmentId: '', studyFieldIds: [] });
    } finally {
      setIsSavingPpa(false);
    }
  };

  const removePpa = async (ppa: PPAApprover) => {
    const ok = window.confirm(`Delete PP approver "${ppa.fullName}"?`);
    if (!ok) return;
    const token = await resolveAccessToken();
    if (!token) {
      toast.error('Not signed in.');
      return;
    }
    const { errorMessage } = await deleteAdminPpa(token, ppa.id);
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }
    setPpas((prev) => prev.filter((p) => p.id !== ppa.id));
    setStats((prev) => ({ ...prev, ppaApprovers: Math.max(0, (prev.ppaApprovers ?? 1) - 1) }));
    toast.success('PP approver deleted.');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Invalid file format. Please upload a CSV or Excel file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) { toast.error('File has no sheets.'); return; }
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
        if (!rows.length || !rows[0].length) { toast.error('File has no headers.'); return; }
        const headerRow = rows[0] as unknown[];
        const headers = headerRow
          .map((h: unknown) => (h == null ? '' : String(h)))
          .filter((h: string) => h.trim() !== '' && h !== 'undefined');
        setImportFile(file);
        setImportHeaders(headers);
        setImportMapping({ nameColumn: '', emailColumn: '', departmentColumn: '', studyFieldColumn: '' });
        setCsvImportResult(null);
        setShowImportModal(true);
      } catch {
        toast.error('Could not read file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;
    if (!importMapping.nameColumn || !importMapping.emailColumn ||
        !importMapping.departmentColumn || !importMapping.studyFieldColumn) {
      toast.error('Please map all fields before importing.');
      return;
    }
    const token = await resolveAccessToken();
    if (!token) { toast.error('Not signed in.'); return; }

    setCsvImporting(true);
    setCsvImportResult(null);
    try {
      const { data, errorMessage } = await importAdminPpaCsv(token, importFile, importMapping);
      if (errorMessage) { toast.error(errorMessage); return; }
      if (data) {
        setCsvImportResult(data);
        if (data.created > 0) {
          const freshToken = await resolveAccessToken();
          if (freshToken) {
            const { data: refreshed } = await fetchAdminPpas(freshToken);
            if (refreshed) setPpas(refreshed);
          }
          toast.success(`Imported: ${data.created} PPA(s) created` +
            (data.failed > 0 ? `, ${data.failed} failed` : ''));
        } else if (data.failed > 0) {
          toast.error(`Import failed: ${data.failed} row(s) had errors.`);
        }
      }
    } finally {
      setCsvImporting(false);
    }
  };

  const addStudyFieldFromPicker = (fieldId: string) => {
    if (!fieldId) return;
    setPpaForm((s) => {
      if (s.studyFieldIds.includes(fieldId)) return s;
      return { ...s, studyFieldIds: [...s.studyFieldIds, fieldId] };
    });
  };

  const removeStudyFieldFromPicker = (fieldId: string) => {
    setPpaForm((s) => ({
      ...s,
      studyFieldIds: s.studyFieldIds.filter((id) => id !== fieldId),
    }));
  };

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
        { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'bg-blue-50 text-blue-600', trend: '+12%' },
        { label: 'PP Approvers', value: stats.ppaApprovers ?? 0, icon: GraduationCap, color: 'bg-[#002B5B]/10 text-[#002B5B]', trend: '+5%' },
        { label: 'Departments', value: stats.totalDepartments, icon: Briefcase, color: 'bg-emerald-50 text-emerald-600', trend: '+2' },
        { label: 'Study Fields', value: stats.totalStudyFields, icon: FileText, color: 'bg-amber-50 text-amber-600', trend: '-3%' },
      ].map((stat, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className={cn("p-3 rounded-xl transition-colors duration-300", stat.color)}>
              <stat.icon size={20} />
            </div>
            <span className={cn(
              "text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider",
              stat.trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            )}>
              {stat.trend}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{stat.label}</div>
        </div>
      ))}
    </div>
  );

  const renderStudents = () => {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#002B5B] sm:text-3xl">Students</h2>
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
                value={adminStudentsSearch}
                onChange={(e) => setAdminStudentsSearch(e.target.value)}
              />
            </div>
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setShowAdminStudentFilters((v) => !v)}
              className={cn(
                'inline-flex shrink-0 items-center justify-center gap-2 rounded-full border px-5 py-3.5 text-sm font-bold shadow-sm transition-all sm:min-w-[8.5rem]',
                showAdminStudentFilters
                  ? 'border-[#002B5B] bg-[#002B5B] text-white hover:bg-[#003a7a]'
                  : 'border-slate-200 bg-white text-[#002B5B] hover:bg-slate-50'
              )}
            >
              <Filter size={18} strokeWidth={2} aria-hidden />
              Filters
            </button>
          </div>
        </div>

        {showAdminStudentFilters && (
          <div className="grid grid-cols-2 gap-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Study Year</div>
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5].map((y) => {
                  const label = studyYearLabel(y);
                  return (
                    <label key={y} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-[#002B5B]"
                        checked={adminStudentYearFilter.includes(label)}
                        onChange={(e) =>
                          setAdminStudentYearFilter((prev) =>
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
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Department</div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {adminStudentFilterDepartments.map((d) => (
                  <label key={d.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-[#002B5B]"
                      checked={adminStudentDepartmentFilter.includes(d.id)}
                      onChange={(e) =>
                        setAdminStudentDepartmentFilter((prev) =>
                          e.target.checked ? [...prev, d.id] : prev.filter((v) => v !== d.id)
                        )
                      }
                    />
                    {d.name}
                  </label>
                ))}
                {adminStudentFilterDepartments.length === 0 && <p className="text-xs text-slate-400">—</p>}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Study Field</div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {adminStudentFilterStudyFields.map((f) => (
                  <label key={f.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-[#002B5B]"
                      checked={adminStudentFieldFilter.includes(f.id)}
                      onChange={(e) =>
                        setAdminStudentFieldFilter((prev) =>
                          e.target.checked ? [...prev, f.id] : prev.filter((v) => v !== f.id)
                        )
                      }
                    />
                    {f.name}
                  </label>
                ))}
                {adminStudentFilterStudyFields.length === 0 && <p className="text-xs text-slate-400">—</p>}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Status</div>
              <div className="space-y-1.5">
                {['Waiting Review', 'Accepted', 'Rejected'].map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-[#002B5B]"
                      checked={adminStudentStatusFilter.includes(s)}
                      onChange={(e) =>
                        setAdminStudentStatusFilter((prev) =>
                          e.target.checked ? [...prev, s] : prev.filter((v) => v !== s)
                        )
                      }
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2 flex justify-end gap-3 md:col-span-4">
              <button
                suppressHydrationWarning
                type="button"
                onClick={() => {
                  setAdminStudentYearFilter([]);
                  setAdminStudentFieldFilter([]);
                  setAdminStudentDepartmentFilter([]);
                  setAdminStudentStatusFilter([]);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
              >
                Clear All
              </button>
              <button
                suppressHydrationWarning
                type="button"
                onClick={() => setShowAdminStudentFilters(false)}
                className="rounded-xl bg-[#002B5B] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-[#003a7a]"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="bg-[#002B5B] text-white">
                <th className="rounded-tl-2xl px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  Student name
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Study field</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Department</th>
                <th className="whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  Academic year
                </th>
                <th className="rounded-tr-2xl px-6 py-4 text-xs font-bold uppercase tracking-wider">
                  Student status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    Loading students…
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-600">
                    No students are registered for your university yet.
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-600">
                    No students match your search or filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const sid = Number(student.id);
                  const status = student.applicationStatus;
                  const decision: 'WAITING' | 'APPROVED' | 'REJECTED' =
                    status === 'APPROVED'
                      ? 'APPROVED'
                      : status === 'REJECTED'
                        ? 'REJECTED'
                        : 'WAITING';
                  return (
                    <tr key={student.id} className="transition-colors hover:bg-slate-50/90">
                      <td className="px-6 py-4 align-middle">
                        <button
                          type="button"
                          className="text-left text-base font-bold text-[#002B5B] hover:underline"
                          onClick={() => {
                            if (!Number.isNaN(sid)) setViewStudentProfileId(sid);
                          }}
                        >
                          {student.fullName}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600 align-middle">
                        {student.email || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600 align-middle">
                        {student.studyFieldName?.trim() ||
                          (student.studyFieldId
                            ? studyFields.find((f) => f.id === student.studyFieldId)?.name?.trim()
                            : undefined) ||
                          '—'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600 align-middle">
                        {student.departmentName?.trim() ||
                          (student.departmentId
                            ? departments.find((d) => d.id === student.departmentId)?.name?.trim()
                            : undefined) ||
                          '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-600 align-middle">
                        {studyYearLabel(student.studyYear)}
                      </td>
                      <td className="px-6 py-4 align-middle">
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAcademic = () => {
    const departmentNameById = new Map<string, string>();
    for (const d of departments) {
      departmentNameById.set(d.id, d.name || '—');
    }
    const sortedDepartments = [...departments].sort((a, b) => {
      const cmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      return academicDeptSortDesc ? -cmp : cmp;
    });
    const visibleDepartments = sortedDepartments.filter((d) =>
      (d.name || '').toLowerCase().includes(academicDeptSearch.trim().toLowerCase())
    );

    const filteredStudyFields = studyFields.filter(
      (f) => !academicFieldFilterDeptId || f.departmentId === academicFieldFilterDeptId
    );
    const sortedStudyFields = [...filteredStudyFields].sort((a, b) => {
      const cmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      if (cmp !== 0) {
        return academicFieldSortDesc ? -cmp : cmp;
      }
      const deptCmp = (departmentNameById.get(a.departmentId) || '').localeCompare(
        departmentNameById.get(b.departmentId) || '',
        undefined,
        { sensitivity: 'base' }
      );
      return academicFieldSortDesc ? -deptCmp : deptCmp;
    });
    const visibleStudyFields = sortedStudyFields.filter((f) => {
      const q = academicFieldSearch.trim().toLowerCase();
      if (!q) return true;
      const fieldName = (f.name || '').toLowerCase();
      const departmentName = (departmentNameById.get(f.departmentId) || '').toLowerCase();
      return fieldName.includes(q) || departmentName.includes(q);
    });

    const submitDepartment = async (e: React.FormEvent) => {
      e.preventDefault();
      setAcademicDeptError(null);
      const name = academicDeptName.trim();
      if (!name) {
        setAcademicDeptError('Department name is required.');
        return;
      }
      setAcademicSavingDept(true);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const res = await createAdminDepartment(token, { name });
        if (res.errorMessage) {
          setAcademicDeptError(res.errorMessage);
          toast.error(res.errorMessage);
          return;
        }
        setAcademicDeptName('');
        toast.success('Department created.');
        await reloadAcademicCatalog();
      } finally {
        setAcademicSavingDept(false);
      }
    };

    const submitStudyField = async (e: React.FormEvent) => {
      e.preventDefault();
      setAcademicFieldError(null);
      const name = academicFieldName.trim();
      if (!name) {
        setAcademicFieldError('Study field name is required.');
        return;
      }
      if (!academicFieldDeptId) {
        setAcademicFieldError('Select a department.');
        return;
      }
      const deptNum = Number(academicFieldDeptId);
      if (!Number.isFinite(deptNum) || deptNum <= 0) {
        setAcademicFieldError('Select a department.');
        return;
      }
      setAcademicSavingField(true);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const res = await createAdminStudyField(token, { name, departmentId: deptNum });
        if (res.errorMessage) {
          setAcademicFieldError(res.errorMessage);
          toast.error(res.errorMessage);
          return;
        }
        setAcademicFieldName('');
        setAcademicFieldDeptId('');
        toast.success('Study field created.');
        await reloadAcademicCatalog();
      } finally {
        setAcademicSavingField(false);
      }
    };

    const cancelDeptEdit = () => {
      setAcademicEditingDeptId(null);
      setAcademicEditDeptName('');
    };

    const saveDeptEdit = async () => {
      const id = academicEditingDeptId;
      if (!id) return;
      const name = academicEditDeptName.trim();
      if (!name) {
        toast.error('Department name is required.');
        return;
      }
      setAcademicDeptRowBusyId(id);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const res = await updateAdminDepartment(token, Number(id), { name });
        if (res.errorMessage) {
          toast.error(res.errorMessage);
          return;
        }
        cancelDeptEdit();
        toast.success('Department updated.');
        await reloadAcademicCatalog();
      } finally {
        setAcademicDeptRowBusyId(null);
      }
    };

    const handleDeleteDept = async (dept: Department) => {
      if (
        !globalThis.confirm(
          `Delete department “${dept.name || 'this department'}”? You cannot delete it if students, study fields, or other records still reference it.`
        )
      ) {
        return;
      }
      setAcademicDeptRowBusyId(dept.id);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const { errorMessage } = await deleteAdminDepartment(token, Number(dept.id));
        if (errorMessage) {
          toast.error(errorMessage);
          return;
        }
        if (academicEditingDeptId === dept.id) cancelDeptEdit();
        if (academicFieldFilterDeptId === dept.id) setAcademicFieldFilterDeptId('');
        toast.success('Department deleted.');
        await reloadAcademicCatalog();
      } finally {
        setAcademicDeptRowBusyId(null);
      }
    };

    const cancelFieldEdit = () => {
      setAcademicEditingFieldId(null);
      setAcademicEditFieldName('');
      setAcademicEditFieldDeptId('');
    };

    const saveFieldEdit = async () => {
      const id = academicEditingFieldId;
      if (!id) return;
      const name = academicEditFieldName.trim();
      if (!name) {
        toast.error('Study field name is required.');
        return;
      }
      if (!academicEditFieldDeptId) {
        toast.error('Select a department.');
        return;
      }
      const deptNum = Number(academicEditFieldDeptId);
      if (!Number.isFinite(deptNum) || deptNum <= 0) {
        toast.error('Select a department.');
        return;
      }
      setAcademicFieldRowBusyId(id);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const res = await updateAdminStudyField(token, Number(id), { name, departmentId: deptNum });
        if (res.errorMessage) {
          toast.error(res.errorMessage);
          return;
        }
        cancelFieldEdit();
        toast.success('Study field updated.');
        await reloadAcademicCatalog();
      } finally {
        setAcademicFieldRowBusyId(null);
      }
    };

    const handleDeleteField = async (field: StudyField) => {
      if (
        !globalThis.confirm(
          `Delete study field “${field.name || 'this field'}”? You cannot delete it if students or other records still reference it.`
        )
      ) {
        return;
      }
      setAcademicFieldRowBusyId(field.id);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const { errorMessage } = await deleteAdminStudyField(token, Number(field.id));
        if (errorMessage) {
          toast.error(errorMessage);
          return;
        }
        if (academicEditingFieldId === field.id) cancelFieldEdit();
        toast.success('Study field deleted.');
        await reloadAcademicCatalog();
      } finally {
        setAcademicFieldRowBusyId(null);
      }
    };

    const noDepartments = departments.length === 0;

    const inputBase =
      'rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#002B5B]/35 focus:ring-2 focus:ring-[#002B5B]/15';

    const academicSearchShell =
      'flex min-h-[42px] w-full items-center gap-2.5 rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-2.5 shadow-sm transition-shadow focus-within:border-[#002B5B]/35 focus-within:ring-2 focus-within:ring-[#002B5B]/15';

    const academicSearchInput =
      'min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-0';

    return (
      <div className="space-y-4">
        <div className="px-1">
          <h2 className="text-2xl font-bold text-slate-900">Academic structure</h2>
        </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-100 bg-white px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#002B5B] shadow-sm ring-1 ring-sky-200/90">
                    <Building2 className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Departments</h3>
                                      </div>
                </div>
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setAcademicDeptSortDesc((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-100/80 hover:text-slate-900"
                >
                  {academicDeptSortDesc ? (
                    <ArrowDownWideNarrow className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                  ) : (
                    <ArrowUpNarrowWide className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                  )}
                  {academicDeptSortDesc ? 'Sort Z → A' : 'Sort A → Z'}
                </button>
              </div>
              <form onSubmit={(ev) => void submitDepartment(ev)} className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-xs font-medium text-slate-600">Add new department</label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <input
                    type="text"
                    value={academicDeptName}
                    onChange={(e) => {
                      setAcademicDeptName(e.target.value);
                      if (academicDeptError) setAcademicDeptError(null);
                    }}
                    placeholder="New department name"
                    suppressHydrationWarning
                    className={cn(
                      'min-h-[42px] flex-1',
                      inputBase,
                      academicDeptError ? 'border-red-300 bg-red-50/40 focus:ring-red-200' : ''
                    )}
                  />
                  <button
                    type="submit"
                    disabled={academicSavingDept}
                    suppressHydrationWarning
                    className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[#20948B] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1a7a72] disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    Add
                  </button>
                </div>
                {academicDeptError ? <p className="mt-2 text-xs font-medium text-red-600">{academicDeptError}</p> : null}
              </form>
            </div>
            <div className="max-h-[min(28rem,55vh)] overflow-y-auto">
              <div className="px-5 py-3">
                <div className={academicSearchShell}>
                  <Search className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                  <input
                    type="text"
                    value={academicDeptSearch}
                    onChange={(e) => setAcademicDeptSearch(e.target.value)}
                    suppressHydrationWarning
                    placeholder="Search departments..."
                    className={academicSearchInput}
                  />
                </div>
              </div>
              {visibleDepartments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Building2 className="h-7 w-7" strokeWidth={1.5} />
                  </div>
                  {departments.length === 0 ? (
                    <>
                      <p className="text-sm font-medium text-slate-700">No departments yet</p>
                      <p className="max-w-xs text-xs leading-relaxed text-slate-500">
                        Create your first department above. Study fields are attached to departments.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-medium text-slate-700">No departments match your search</p>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-sky-100/90">
                  {visibleDepartments.map((dept) => (
                    <li key={dept.id}>
                      <div className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-sky-100/55 sm:flex-row sm:items-center sm:justify-between">
                        {academicEditingDeptId === dept.id ? (
                          <div className="flex min-w-0 flex-1 flex-col gap-3">
                            <input
                              type="text"
                              value={academicEditDeptName}
                              onChange={(e) => setAcademicEditDeptName(e.target.value)}
                              suppressHydrationWarning
                              className={cn('w-full', inputBase)}
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                suppressHydrationWarning
                                disabled={academicDeptRowBusyId === dept.id}
                                onClick={() => void saveDeptEdit()}
                                className="rounded-lg bg-[#20948B] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#1a7a72] disabled:opacity-50"
                              >
                                Save changes
                              </button>
                              <button
                                type="button"
                                suppressHydrationWarning
                                disabled={academicDeptRowBusyId === dept.id}
                                onClick={cancelDeptEdit}
                                className="rounded-lg border border-sky-200 bg-sky-50/70 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-sky-100/70 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-900">{dept.name}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                suppressHydrationWarning
                                title="Edit department"
                                disabled={academicDeptRowBusyId !== null || academicEditingFieldId !== null}
                                onClick={() => {
                                  setAcademicEditingFieldId(null);
                                  setAcademicEditingDeptId(dept.id);
                                  setAcademicEditDeptName(dept.name || '');
                                }}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-[#002B5B] hover:shadow-sm disabled:opacity-40"
                              >
                                <Edit2 className="h-4 w-4" strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                suppressHydrationWarning
                                title="Delete department"
                                disabled={academicDeptRowBusyId !== null || academicEditingFieldId !== null}
                                onClick={() => void handleDeleteDept(dept)}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={2} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-100 bg-white px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#20948B] shadow-sm ring-1 ring-sky-200/90">
                    <Library className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Study fields</h3>
                  </div>
                </div>
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setAcademicFieldSortDesc((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-100/80 hover:text-slate-900"
                >
                  {academicFieldSortDesc ? (
                    <ArrowDownWideNarrow className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                  ) : (
                    <ArrowUpNarrowWide className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                  )}
                  {academicFieldSortDesc ? 'Sort Z → A' : 'Sort A → Z'}
                </button>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-600">Filter by department</label>
                  <select
                    value={academicFieldFilterDeptId}
                    onChange={(e) => setAcademicFieldFilterDeptId(e.target.value)}
                    suppressHydrationWarning
                    className={cn('w-full', inputBase)}
                  >
                    <option value="">All departments</option>
                    {sortedDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <form
                  onSubmit={(ev) => void submitStudyField(ev)}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <label className="mb-2 block text-xs font-medium text-slate-600">Add new study field</label>
                  {noDepartments ? (
                    <p className="mb-3 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                      Add a department first — every study field belongs to one department.
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      value={academicFieldName}
                      onChange={(e) => {
                        setAcademicFieldName(e.target.value);
                        if (academicFieldError) setAcademicFieldError(null);
                      }}
                      placeholder="New study field name"
                      disabled={noDepartments}
                      suppressHydrationWarning
                      className={cn(
                        inputBase,
                        'min-h-[42px]',
                        academicFieldError ? 'border-red-300 bg-red-50/40 focus:ring-red-200' : '',
                        noDepartments ? 'cursor-not-allowed opacity-60' : ''
                      )}
                    />
                    <select
                      value={academicFieldDeptId}
                      onChange={(e) => {
                        setAcademicFieldDeptId(e.target.value);
                        if (academicFieldError) setAcademicFieldError(null);
                      }}
                      disabled={noDepartments}
                      suppressHydrationWarning
                      className={cn(
                        inputBase,
                        'min-h-[42px]',
                        academicFieldError && !academicFieldDeptId ? 'border-red-300' : '',
                        noDepartments ? 'cursor-not-allowed opacity-60' : ''
                      )}
                    >
                      <option value="">Select department</option>
                      {sortedDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={noDepartments || academicSavingField}
                      suppressHydrationWarning
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#20948B] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1a7a72] disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} />
                      Add study field
                    </button>
                  </div>
                  {academicFieldError ? <p className="mt-2 text-xs font-medium text-red-600">{academicFieldError}</p> : null}
                </form>
              </div>
            </div>
            <div className="max-h-[min(28rem,55vh)] overflow-y-auto">
              <div className="px-5 py-3">
                <div className={academicSearchShell}>
                  <Search className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                  <input
                    type="text"
                    value={academicFieldSearch}
                    onChange={(e) => setAcademicFieldSearch(e.target.value)}
                    suppressHydrationWarning
                    placeholder="Search study fields..."
                    className={academicSearchInput}
                  />
                </div>
              </div>
              {visibleStudyFields.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Library className="h-7 w-7" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {studyFields.length === 0 ? 'No study fields yet' : 'No results for this filter'}
                  </p>
                  <p className="max-w-xs text-xs leading-relaxed text-slate-500">
                    {studyFields.length === 0
                      ? 'Add a field and link it to a department, or create departments first.'
                      : 'Try choosing “All departments” or another filter.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-sky-100/90">
                  {visibleStudyFields.map((field) => (
                    <li key={field.id}>
                      <div className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-sky-100/55 sm:flex-row sm:items-center sm:justify-between">
                        {academicEditingFieldId === field.id ? (
                          <div className="flex min-w-0 flex-1 flex-col gap-3">
                            <input
                              type="text"
                              value={academicEditFieldName}
                              onChange={(e) => setAcademicEditFieldName(e.target.value)}
                              suppressHydrationWarning
                              className={cn('w-full', inputBase)}
                              placeholder="Study field name"
                            />
                            <select
                              value={academicEditFieldDeptId}
                              onChange={(e) => setAcademicEditFieldDeptId(e.target.value)}
                              suppressHydrationWarning
                              className={cn('w-full', inputBase)}
                            >
                              <option value="">Select department</option>
                              {sortedDepartments.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                suppressHydrationWarning
                                disabled={academicFieldRowBusyId === field.id}
                                onClick={() => void saveFieldEdit()}
                                className="rounded-lg bg-[#20948B] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#1a7a72] disabled:opacity-50"
                              >
                                Save changes
                              </button>
                              <button
                                type="button"
                                suppressHydrationWarning
                                disabled={academicFieldRowBusyId === field.id}
                                onClick={cancelFieldEdit}
                                className="rounded-lg border border-sky-200 bg-sky-50/70 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-sky-100/70 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-900">{field.name}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex max-w-full items-center rounded-md bg-sky-100/80 px-2 py-0.5 text-xs font-medium text-slate-700">
                                  {departmentNameById.get(field.departmentId) || '—'}
                                </span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                suppressHydrationWarning
                                title="Edit study field"
                                disabled={academicFieldRowBusyId !== null || academicEditingDeptId !== null}
                                onClick={() => {
                                  setAcademicEditingDeptId(null);
                                  setAcademicEditingFieldId(field.id);
                                  setAcademicEditFieldName(field.name || '');
                                  setAcademicEditFieldDeptId(field.departmentId || '');
                                }}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-[#002B5B] hover:shadow-sm disabled:opacity-40"
                              >
                                <Edit2 className="h-4 w-4" strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                suppressHydrationWarning
                                title="Delete study field"
                                disabled={academicFieldRowBusyId !== null || academicEditingDeptId !== null}
                                onClick={() => void handleDeleteField(field)}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={2} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOpportunities = () => {
    if (adminExploreSelectedId) {
      const listOpp = adminOpportunityById.get(adminExploreSelectedId) ?? null;
      const displayOpp = adminExploreDetail ?? listOpp;
      if (adminExploreDetailLoading && !adminExploreDetail && !listOpp) {
        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Loading opportunity details…
          </div>
        );
      }
      if (adminExploreDetailError && !adminExploreDetail && !listOpp) {
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-sm text-red-800">
              {adminExploreDetailError}
            </div>
            <button
              type="button"
              onClick={() => {
                setAdminExploreSelectedId(null);
                setAdminExploreDetail(null);
                setAdminExploreDetailError(null);
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
            setAdminExploreSelectedId(null);
            setAdminExploreDetail(null);
            setAdminExploreDetailError(null);
          }}
          showApplicationStats={false}
          universityAdminCollaboration={
            Number.isFinite(linkedUniversityIdForCollab)
              ? {
                  linkedUniversityId: linkedUniversityIdForCollab,
                  onAccept: () => void submitCollaborationDecision(true),
                  onReject: () => void submitCollaborationDecision(false),
                  busy: collaborationBusy,
                }
              : undefined
          }
        />
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-[#002B5B] tracking-tight">Explore opportunities</h2>
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#002B5B]/10 px-2.5 py-1 text-xs font-semibold text-[#002B5B]">
            <span>{opportunityCountLabel}</span>
            <span className="h-1 w-1 rounded-full bg-[#002B5B]/50" />
            <span>{filteredAdminOpportunities.length}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by title, company, skills, or location…"
              suppressHydrationWarning
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002B5B]/30 focus:border-[#002B5B] outline-none shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(['all', 'active', 'expired'] as const).map((key) => (
              <button
                key={key}
                type="button"
                suppressHydrationWarning
                onClick={() => setOppDeadlineFilter(key)}
                className={cn(
                  'px-4 py-3 rounded-xl text-xs font-bold transition-all border shadow-sm',
                  oppDeadlineFilter === key
                    ? 'bg-[#001F42] text-white border-[#001F42]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {key === 'all' ? 'All' : key === 'active' ? 'Active' : 'Expired'}
              </button>
            ))}
          </div>
        </div>

        {filteredAdminOpportunities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-2">
            <h3 className="text-lg font-bold text-slate-900">No opportunities match this filter</h3>
            <p className="text-sm text-slate-500">Try another deadline filter or broaden your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredAdminOpportunities.map((row) => {
              const opp = adminOpportunityById.get(String(row.opportunityId));
              if (!opp) return null;
              return (
                <div
                  key={row.opportunityId}
                  className={cn(
                    'bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow duration-200 flex flex-col',
                    row.viewerCollaborationStatus === 'PENDING'
                      ? 'border-amber-300 ring-2 ring-amber-400/60 shadow-md shadow-amber-100/40'
                      : 'border-slate-200/80'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-14 h-14 bg-[#002B5B] rounded-lg flex items-center justify-center font-bold text-white text-sm tracking-wide">
                      {getOpportunityCardInitials(opp.companyName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start gap-2">
                        <h3 className="text-base font-bold text-[#002B5B] leading-snug">{opp.title}</h3>
                        {row.viewerCollaborationStatus ? (
                          <span
                            className={cn(
                              'shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full',
                              row.viewerCollaborationStatus === 'PENDING' && 'bg-amber-100 text-amber-900',
                              row.viewerCollaborationStatus === 'APPROVED' && 'bg-emerald-100 text-emerald-900',
                              row.viewerCollaborationStatus === 'REJECTED' && 'bg-slate-200 text-slate-700'
                            )}
                          >
                            {row.viewerCollaborationStatus === 'PENDING'
                              ? 'Awaiting your decision'
                              : row.viewerCollaborationStatus === 'APPROVED'
                                ? 'You approved'
                                : 'You declined'}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-slate-600 text-sm font-medium mt-0.5">{opp.companyName}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="font-semibold text-slate-600">Partner universities (approved): </span>
                        {formatTargetUniversitiesDisplay(opp)}
                      </p>
                      {opp.affiliatedUniversityName?.trim() ? (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <GraduationCap size={12} className="text-slate-400 shrink-0" aria-hidden />
                          <span>{opp.affiliatedUniversityName.trim()}</span>
                        </p>
                      ) : null}
                      <p className="text-xs text-slate-400 mt-1">{formatRelativePosted(opp.createdAt)}</p>
                    </div>
                  </div>

                  <p className="text-slate-600 text-sm mt-4 leading-relaxed line-clamp-2">
                    {opp.description || 'No description provided.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} className="flex-shrink-0 text-slate-400" />
                      {opp.location?.trim() || '—'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Building2 size={14} className="flex-shrink-0 text-slate-400" />
                      {(opp.workMode && (formatExploreWorkMode(opp.workMode) || opp.workMode)) || '—'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} className="flex-shrink-0 text-slate-400" />
                      {opp.duration ? formatDbDuration(opp.duration) : '—'}
                    </span>
                  </div>

                  <div className="mt-4 min-h-[1.5rem]">
                    {opp.requiredSkills && opp.requiredSkills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {opp.requiredSkills.slice(0, 6).map((skill) => (
                          <span
                            key={skill}
                            className="px-2.5 py-1 rounded-md bg-sky-100/90 text-xs font-semibold text-sky-900"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No skills listed</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
                    <span className="text-xs font-medium text-slate-500">
                      {typeof opp.applicantCount === 'number'
                        ? `${opp.applicantCount} applicant${opp.applicantCount === 1 ? '' : 's'}`
                        : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void openOpportunityDetail(row.opportunityId)}
                      suppressHydrationWarning
                      className="px-4 py-2 border-2 border-[#002B5B] text-[#002B5B] bg-white rounded-xl text-sm font-bold hover:bg-slate-50 transition-all whitespace-nowrap"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderPpas = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 shadow-sm p-4 backdrop-blur-[2px]">
        <h2 className="text-lg font-bold text-[#002B5B] mb-4">{editingPpa ? 'Update PP Approver' : 'Create PP Approver'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-blue-900/55 mb-1">Full name</label>
            <input
              className="w-full rounded-xl border border-blue-200/80 bg-white/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#002B5B]/40 focus:ring-2 focus:ring-[#002B5B]/15 outline-none"
              placeholder="Full name"
              value={ppaForm.fullName}
              onChange={(e) => setPpaForm((s) => ({ ...s, fullName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-blue-900/55 mb-1">Email</label>
            <input
              className={`w-full rounded-xl border border-blue-200/80 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[#002B5B]/40 focus:ring-2 focus:ring-[#002B5B]/15 outline-none ${
                editingPpa
                  ? 'bg-slate-100/90 text-slate-600 cursor-not-allowed'
                  : 'bg-white/90 text-slate-900'
              }`}
              placeholder="Email"
              value={ppaForm.email}
              readOnly={!!editingPpa}
              title={editingPpa ? 'Email is tied to Supabase login and cannot be changed here.' : undefined}
              onChange={(e) => {
                if (editingPpa) return;
                setPpaForm((s) => ({ ...s, email: e.target.value }));
              }}
            />
            {editingPpa ? (
              <p className="mt-1 text-[11px] text-blue-900/45">Email cannot be edited (linked to authentication).</p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-semibold text-blue-900/55 mb-1">Department</label>
            <select
              className="w-full rounded-xl border border-blue-200/80 px-3 py-2 text-sm bg-white/90 text-slate-900 focus:border-[#002B5B]/40 focus:ring-2 focus:ring-[#002B5B]/15 outline-none"
              value={ppaForm.departmentId}
              onChange={(e) => {
                const nextDepartment = e.target.value;
                setStudyFieldPickerKey((k) => k + 1);
                setPpaForm((s) => ({ ...s, departmentId: nextDepartment, studyFieldIds: [] }));
              }}
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-blue-900/55 mb-1">Study fields</label>
            {!ppaForm.departmentId ? (
              <div className="w-full rounded-xl border border-dashed border-blue-200/70 bg-blue-50/60 px-3 py-2.5 text-sm text-blue-800/45">
                Select a department first
              </div>
            ) : fieldsForSelectedDepartment.length === 0 ? (
              <div className="w-full rounded-xl border border-blue-200/60 bg-blue-50/50 px-3 py-2.5 text-sm text-blue-900/55">
                No study fields for this department.
              </div>
            ) : (
              <select
                key={studyFieldPickerKey}
                className="w-full rounded-xl border border-blue-200/80 px-3 py-2 text-sm bg-white/90 disabled:bg-blue-50/50 disabled:text-blue-900/35 focus:border-[#002B5B]/40 focus:ring-2 focus:ring-[#002B5B]/15 outline-none"
                defaultValue=""
                disabled={fieldsAvailableToAdd.length === 0}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  addStudyFieldFromPicker(v);
                  setStudyFieldPickerKey((k) => k + 1);
                }}
              >
                <option value="">
                  {fieldsAvailableToAdd.length === 0
                    ? 'All study fields for this department are added'
                    : 'Add a study field…'}
                </option>
                {fieldsAvailableToAdd.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        {ppaForm.departmentId && ppaForm.studyFieldIds.length > 0 ? (
          <div className="mt-2 rounded-xl border border-blue-200/70 p-2.5 bg-blue-100/35">
            <p className="text-xs font-semibold text-blue-900/50 mb-2">Selected study fields</p>
            <div className="flex flex-wrap gap-2">
              {ppaForm.studyFieldIds.map((id) => {
                const f = studyFields.find((x) => x.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs font-semibold bg-[#002B5B]/10 text-[#002B5B] border border-[#002B5B]/20"
                  >
                    {f?.name ?? id}
                    <button
                      type="button"
                      onClick={() => removeStudyFieldFromPicker(id)}
                      className="p-0.5 rounded-full hover:bg-[#002B5B]/20 text-[#002B5B]"
                      aria-label={`Remove ${f?.name ?? id}`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void savePpa()}
            disabled={isSavingPpa}
            className="px-4 py-2 rounded-xl bg-[#002B5B] text-white text-sm font-bold hover:bg-[#001F42] disabled:opacity-60"
          >
            {isSavingPpa ? 'Saving…' : editingPpa ? 'Update PPA' : 'Create PPA'}
          </button>
          <button
            onClick={openCreatePpa}
            className="px-4 py-2 rounded-xl border border-blue-200/80 bg-white/70 text-sm font-semibold text-[#002B5B] hover:bg-blue-100/50"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 shadow-sm p-4 backdrop-blur-[2px]">
        <h2 className="text-lg font-bold text-[#002B5B] mb-3">Import PPAs from File</h2>
        <p className="text-sm text-blue-900/55 mb-3">
          Upload a <strong>.csv</strong>, <strong>.xlsx</strong>, or <strong>.xls</strong> file.
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={csvFileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => csvFileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#002B5B] text-white text-sm font-bold hover:bg-[#001F42] disabled:opacity-60"
          >
            <Upload size={16} />
            Upload CSV / Excel
          </button>
        </div>
        {csvImportResult && (
          <div className="mt-3 rounded-xl border border-blue-200/70 p-3 bg-blue-100/35">
            <div className="flex gap-4 text-sm font-semibold mb-1">
              {csvImportResult.created > 0 && (
                <span className="text-emerald-700">{csvImportResult.created} created</span>
              )}
              {csvImportResult.failed > 0 && (
                <span className="text-red-600">{csvImportResult.failed} failed</span>
              )}
              {csvImportResult.created === 0 && csvImportResult.failed === 0 && (
                <span className="text-blue-900/55">No rows found in file.</span>
              )}
            </div>
            {csvImportResult.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-red-700 max-h-40 overflow-y-auto">
                {csvImportResult.errors.map((err, i) => (
                  <li key={i} className="flex gap-1">
                    <span className="shrink-0">•</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-blue-200/60 w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-[#002B5B] mb-1">Map File Columns</h2>
            <p className="text-sm text-blue-900/55 mb-5">
              Select which column in your file corresponds to each field.
            </p>
            {([
              { label: 'Name', key: 'nameColumn' as const },
              { label: 'Email', key: 'emailColumn' as const },
              { label: 'Department', key: 'departmentColumn' as const },
              { label: 'Study Field', key: 'studyFieldColumn' as const },
            ]).map(({ label, key }) => (
              <div key={key} className="flex items-center gap-4 mb-4">
                <span className="w-28 text-sm font-semibold text-[#002B5B] shrink-0">{label}</span>
                <select
                  value={importMapping[key]}
                  onChange={(e) => setImportMapping(prev => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-xl border border-blue-200/80 bg-white text-sm focus:ring-2 focus:ring-[#002B5B]/25 focus:border-[#002B5B]/35 outline-none"
                >
                  <option value="">Select column</option>
                  {importHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowImportModal(false); setImportFile(null); }}
                className="px-4 py-2 rounded-xl border border-blue-200/80 bg-white/70 text-sm font-semibold text-[#002B5B] hover:bg-blue-100/50"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowImportModal(false); void handleImportSubmit(); }}
                disabled={csvImporting || !importMapping.nameColumn || !importMapping.emailColumn || !importMapping.departmentColumn || !importMapping.studyFieldColumn}
                className="px-4 py-2 rounded-xl bg-[#002B5B] text-white text-sm font-bold hover:bg-[#001F42] disabled:opacity-60"
              >
                {csvImporting ? 'Importing…' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-blue-200/60 bg-blue-50/35 shadow-sm overflow-hidden backdrop-blur-[2px]">
        <div className="p-4 border-b border-blue-200/60 flex justify-between items-center bg-blue-100/50">
          <h2 className="text-lg font-bold text-[#002B5B]">PP Approvers</h2>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={16} />
              <input
                type="text"
                placeholder="Search PPA..."
                className="pl-10 pr-4 py-2 bg-white/95 border border-blue-200/80 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B]/25 focus:border-[#002B5B]/35 outline-none w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto bg-blue-50/30">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-blue-100/70 text-blue-900/75 text-xs font-bold uppercase tracking-wider">
                <th className="px-5 py-3.5">Full Name</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Assigned Study Fields</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/80">
              {filteredPpas.map((ppa) => (
                <tr key={ppa.id} className="bg-white/55 hover:bg-blue-100/40 transition-all">
                  <td className="px-5 py-3.5 font-bold text-slate-900">{ppa.fullName}</td>
                  <td className="px-5 py-3.5 text-sm text-blue-950/70">{ppa.email}</td>
                  <td className="px-5 py-3.5 text-sm text-blue-950/70">{ppa.departmentName}</td>
                  <td className="px-5 py-3.5 text-sm text-blue-950/70">
                    {ppa.assignedStudyFields.map((f) => f.name).join(', ') || '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 text-blue-400 hover:text-[#002B5B] hover:bg-blue-100/80 rounded-lg transition-all" onClick={() => openEditPpa(ppa)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" onClick={() => void removePpa(ppa)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPpas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-blue-900/45">
                    No PP approvers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderEditUniversityProfileModal = () => {
    if (!isEditingUniProfile || !uniProfileDraft) return null;
    return (
      <div
        className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-10 sm:py-14 md:items-center md:py-8"
        role="presentation"
        onClick={closeUniProfileModal}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-uni-profile-title"
          className="relative my-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <h3 id="edit-uni-profile-title" className="text-xl font-bold text-slate-900 sm:text-2xl">
              Edit university profile
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeUniProfileModal}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={closeUniProfileModal}
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
                  <span className="font-semibold text-slate-700">University name</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={uniProfileDraft.name ?? ''}
                    onChange={(e) => setUniProfileDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-700">Headquarters / location</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={uniProfileDraft.location ?? ''}
                    onChange={(e) => setUniProfileDraft((d) => (d ? { ...d, location: e.target.value } : d))}
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="font-semibold text-slate-700">Overview / description</span>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={uniProfileDraft.description ?? ''}
                    onChange={(e) => setUniProfileDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-700">Website</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={uniProfileDraft.website ?? ''}
                    onChange={(e) => setUniProfileDraft((d) => (d ? { ...d, website: e.target.value } : d))}
                  />
                </label>
                <div className="block text-sm">
                  <span className="font-semibold text-slate-700">Contact email</span>
                  <p className="mt-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {(uniProfileDraft.email ?? '').trim() || '—'}
                  </p>
                </div>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-700">Number of employees</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={uniProfileDraft.employeeCount ?? ''}
                    onChange={(e) =>
                      setUniProfileDraft((d) =>
                        d
                          ? {
                              ...d,
                              employeeCount: e.target.value === '' ? null : Number(e.target.value),
                            }
                          : d
                      )
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold text-slate-700">Founded year</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={uniProfileDraft.foundedYear ?? ''}
                    onChange={(e) =>
                      setUniProfileDraft((d) =>
                        d
                          ? {
                              ...d,
                              foundedYear: e.target.value === '' ? null : Number(e.target.value),
                            }
                          : d
                      )
                    }
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="font-semibold text-slate-700">Specialties</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={uniProfileDraft.specialties ?? ''}
                    onChange={(e) => setUniProfileDraft((d) => (d ? { ...d, specialties: e.target.value } : d))}
                  />
                </label>
                <div className="block text-sm md:col-span-2">
                  <span className="font-semibold text-slate-700">Logo</span>
                  <input
                    ref={uniLogoFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setUniProfileLogoFile(f);
                      e.target.value = '';
                    }}
                  />
                  <div className="mt-2 space-y-2">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {(uniLogoObjectUrl || uniProfileDraft.logoUrl)?.trim() ? (
                        <Image
                          src={uniLogoObjectUrl || uniProfileDraft.logoUrl || ''}
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
                        onClick={() => uniLogoFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Upload size={14} />
                        Upload logo
                      </button>
                      {(uniLogoObjectUrl || uniProfileDraft.logoUrl)?.trim() ? (
                        <button
                          type="button"
                          onClick={() => {
                            setUniProfileLogoFile(null);
                            setUniProfileDraft((d) => (d ? { ...d, logoUrl: '' } : d));
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
                    ref={uniCoverFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setUniProfileCoverFile(f);
                      e.target.value = '';
                    }}
                  />
                  <div className="mt-2 space-y-2">
                    <div className="h-28 w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {(uniCoverObjectUrl || uniProfileDraft.coverUrl)?.trim() ? (
                        <div
                          className="h-full w-full bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${uniCoverObjectUrl || uniProfileDraft.coverUrl})`,
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
                        onClick={() => uniCoverFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Upload size={14} />
                        Upload cover
                      </button>
                      {(uniCoverObjectUrl || uniProfileDraft.coverUrl)?.trim() ? (
                        <button
                          type="button"
                          onClick={() => {
                            setUniProfileCoverFile(null);
                            setUniProfileDraft((d) => (d ? { ...d, coverUrl: '' } : d));
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
                onClick={() => void saveUniProfile()}
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

  const renderCompaniesPartnerships = () => {
    const browseId = partnershipCompanyBrowseId;
    if (browseId != null) {
      const row = partnershipCompanies.find((r) => r.companyId === browseId);
      const partnershipRow: InstitutionalPartnershipCompanyRow =
        row ??
        ({
          companyId: browseId,
          companyName: '',
          industry: null,
          status: 'NONE',
          requestedByRole: null,
          requestedById: null,
          canRequest: true,
          canAccept: false,
          canReject: false,
          canEnd: false,
        } satisfies InstitutionalPartnershipCompanyRow);

      const statusDisplay = (r: InstitutionalPartnershipCompanyRow) => {
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
                <span className="text-xs text-slate-600">Waiting for the company to respond.</span>
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

      if (partnershipCompanyBrowseOppSelectedId) {
        const listOpp =
          partnershipCompanyBrowseOpportunities.find(
            (o) => String(o.id) === partnershipCompanyBrowseOppSelectedId
          ) ?? null;
        const displayOpp = partnershipCompanyBrowseOppDetail ?? listOpp;
        if (partnershipCompanyBrowseOppLoading && !displayOpp) {
          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
              Loading opportunity details…
            </div>
          );
        }
        if (partnershipCompanyBrowseOppError && !displayOpp) {
          return (
            <div className="space-y-4">
              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-sm text-red-800">
                {partnershipCompanyBrowseOppError}
              </div>
              <button
                type="button"
                onClick={closePartnershipCompanyBrowseOpportunity}
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
            onBack={closePartnershipCompanyBrowseOpportunity}
            showApplicationStats={false}
            universityAdminCollaboration={
              Number.isFinite(linkedUniversityIdForCollab)
                ? {
                    linkedUniversityId: linkedUniversityIdForCollab,
                    onAccept: () => void submitCollaborationDecision(true),
                    onReject: () => void submitCollaborationDecision(false),
                    busy: collaborationBusy,
                  }
                : undefined
            }
          />
        );
      }

      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={closePartnershipCompanyProfile}
            className="text-sm font-bold text-[#002B5B] hover:text-[#001F42] text-left"
          >
            ← Back to companies
          </button>

          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between bg-gradient-to-b from-slate-50/95 to-white border-b border-slate-100/90">
              <div className="min-w-0 flex flex-wrap items-center gap-3">{statusDisplay(partnershipRow)}</div>
              <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                {partnershipRow.canRequest ? (
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => void handleAdminPartnershipRequest(browseId)}
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
                      onClick={() => void handleAdminPartnershipRespond(browseId, true)}
                      className="inline-flex items-center justify-center min-h-9 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={rowBusy}
                      onClick={() => void handleAdminPartnershipRespond(browseId, false)}
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
                    onClick={() => void handleAdminPartnershipEnd(browseId)}
                    className="inline-flex items-center justify-center min-h-9 rounded-lg border border-red-200 bg-red-50/90 px-3.5 text-sm font-semibold text-red-800 shadow-sm hover:bg-red-100 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    End collaboration
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {partnershipCompanyBrowseLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500 text-sm font-medium">
              <Loader2 className="animate-spin" size={20} />
              Loading profile…
            </div>
          ) : partnershipCompanyBrowseProfile ? (
            <CompanyProfileTabbedView
              profile={partnershipCompanyBrowseProfile}
              section={partnershipCompanyBrowseSection}
              onSectionChange={setPartnershipCompanyBrowseSection}
              canEditProfile={false}
              aboutLoading={false}
              opportunitiesPanel={
                <>
                  <h3 className="text-3xl font-bold text-slate-900 mb-4">
                    {partnershipCompanyBrowseOpportunities.length} Opportunities available
                  </h3>
                  <div className="space-y-3">
                    {!partnershipCompanyBrowseOpportunities.length ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-10 text-center text-sm text-slate-500">
                        No published opportunities from this company include your university as a target yet (the same
                        scope as Explore).
                      </div>
                    ) : (
                      partnershipCompanyBrowseOpportunities.map((opp) => (
                        <OpportunityRecordCard
                          key={opp.id}
                          opportunity={opp}
                          onViewDetails={() => void openPartnershipCompanyBrowseOpportunity(Number(opp.id))}
                        />
                      ))
                    )}
                  </div>
                </>
              }
            />
          ) : (
            <p className="text-sm text-slate-500">Could not load company profile.</p>
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

    const listStatusDisplay = (r: InstitutionalPartnershipCompanyRow) => {
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
                Waiting for the company
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
          <h1 className="text-3xl font-extrabold text-[#002B5B]">Companies</h1>
          <p className="mt-1 text-sm text-slate-600">
            Institutional partners are global pairings with a company, separate from collaboration on individual opportunities. Click a company name to open its full profile; you can also act from this table.
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
            placeholder="Search company or industry…"
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#002B5B]/20 focus:border-[#002B5B] outline-none shadow-sm"
            value={partnershipSearch}
            onChange={(e) => setPartnershipSearch(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {partnershipCompaniesLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm font-medium">
              <Loader2 className="animate-spin" size={20} />
              Loading companies…
            </div>
          ) : partnershipCompanies.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-500">No companies are available yet.</p>
          ) : filteredPartnershipCompanies.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-500">No companies match this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#002B5B] text-white text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4 text-left">Company</th>
                    <th className="px-6 py-4 text-left">Industry</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPartnershipCompanies.map((row) => (
                    <tr key={row.companyId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => void openPartnershipCompanyProfile(row.companyId)}
                          className="text-left text-sm font-semibold text-[#002B5B] hover:underline focus:outline-none focus:ring-2 focus:ring-[#002B5B]/30 rounded"
                        >
                          {row.companyName}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{row.industry?.trim() || '—'}</td>
                      <td className="px-6 py-4 text-center">{listStatusDisplay(row)}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {row.canRequest ? (
                            <button
                              type="button"
                              disabled={rowBusy(row.companyId)}
                              onClick={() => void handleAdminPartnershipRequest(row.companyId)}
                              className="inline-flex items-center justify-center min-h-9 rounded-lg bg-[#002B5B] px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#001F42] disabled:opacity-50 disabled:pointer-events-none"
                            >
                              {rowBusy(row.companyId) ? '…' : 'Request collaboration'}
                            </button>
                          ) : null}
                          {row.canAccept ? (
                            <>
                              <button
                                type="button"
                                disabled={rowBusy(row.companyId)}
                                onClick={() => void handleAdminPartnershipRespond(row.companyId, true)}
                                className="inline-flex items-center justify-center min-h-9 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                disabled={rowBusy(row.companyId)}
                                onClick={() => void handleAdminPartnershipRespond(row.companyId, false)}
                                className="inline-flex items-center justify-center min-h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                          {row.canEnd ? (
                            <button
                              type="button"
                              disabled={rowBusy(row.companyId)}
                              onClick={() => void handleAdminPartnershipEnd(row.companyId)}
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

  const renderUniversityProfile = () => (
    <div className="space-y-6">
      {uniProfileLoading && !uniProfile ? (
        <p className="text-sm text-slate-500">Loading profile…</p>
      ) : uniProfile ? (
        <UniversityProfileReadOnlyView
          profile={uniProfile}
          mediaRev={uniProfileMediaRev}
          canEditProfile={canEditUniProfile}
          onEditProfile={beginEditUniProfile}
        />
      ) : (
        <p className="text-sm text-slate-600">Could not load university profile.</p>
      )}
      {renderEditUniversityProfileModal()}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            {isLoading ? (
              <p className="text-sm text-slate-500 mb-4">Loading dashboard data…</p>
            ) : null}
            {renderStats()}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                {renderStudents()}
              </div>
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Building2 size={18} className="text-[#002B5B]" />
                    Top Companies
                  </h3>
                  <div className="space-y-4">
                    {adminCompanies.slice(0, 3).map((company) => (
                      <div key={company.companyId} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all cursor-pointer">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-400">
                          {company.name[0]}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{company.name}</div>
                          <div className="text-xs text-slate-500">{company.industry || '—'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-[#002B5B] p-6 rounded-2xl text-white shadow-xl shadow-indigo-500/20">
                  <h3 className="font-bold mb-2">Quick Actions</h3>
                  <p className="text-indigo-100 text-xs mb-4">Manage your academic structure and users efficiently.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button suppressHydrationWarning className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">New PPA</button>
                    <button suppressHydrationWarning className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">Export Data</button>
                    <button suppressHydrationWarning className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">Settings</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      case 'profile':
        return renderUniversityProfile();
      case 'students':
        return renderStudents();
      case 'ppa':
        return renderPpas();
      case 'academic':
        return renderAcademic();
      case 'opportunities':
        return renderOpportunities();
      case 'companies':
        return renderCompaniesPartnerships();
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
          onActivateOpportunity={(opportunityId) => {
            openOpportunityFromNotification(opportunityId);
            close();
          }}
          onActivatePartnership={(ctx) => {
            onNavigateTab?.('companies');
            void loadPartnershipCompanies();
            const cid = ctx.partnershipCompanyId;
            if (cid != null) void openPartnershipCompanyProfile(cid);
            close();
          }}
          className="max-w-none mx-0 h-full min-h-0 flex flex-col shadow-2xl ring-1 ring-slate-200/80"
        />
      )}
    >
      {renderContent()}
      {viewStudentProfileId != null ? (
        <ViewerStudentProfileOverlay
          studentId={viewStudentProfileId}
          onClose={() => setViewStudentProfileId(null)}
          apiSegment="admin"
        />
      ) : null}
    </Dashboard>
  );
};

export default UniversityAdminDashboard;
