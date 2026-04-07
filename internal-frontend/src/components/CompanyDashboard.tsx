'use client';

import React, { useState } from 'react';
import Dashboard from './Dashboard';
import AddOpportunityForm from './AddOpportunityForm';
import UnderDevelopment from './UnderDevelopment';
import { mockCompanies, mockOpportunities, mockApplications } from '@/src/lib/mockData';
import { 
  Briefcase, 
  FileText, 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowRight,
  Calendar,
  Users
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { toast } from 'sonner';

interface CompanyDashboardProps {
  activeTab: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  onToggleSidebar?: () => void;
}

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  activeTab,
  currentUserName,
  currentUserRoleLabel,
  onToggleSidebar,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingOpportunity, setIsAddingOpportunity] = useState(false);
  const [opportunities, setOpportunities] = useState(mockOpportunities);
  const company = mockCompanies[0]; // Mock current company

  const handleDecision = (studentName: string, decision: 'Approve' | 'Reject') => {
    toast.success(`${decision}d application for ${studentName}!`);
  };

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[
        { label: 'My Opportunities', value: mockOpportunities.filter(o => o.companyId === company.id).length, icon: Briefcase, color: 'bg-[#002B5B]' },
        { label: 'Total Applicants', value: mockApplications.filter(a => a.companyId === company.id).length, icon: Users, color: 'bg-blue-500' },
        { label: 'Pending Decisions', value: mockApplications.filter(a => a.companyId === company.id && a.isApprovedByCompany === undefined).length, icon: Clock, color: 'bg-amber-500' },
        { label: 'Hired Interns', value: mockApplications.filter(a => a.companyId === company.id && a.isApprovedByCompany === true).length, icon: CheckCircle, color: 'bg-emerald-500' },
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

  const renderOpportunities = () => {
    if (isAddingOpportunity) {
      return (
        <AddOpportunityForm 
          companyId={company.id} 
          companyName={company.name} 
          onSave={(newOpp) => {
            setOpportunities(prev => [newOpp, ...prev]);
            setIsAddingOpportunity(false);
          }} 
          onCancel={() => setIsAddingOpportunity(false)} 
        />
      );
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
        <div className="divide-y divide-slate-100">
          {opportunities.filter(o => o.companyId === company.id).map((opp) => (
            <div key={opp.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#002B5B]/10 text-[#002B5B] rounded-lg flex items-center justify-center font-bold">
                  {opp.title[0]}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{opp.title}</div>
                  <div className="text-xs text-slate-500">Deadline: {opp.deadline} • {opp.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Applicants</div>
                  <div className="text-sm font-bold text-slate-900">{mockApplications.filter(a => a.opportunityId === opp.id).length}</div>
                </div>
                <button suppressHydrationWarning className="p-2 text-slate-400 hover:text-[#002B5B] transition-all">
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          ))}
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
            {mockApplications.filter(a => a.companyId === company.id).map((app) => (
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
                    <Building2 size={18} className="text-[#002B5B]" />
                    Company Profile
                  </h3>
                  <div className="space-y-4">
                    <div className="text-sm font-bold text-slate-900">{company.name}</div>
                    <p className="text-xs text-slate-500 leading-relaxed">{company.description}</p>
                    <div className="pt-4 border-t border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Industry</div>
                      <div className="text-xs font-bold text-slate-700">{company.industry}</div>
                    </div>
                  </div>
                </div>
                {renderOpportunities()}
              </div>
            </div>
          </>
        );
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

export default CompanyDashboard;
