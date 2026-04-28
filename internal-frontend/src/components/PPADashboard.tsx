'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Dashboard from './Dashboard';
import UnderDevelopment from './UnderDevelopment';
import { fetchPpaApplications, fetchPpaStudents, fetchPpaMyStudents } from '@/src/lib/auth/ppa';
import { mapAdminStudentToStudent } from '@/src/lib/auth/admin';
import type { AdminStudentRow } from '@/src/lib/auth/admin';
import type { ApplicationResponse } from '@/src/lib/auth/opportunities';
import { getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import type { Student } from '@/src/types';
import type { Application, PPA } from '@/src/types';

import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  ArrowRight,
  FileText,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';

interface PPADashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  onToggleSidebar?: () => void;
}

const PPADashboard: React.FC<PPADashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
  onToggleSidebar,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [myStudents, setMyStudents] = useState<AdminStudentRow[]>([]);
  const [myStudentsLoading, setMyStudentsLoading] = useState(false);
  const [myStudentsError, setMyStudentsError] = useState<string | null>(null);
  const [showStudentFilters, setShowStudentFilters] = useState(false);
  const [myStudentsSearch, setMyStudentsSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<AdminStudentRow | null>(null);
  const [studentYearFilter, setStudentYearFilter] = useState<string[]>([]);
  const [studentFieldFilter, setStudentFieldFilter] = useState<string[]>([]);
  const [studentAppFilter, setStudentAppFilter] = useState<string[]>([]);
  const [studentStatusFilter, setStudentStatusFilter] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = await getSessionAccessToken();
      if (!accessToken) {
        toast.error('Not signed in.');
        return;
      }
      const [appsRes, studentsRes] = await Promise.all([
        fetchPpaApplications(accessToken),
        fetchPpaStudents(accessToken),
      ]);
      if (appsRes.errorMessage) toast.error(appsRes.errorMessage);
      else setApplications(appsRes.data || []);
      if (studentsRes.errorMessage) toast.error(studentsRes.errorMessage);
      else if (studentsRes.data) {
        setStudents(studentsRes.data.map(mapAdminStudentToStudent));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load PPA data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const load = async () => {
      setMyStudentsLoading(true);
      setMyStudentsError(null);
      try {
        const accessToken = await getSessionAccessToken();
        if (!accessToken) {
          setMyStudentsError('Not signed in.');
          return;
        }
        const res = await fetchPpaMyStudents(accessToken);
        if (res.errorMessage) {
          setMyStudentsError(res.errorMessage);
        } else {
          setMyStudents(res.data || []);
        }
      } catch (e) {
        setMyStudentsError(e instanceof Error ? e.message : 'Could not load students.');
      } finally {
        setMyStudentsLoading(false);
      }
    };
    void load();
  }, []);

  const filteredApplications = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = applications.filter((a) => {
      const t = (a.applicationType || '').toUpperCase();
      return t === 'PROFESSIONAL_PRACTICE' || t.includes('PROFESSIONAL');
    });
    if (!q) return base;
    return base.filter((a) => {
      const hay = `${a.studentName ?? ''} ${a.opportunityTitle ?? ''} ${a.companyName ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [applications, searchTerm]);

  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => `${s.fullName} ${s.email}`.toLowerCase().includes(q));
  }, [students, searchTerm]);

  const pendingPpaCount = useMemo(
    () =>
      applications.filter((a) => {
        const t = (a.applicationType || '').toUpperCase();
        const isPp = t === 'PROFESSIONAL_PRACTICE' || t.includes('PROFESSIONAL');
        return isPp && a.isApprovedByPPA == null;
      }).length,
    [applications]
  );

  const approvedPpaCount = useMemo(
    () => applications.filter((a) => a.isApprovedByPPA === true).length,
    [applications]
  );

  const rejectedPpaCount = useMemo(
    () => applications.filter((a) => a.isApprovedByPPA === false).length,
    [applications]
  );

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
        { label: 'Assigned Students', value: students.length, icon: Users, color: 'bg-blue-50 text-blue-600', trend: '—' },
        { label: 'Pending Reviews', value: pendingPpaCount, icon: Clock, color: 'bg-amber-50 text-amber-600', trend: '—' },
        { label: 'Approved by Me', value: approvedPpaCount, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600', trend: '—' },
        { label: 'Rejected', value: rejectedPpaCount, icon: XCircle, color: 'bg-red-50 text-red-600', trend: '—' },
      ].map((stat, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className={cn('p-3 rounded-xl transition-colors duration-300', stat.color)}>
              <stat.icon size={20} />
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider bg-slate-50 text-slate-500">
              {stat.trend}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{stat.label}</div>
        </div>
      ))}
    </div>
  );

  const renderApplications = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900">Professional Practice Applications</h2>
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
            suppressHydrationWarning
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
          >
            <Filter size={16} />
            Filter
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <th className="px-6 py-4">Student</th>
              <th className="px-6 py-4">Company & Opportunity</th>
              <th className="px-6 py-4">Date Applied</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : filteredApplications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                  No professional practice applications in your university scope.
                </td>
              </tr>
            ) : (
              filteredApplications.map((app) => (
                <tr key={app.applicationId ?? `${app.studentId}-${app.opportunityId}`} className="hover:bg-slate-50 transition-all group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{app.studentName || '—'}</div>
                    <div className="text-xs text-slate-500">ID: {app.studentId ?? '—'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{app.opportunityTitle || '—'}</div>
                    <div className="text-xs text-slate-500">{app.companyName || '—'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      {app.createdAt || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        app.isApprovedByPPA === true
                          ? 'bg-emerald-50 text-emerald-700'
                          : app.isApprovedByPPA === false
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      )}
                    >
                      {app.isApprovedByPPA === true ? 'Approved' : app.isApprovedByPPA === false ? 'Rejected' : 'Waiting Review'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {app.isApprovedByPPA == null ? (
                      <div className="flex justify-end gap-2">
                        <button
                          suppressHydrationWarning
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
                        >
                          Approve
                        </button>
                        <button
                          suppressHydrationWarning
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button
                        suppressHydrationWarning
                        className="text-[#002B5B] text-xs font-bold hover:underline flex items-center gap-1 ml-auto"
                      >
                        View Details <ArrowRight size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const filteredMyStudents = useMemo(() => {
    const q = myStudentsSearch.trim().toLowerCase();
    return myStudents.filter((s) => {
      if (q && !(s.fullName || '').toLowerCase().includes(q)) return false;
      if (studentYearFilter.length > 0) {
        const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
        const label = s.studyYear != null ? `${s.studyYear}${suffixes[s.studyYear] ?? 'th'} Year` : '';
        if (!studentYearFilter.includes(label)) return false;
      }
      if (studentFieldFilter.length > 0) {
        if (!s.studyFieldName || !studentFieldFilter.includes(s.studyFieldName)) return false;
      }
      if (studentAppFilter.length > 0) {
        const count = s.applicationCount ?? 0;
        const inRange = studentAppFilter.some((r) => {
          if (r === '0–5') return count >= 0 && count <= 5;
          if (r === '6–10') return count >= 6 && count <= 10;
          if (r === '11+') return count >= 11;
          return false;
        });
        if (!inRange) return false;
      }
      if (studentStatusFilter.length > 0) {
        const status = s.applicationStatus;
        const label =
          status === 'APPROVED' ? 'Accepted' :
          status === 'REJECTED' ? 'Rejected' :
          'Waiting Review';
        if (!studentStatusFilter.includes(label)) return false;
      }
      return true;
    });
  }, [myStudents, myStudentsSearch, studentYearFilter, studentFieldFilter, studentAppFilter, studentStatusFilter]);

  const uniqueStudyFields = useMemo(
    () => Array.from(new Set(myStudents.map((s) => s.studyFieldName).filter(Boolean))) as string[],
    [myStudents]
  );

  const studyYearLabel = (year: number | null | undefined) => {
    if (year == null) return '—';
    const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
    return `${year}${suffixes[year] ?? 'th'} Year`;
  };

  const renderStudents = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Students</h2>
        <p className="text-slate-500 text-sm mt-1">Monitor and manage students from your assigned study fields</p>
      </div>

      {/* Search + Filters card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search students..."
              suppressHydrationWarning
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none w-full"
              value={myStudentsSearch}
              onChange={(e) => setMyStudentsSearch(e.target.value)}
            />
          </div>
          <button
            suppressHydrationWarning
            onClick={() => setShowStudentFilters((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#003a7a] transition-all"
          >
            <Filter size={16} />
            Filters
          </button>
        </div>
        {showStudentFilters && (
          <div className="mt-4 p-4 bg-white border border-slate-200 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Study Year</div>
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5].map((y) => {
                  const label = studyYearLabel(y);
                  return (
                    <label key={y} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-[#002B5B]"
                        checked={studentYearFilter.includes(label)}
                        onChange={(e) =>
                          setStudentYearFilter((prev) =>
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
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Study Field</div>
              <div className="space-y-1.5">
                {uniqueStudyFields.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-[#002B5B]"
                      checked={studentFieldFilter.includes(f)}
                      onChange={(e) =>
                        setStudentFieldFilter((prev) =>
                          e.target.checked ? [...prev, f] : prev.filter((v) => v !== f)
                        )
                      }
                    />
                    {f}
                  </label>
                ))}
                {uniqueStudyFields.length === 0 && <p className="text-xs text-slate-400">—</p>}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Applications</div>
              <div className="space-y-1.5">
                {['0–5', '6–10', '11+'].map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-[#002B5B]"
                      checked={studentAppFilter.includes(r)}
                      onChange={(e) =>
                        setStudentAppFilter((prev) =>
                          e.target.checked ? [...prev, r] : prev.filter((v) => v !== r)
                        )
                      }
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Status</div>
              <div className="space-y-1.5">
                {['Waiting Review', 'Accepted', 'Rejected'].map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-[#002B5B]"
                      checked={studentStatusFilter.includes(s)}
                      onChange={(e) =>
                        setStudentStatusFilter((prev) =>
                          e.target.checked ? [...prev, s] : prev.filter((v) => v !== s)
                        )
                      }
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2 md:col-span-4 flex justify-end gap-3">
              <button
                suppressHydrationWarning
                onClick={() => {
                  setStudentYearFilter([]);
                  setStudentFieldFilter([]);
                  setStudentAppFilter([]);
                  setStudentStatusFilter([]);
                }}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
              >
                Clear All
              </button>
              <button
                suppressHydrationWarning
                onClick={() => setShowStudentFilters(false)}
                className="px-4 py-2 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#003a7a] transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#002B5B] text-white text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Study Year</th>
                <th className="px-6 py-4">Study Field</th>
                <th className="px-6 py-4">Number of Applications</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myStudentsLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : myStudentsError ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-red-500">
                    {myStudentsError}
                  </td>
                </tr>
              ) : filteredMyStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    No students found for your assigned study fields.
                  </td>
                </tr>
              ) : (
                filteredMyStudents.map((student) => {
                  const status = student.applicationStatus;
                  const isApproved = status === 'APPROVED';
                  const isRejected = status === 'REJECTED';
                  return (
                    <tr
                      key={student.studentId}
                      className="hover:bg-slate-50 transition-all cursor-pointer"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{student.fullName || '—'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{studyYearLabel(student.studyYear)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{student.studyFieldName || '—'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{student.applicationCount ?? 0}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'px-3 py-1 rounded text-xs font-bold uppercase',
                            isApproved
                              ? 'bg-emerald-600 text-white'
                              : isRejected
                                ? 'bg-red-500 text-white'
                                : 'bg-sky-400 text-white'
                          )}
                        >
                          {isApproved ? 'Accepted' : isRejected ? 'Rejected' : 'Waiting Review'}
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

      {/* Student detail modal */}
      {selectedStudent && (() => {
        const s = selectedStudent;
        const status = s.applicationStatus;
        const isApproved = status === 'APPROVED';
        const isRejected = status === 'REJECTED';
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setSelectedStudent(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{s.fullName || '—'}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Student Details</p>
                </div>
                <button
                  suppressHydrationWarning
                  onClick={() => setSelectedStudent(null)}
                  className="text-slate-400 hover:text-slate-700 transition-colors text-xl font-bold leading-none"
                >
                  ×
                </button>
              </div>
              <dl className="space-y-4">
                {[
                  { label: 'Full Name', value: s.fullName || '—' },
                  { label: 'Email', value: s.email || '—' },
                  { label: 'Study Year', value: studyYearLabel(s.studyYear) },
                  { label: 'Study Field', value: s.studyFieldName || '—' },
                  { label: 'CGPA', value: s.cgpa != null ? String(s.cgpa) : '—' },
                  { label: 'Application Count', value: String(s.applicationCount ?? 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</dt>
                    <dd className="text-sm font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2">
                  <dt className="text-xs font-bold text-slate-500 uppercase tracking-wider">Application Status</dt>
                  <dd>
                    <span
                      className={cn(
                        'px-3 py-1 rounded text-xs font-bold uppercase',
                        isApproved
                          ? 'bg-emerald-600 text-white'
                          : isRejected
                            ? 'bg-red-500 text-white'
                            : 'bg-sky-400 text-white'
                      )}
                    >
                      {isApproved ? 'Accepted' : isRejected ? 'Rejected' : 'Waiting Review'}
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="mt-8 flex justify-end">
                <button
                  suppressHydrationWarning
                  onClick={() => setSelectedStudent(null)}
                  className="px-6 py-2 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#003a7a] transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  const firstPending = filteredApplications.find((a) => a.isApprovedByPPA == null);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            {loading ? <p className="text-sm text-slate-500 mb-4">Loading…</p> : null}
            {renderStats()}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">{renderApplications()}</div>
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <AlertCircle size={18} className="text-amber-500" />
                    Next review
                  </h3>
                  <div className="space-y-4">
                    {firstPending ? (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                        <div className="text-xs font-bold text-amber-800 uppercase mb-1">Awaiting PPA</div>
                        <div className="text-sm font-bold text-slate-900">
                          {firstPending.studentName || 'Student'} — {firstPending.companyName || 'Company'}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Submitted {firstPending.createdAt || '—'}. Approve or reject from the table.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No pending professional practice reviews.</p>
                    )}
                  </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl text-white">
                  <h3 className="font-bold mb-4">PPA</h3>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-[#002B5B] rounded-full flex items-center justify-center font-bold text-xl">
                      {(currentUserName || '?')[0]}
                    </div>
                    <div>
                      <div className="font-bold">{currentUserName}</div>
                      <div className="text-xs text-slate-400">Professional Practice Advisor</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scope</div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Lists are scoped by your account&apos;s <span className="font-mono">linked_entity_id</span> (expected:{' '}
                      <span className="font-mono">university_id</span>).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      case 'applications':
        return renderApplications();
      case 'students':
        return renderStudents();
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

export default PPADashboard;
