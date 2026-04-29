'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { MutableRefObject } from 'react';
import Dashboard from './Dashboard';
import AddStudentForm from './AddStudentForm';
import ImportCSVForm from './ImportCSVForm';
import UnderDevelopment from './UnderDevelopment';
import {
  createAdminPpa,
  deleteAdminPpa,
  createAdminStudent,
  fetchAdminApplications,
  fetchAdminCompanies,
  fetchAdminDashboardStats,
  fetchAdminDepartments,
  fetchAdminOpportunities,
  fetchAdminPpas,
  fetchAdminStudents,
  fetchAdminStudyFields,
  mapApplicationResponseToApplication,
  updateAdminPpa,
} from '@/src/lib/auth/admin';
import { getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import type { Application, DashboardStats, Department, PPAApprover, Student, StudyField } from '@/src/types';
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
  Trash2,
  Edit2,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface UniversityAdminDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  onToggleSidebar?: () => void;
  accessToken?: string | null;
  accessTokenRef?: MutableRefObject<string | null>;
}

const UniversityAdminDashboard: React.FC<UniversityAdminDashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
  onToggleSidebar,
  accessToken,
  accessTokenRef,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isImportingCSV, setIsImportingCSV] = useState(false);
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
  const [adminOpportunities, setAdminOpportunities] = useState<
    { opportunityId: number; title: string | null; companyName: string | null; deadline: string | null; type: string | null }[]
  >([]);
  const [adminApplications, setAdminApplications] = useState<Application[]>([]);
  const [adminCompanies, setAdminCompanies] = useState<{ companyId: number; name: string; industry: string | null }[]>([]);
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

  const resolveAccessToken = async (): Promise<string | null> => {
    const fromRef = accessTokenRef?.current?.trim();
    if (fromRef) return fromRef;
    const fromProp = accessToken?.trim();
    if (fromProp) return fromProp;
    return getSessionAccessToken();
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const token = await resolveAccessToken();
        if (!token) {
          toast.error('Not signed in.');
          return;
        }
        const [
          studentsRes,
          departmentsRes,
          fieldsRes,
          statsRes,
          oppsRes,
          appsRes,
          companiesRes,
          ppasRes,
        ] = await Promise.all([
          fetchAdminStudents(token),
          fetchAdminDepartments(token),
          fetchAdminStudyFields(token),
          fetchAdminDashboardStats(token),
          fetchAdminOpportunities(token, 100),
          fetchAdminApplications(token),
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
        if (oppsRes.errorMessage) toast.error(oppsRes.errorMessage);
        else if (oppsRes.data) setAdminOpportunities(oppsRes.data);
        if (appsRes.errorMessage) toast.error(appsRes.errorMessage);
        else if (appsRes.data) setAdminApplications(appsRes.data.map(mapApplicationResponseToApplication));
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
  }, [accessToken]);

  const filteredStudents = useMemo(
    () =>
      students.filter((student) =>
        `${student.fullName} ${student.email}`.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [students, searchTerm]
  );

  const filteredAdminOpportunities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return adminOpportunities;
    return adminOpportunities.filter(
      (o) =>
        (o.title || '').toLowerCase().includes(q) ||
        (o.companyName || '').toLowerCase().includes(q) ||
        (o.type || '').toLowerCase().includes(q)
    );
  }, [adminOpportunities, searchTerm]);

  const filteredAdminApplications = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return adminApplications;
    return adminApplications.filter(
      (a) =>
        `${a.studentName} ${a.opportunityTitle} ${a.companyName}`.toLowerCase().includes(q)
    );
  }, [adminApplications, searchTerm]);

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
    if (isAddingStudent) {
      return (
        <AddStudentForm 
          onSave={async (newStudent) => {
            const token = await resolveAccessToken();
            if (!token) {
              toast.error('Not signed in.');
              return;
            }
            const deptId = parseInt(String(newStudent.departmentId), 10);
            const fieldId = parseInt(String(newStudent.studyFieldId), 10);
            if (Number.isNaN(deptId) || Number.isNaN(fieldId)) {
              toast.error('Invalid department or study field.');
              return;
            }
            const { data: created, errorMessage } = await createAdminStudent(token, {
              fullName: newStudent.fullName,
              email: newStudent.email,
              departmentId: deptId,
              studyFieldId: fieldId,
              studyYear: newStudent.studyYear,
              cgpa: newStudent.cgpa,
            });
            if (!created || errorMessage) {
              toast.error(errorMessage || 'Could not create student.');
              return;
            }
            setStudents((prev) => [created, ...prev]);
            setStats((prev) => ({ ...prev, totalStudents: prev.totalStudents + 1 }));
            setIsAddingStudent(false);
          }} 
          onCancel={() => setIsAddingStudent(false)} 
          departments={departments}
          studyFields={studyFields}
        />
      );
    }

    if (isImportingCSV) {
      return (
        <ImportCSVForm 
          entityName="Students" 
          onImport={(data) => {
            // Mock import
            setIsImportingCSV(false);
          }} 
          onCancel={() => setIsImportingCSV(false)} 
        />
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900">Student Management</h2>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search students..." 
                suppressHydrationWarning
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsAddingStudent(true)}
              suppressHydrationWarning
              className="flex items-center gap-2 px-4 py-2 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#001F42] transition-all shadow-lg shadow-indigo-500/20"
            >
              <Plus size={16} />
              Add Student
            </button>
            <button 
              onClick={() => setIsImportingCSV(true)}
              suppressHydrationWarning
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
            >
              <Upload size={16} />
              Import CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Student ID</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Study Year</th>
                <th className="px-6 py-4">CGPA</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{student.id}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{student.fullName}</div>
                    <div className="text-xs text-slate-500">{student.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{student.departmentId}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{student.studyYear}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-[#002B5B]/10 text-[#002B5B] rounded-lg text-xs font-bold">
                      {student.cgpa}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-all">
                    <div className="flex justify-end gap-2">
                      <button 
                        suppressHydrationWarning
                        className="p-2 text-slate-400 hover:text-[#002B5B] hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        suppressHydrationWarning
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAcademic = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900">Departments</h2>
          <button suppressHydrationWarning className="p-2 bg-[#20948B] text-white rounded-lg hover:bg-[#1a7a72] transition-all">
            <Plus size={16} />
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {departments.map((dept) => (
            <div key={dept.id} className="p-6 flex justify-between items-center hover:bg-slate-50 transition-all">
              <div>
                <div className="font-bold text-slate-900">{dept.name}</div>
                <div className="text-xs text-slate-500 font-mono uppercase tracking-tighter">{dept.id}</div>
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{dept.universityName}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900">Study Fields</h2>
          <button suppressHydrationWarning className="p-2 bg-[#20948B] text-white rounded-lg hover:bg-[#1a7a72] transition-all">
            <Plus size={16} />
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {studyFields.map((field) => (
            <div key={field.id} className="p-6 flex justify-between items-center hover:bg-slate-50 transition-all">
              <div>
                <div className="font-bold text-slate-900">{field.name}</div>
                <div className="text-xs text-slate-500 font-mono uppercase tracking-tighter">{field.id}</div>
              </div>
              <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Dept: {field.departmentId}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderOpportunities = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900">All Internship Opportunities</h2>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search opportunities..." 
              suppressHydrationWarning
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {filteredAdminOpportunities.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">No opportunities found.</div>
        ) : (
          filteredAdminOpportunities.map((opp) => (
            <div key={opp.opportunityId} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#002B5B]/10 text-[#002B5B] rounded-lg flex items-center justify-center font-bold">
                  {(opp.title || '?')[0]}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{opp.title || '—'}</div>
                  <div className="text-xs text-slate-500">
                    {opp.companyName || '—'} • Deadline: {opp.deadline || '—'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {opp.type || '—'}
                </span>
                <button suppressHydrationWarning className="text-[#002B5B] text-xs font-bold hover:underline">View Details</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderApplications = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900">All Applications Monitor</h2>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search applications..." 
              suppressHydrationWarning
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none w-64"
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
              <th className="px-6 py-4">Student</th>
              <th className="px-6 py-4">Opportunity</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAdminApplications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                  No applications yet.
                </td>
              </tr>
            ) : (
              filteredAdminApplications.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50 transition-all">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{app.studentName}</div>
                    <div className="text-xs text-slate-500">ID: {app.studentId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{app.opportunityTitle}</div>
                    <div className="text-xs text-slate-500">{app.companyName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                      app.type === 'PROFESSIONAL_PRACTICE' ? "bg-[#002B5B]/10 text-[#002B5B]" : "bg-slate-100 text-slate-700"
                    )}>
                      {app.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      app.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700" :
                      app.status === 'REJECTED' ? "bg-red-50 text-red-700" :
                      "bg-amber-50 text-amber-700"
                    )}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">{app.createdAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPpas = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-200/60 bg-blue-50/40 shadow-sm p-4 backdrop-blur-[2px]">
        <h2 className="text-lg font-bold text-[#002B5B] mb-4">{editingPpa ? 'Update PP Approver' : 'Create PP Approver'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="rounded-xl border border-blue-200/80 bg-white/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#002B5B]/40 focus:ring-2 focus:ring-[#002B5B]/15 outline-none"
            placeholder="Full name"
            value={ppaForm.fullName}
            onChange={(e) => setPpaForm((s) => ({ ...s, fullName: e.target.value }))}
          />
          <input
            className="rounded-xl border border-blue-200/80 bg-white/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#002B5B]/40 focus:ring-2 focus:ring-[#002B5B]/15 outline-none"
            placeholder="Email"
            value={ppaForm.email}
            onChange={(e) => setPpaForm((s) => ({ ...s, email: e.target.value }))}
          />
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
                    <button suppressHydrationWarning className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">New Student</button>
                    <button suppressHydrationWarning className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">New PPA</button>
                    <button suppressHydrationWarning className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">Export Data</button>
                    <button suppressHydrationWarning className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">Settings</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      case 'students':
        return renderStudents();
      case 'ppa':
        return renderPpas();
      case 'academic':
        return renderAcademic();
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
      title={`Hello, ${currentUserName}`}
      userName={currentUserName}
      userRole={currentUserRoleLabel}
      onToggleSidebar={onToggleSidebar}
    >
      {renderContent()}
    </Dashboard>
  );
};

export default UniversityAdminDashboard;
