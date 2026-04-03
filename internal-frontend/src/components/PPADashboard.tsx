'use client';

import React, { useState } from 'react';
import Dashboard from './Dashboard';
import UnderDevelopment from './UnderDevelopment';
import { mockStudents, mockApplications, mockPPAs } from '@/src/lib/mockData';
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
  AlertCircle
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface PPADashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
}

const PPADashboard: React.FC<PPADashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const ppa = mockPPAs[0]; // Mock current PPA

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
        { label: 'Assigned Students', value: mockStudents.length, icon: Users, color: 'bg-blue-50 text-blue-600', trend: '+12%' },
        { label: 'Pending Reviews', value: mockApplications.filter(a => a.type === 'PROFESSIONAL_PRACTICE' && a.isApprovedByPPA === undefined).length, icon: Clock, color: 'bg-amber-50 text-amber-600', trend: '5 pending' },
        { label: 'Approved by Me', value: mockApplications.filter(a => a.isApprovedByPPA === true).length, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600', trend: '+18' },
        { label: 'Rejected', value: mockApplications.filter(a => a.isApprovedByPPA === false).length, icon: XCircle, color: 'bg-red-50 text-red-600', trend: '2 this week' },
      ].map((stat, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className={cn("p-3 rounded-xl transition-colors duration-300", stat.color)}>
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
            {mockApplications.filter(a => a.type === 'PROFESSIONAL_PRACTICE').map((app) => (
              <tr key={app.id} className="hover:bg-slate-50 transition-all group">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{app.studentName}</div>
                  <div className="text-xs text-slate-500">ID: {app.studentId}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-slate-900">{app.opportunityTitle}</div>
                  <div className="text-xs text-slate-500">{app.companyName}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" />
                    {app.createdAt}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    app.isApprovedByPPA === true ? "bg-emerald-50 text-emerald-700" :
                    app.isApprovedByPPA === false ? "bg-red-50 text-red-700" :
                    "bg-amber-50 text-amber-700"
                  )}>
                    {app.isApprovedByPPA === true ? "Approved" :
                     app.isApprovedByPPA === false ? "Rejected" :
                     "Waiting Review"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {app.isApprovedByPPA === undefined ? (
                    <div className="flex justify-end gap-2">
                      <button suppressHydrationWarning className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20">
                        Approve
                      </button>
                      <button suppressHydrationWarning className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/20">
                        Reject
                      </button>
                    </div>
                  ) : (
                    <button suppressHydrationWarning className="text-[#002B5B] text-xs font-bold hover:underline flex items-center gap-1 ml-auto">
                      View Details <ArrowRight size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStudents = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900">Assigned Students</h2>
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
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <th className="px-6 py-4">Student ID</th>
              <th className="px-6 py-4">Full Name</th>
              <th className="px-6 py-4">Study Year</th>
              <th className="px-6 py-4">CGPA</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockStudents.map((student) => (
              <tr key={student.id} className="hover:bg-slate-50 transition-all">
                <td className="px-6 py-4 font-mono text-xs text-slate-500">{student.id}</td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{student.fullName}</div>
                  <div className="text-xs text-slate-500">{student.email}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{student.studyYear}</td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 bg-[#002B5B]/10 text-[#002B5B] rounded-lg text-xs font-bold">
                    {student.cgpa}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button suppressHydrationWarning className="text-[#002B5B] text-xs font-bold hover:underline">View Profile</button>
                </td>
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
                {renderApplications()}
              </div>
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <AlertCircle size={18} className="text-amber-500" />
                    Pending Deadline
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="text-xs font-bold text-amber-800 uppercase mb-1">Due in 2 days</div>
                      <div className="text-sm font-bold text-slate-900">Alice Johnson - TechCorp</div>
                      <p className="text-xs text-slate-600 mt-1">Application submitted on 2026-03-20. Response required within 7 days.</p>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl text-white">
                  <h3 className="font-bold mb-4">PPA Profile</h3>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-[#002B5B] rounded-full flex items-center justify-center font-bold text-xl">
                      {ppa.fullName[0]}
                    </div>
                    <div>
                      <div className="font-bold">{ppa.fullName}</div>
                      <div className="text-xs text-slate-400">{ppa.email}</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Supervised Fields</div>
                    <div className="flex flex-wrap gap-2">
                      {ppa.supervisedFieldIds.map(id => (
                        <span key={id} className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[10px] font-bold uppercase tracking-wider">
                          {id}
                        </span>
                      ))}
                    </div>
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
    >
      {renderContent()}
    </Dashboard>
  );
};

export default PPADashboard;
