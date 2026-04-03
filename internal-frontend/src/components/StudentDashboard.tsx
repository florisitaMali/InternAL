'use client';

import React, { useState } from 'react';
import Dashboard from './Dashboard';
import ProfileEditor from './ProfileEditor';
import UnderDevelopment from './UnderDevelopment';
import { mockStudents, mockOpportunities, mockApplications } from '@/src/lib/mockData';
import { 
  Briefcase, 
  FileText, 
  User, 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  ArrowRight,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  ChevronRight,
  Edit2
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';
import { Student } from '../types';

interface StudentDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [student, setStudent] = useState<Student>(mockStudents[0]); // Mock current student

  const handleApply = (opportunityTitle: string) => {
    toast.success(`Application submitted for ${opportunityTitle}!`);
  };

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
        { label: 'My Applications', value: mockApplications.filter(a => a.studentId === student.id).length, icon: FileText, color: 'bg-blue-500' },
        { label: 'Approved', value: mockApplications.filter(a => a.studentId === student.id && a.status === 'APPROVED').length, icon: CheckCircle, color: 'bg-emerald-500' },
        { label: 'Pending', value: mockApplications.filter(a => a.studentId === student.id && a.status === 'PENDING').length, icon: Clock, color: 'bg-amber-500' },
        { label: 'Rejected', value: mockApplications.filter(a => a.studentId === student.id && a.status === 'REJECTED').length, icon: XCircle, color: 'bg-red-500' },
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

  const renderOpportunities = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">Available Opportunities</h2>
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
          <button suppressHydrationWarning className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
            <Filter size={16} />
            Filter
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockOpportunities.map((opp) => (
          <div key={opp.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                {opp.companyName[0]}
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {opp.type}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{opp.title}</h3>
            <p className="text-[#20948B] text-sm font-bold mb-4">{opp.companyName}</p>
            <p className="text-slate-500 text-sm line-clamp-2 mb-6">{opp.description}</p>
            <div className="flex items-center gap-4 text-xs text-slate-400 mb-6">
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                Deadline: {opp.deadline}
              </div>
              <div className="flex items-center gap-1">
                <Briefcase size={14} />
                {opp.requiredExperience}
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleApply(opp.title)}
                suppressHydrationWarning
                className="flex-1 py-2.5 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#001F42] transition-all shadow-lg shadow-indigo-500/20"
              >
                Apply Now
              </button>
              <button suppressHydrationWarning className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">
                Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderApplications = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900">My Applications</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {mockApplications.filter(a => a.studentId === student.id).map((app) => (
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
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  app.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700" :
                  app.status === 'REJECTED' ? "bg-red-50 text-red-700" :
                  "bg-amber-50 text-amber-700"
                )}>
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
          onSave={(updated) => {
            setStudent(updated);
            setIsEditingProfile(false);
          }} 
          onCancel={() => setIsEditingProfile(false)} 
        />
      );
    }

    return (
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
                <div className="text-sm font-medium">{student.departmentId}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Study Field</div>
                <div className="text-sm font-medium">{student.studyFieldId}</div>
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
                <p className="text-slate-600 text-sm leading-relaxed">{student.extendedProfile?.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {student.extendedProfile?.skills.map(skill => (
                      <span key={skill} className="px-3 py-1 bg-[#002B5B]/10 text-[#002B5B] rounded-lg text-xs font-bold">{skill}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Languages</h4>
                  <div className="flex flex-wrap gap-2">
                    {student.extendedProfile?.languages.map(lang => (
                      <span key={lang} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">{lang}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Experience</h4>
                <div className="space-y-3">
                  {student.extendedProfile?.experience.map((exp, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <Briefcase size={16} className="text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">{exp}</span>
                    </div>
                  ))}
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                {renderOpportunities()}
              </div>
              <div className="space-y-8">
                {renderApplications()}
                <div className="bg-[#002B5B] p-6 rounded-2xl text-white shadow-xl shadow-indigo-500/20">
                  <h3 className="font-bold mb-2">Need Help?</h3>
                  <p className="text-indigo-100 text-xs mb-4">Contact your PPA for guidance on Professional Practice applications.</p>
                  <button suppressHydrationWarning className="w-full py-2.5 bg-white text-[#002B5B] rounded-xl text-xs font-bold hover:bg-indigo-50 transition-all">
                    Message PPA
                  </button>
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
      title={`Hello, ${currentUserName}`}
      userName={currentUserName}
      userRole={currentUserRoleLabel}
    >
      {renderContent()}
    </Dashboard>
  );
};

export default StudentDashboard;
