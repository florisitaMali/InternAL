'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Dashboard from './Dashboard';
import AddStudentForm from './AddStudentForm';
import ImportCSVForm from './ImportCSVForm';
import UnderDevelopment from './UnderDevelopment';
import { 
  mockPPAs, 
  mockApplications, 
  mockOpportunities, 
  mockCompanies 
} from '@/src/lib/mockData';
import { api } from '@/src/lib/api';
import type { DashboardStats, Department, Student, StudyField } from '@/src/types';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  Briefcase, 
  FileText, 
  Plus, 
  Upload, 
  Search,
  Building2,
  Trash2,
  Edit2
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface UniversityAdminDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  onToggleSidebar?: () => void;
}

const UniversityAdminDashboard: React.FC<UniversityAdminDashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
  onToggleSidebar,
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
    totalStudyFields: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [studentsData, departmentsData, fieldsData, statsData] = await Promise.all([
          api.getStudents(),
          api.getDepartments(),
          api.getStudyFields(),
          api.getDashboardStats()
        ]);
        setStudents(studentsData);
        setDepartments(departmentsData);
        setStudyFields(fieldsData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load backend data', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredStudents = useMemo(
    () =>
      students.filter((student) =>
        `${student.fullName} ${student.email}`.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [students, searchTerm]
  );

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
        { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'bg-blue-50 text-blue-600', trend: '+12%' },
        { label: 'PP Approvers', value: mockPPAs.length, icon: GraduationCap, color: 'bg-[#002B5B]/10 text-[#002B5B]', trend: '+5%' },
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
            const created = await api.createStudent(newStudent);
            setStudents(prev => [created, ...prev]);
            setStats(prev => ({ ...prev, totalStudents: prev.totalStudents + 1 }));
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
        {mockOpportunities.map((opp) => (
          <div key={opp.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#002B5B]/10 text-[#002B5B] rounded-lg flex items-center justify-center font-bold">
                {opp.title[0]}
              </div>
              <div>
                <div className="font-bold text-slate-900">{opp.title}</div>
                <div className="text-xs text-slate-500">{opp.companyName} • Deadline: {opp.deadline}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {opp.type}
              </span>
              <button suppressHydrationWarning className="text-[#002B5B] text-xs font-bold hover:underline">View Details</button>
            </div>
          </div>
        ))}
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
            {mockApplications.map((app) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
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
                    {mockCompanies.slice(0, 3).map((company) => (
                      <div key={company.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all cursor-pointer">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-400">
                          {company.name[0]}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{company.name}</div>
                          <div className="text-xs text-slate-500">{company.industry}</div>
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
