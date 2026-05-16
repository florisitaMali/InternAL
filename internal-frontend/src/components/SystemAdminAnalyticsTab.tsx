'use client';

/**
 * Platform Analytics page (US-32) — a tabbed container for the System Admin.
 *  - Company:    the original platform dashboard (CompanyAnalyticsView)
 *  - Student:    student / subscription analytics (StudentAnalyticsView)
 *  - University: placeholder, out of scope for US-32
 *
 * The daily/weekly/monthly/yearly/total time filter lives here (not inside the
 * views) so it keeps a fixed position when switching between tabs.
 */
import React, { MutableRefObject, useState } from 'react';
import { Building2, GraduationCap, Landmark } from 'lucide-react';
import CompanyAnalyticsView from './analytics/CompanyAnalyticsView';
import StudentAnalyticsView from './analytics/StudentAnalyticsView';
import UnderDevelopment from './UnderDevelopment';
import { AnalyticsTimeFilter, TimeFilterBar } from './analytics/analyticsShared';

interface Props {
  accessToken: string;
  accessTokenRef?: MutableRefObject<string | null>;
}

type AnalyticsTab = 'company' | 'student' | 'university';

const tabs: { id: AnalyticsTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'student', label: 'Student', icon: GraduationCap },
  { id: 'university', label: 'University', icon: Landmark },
];

const SystemAdminAnalyticsTab: React.FC<Props> = ({ accessToken, accessTokenRef }) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('company');
  const [timeFilter, setTimeFilter] = useState<AnalyticsTimeFilter>('total');

  return (
    <div className="min-h-screen bg-[#f3f6fa] -m-6 p-6 lg:p-10">
      <header>
        <h1 className="text-4xl lg:text-5xl font-extrabold text-[#08275c] tracking-normal">Platform Analytics</h1>
        <p className="mt-3 text-xl text-slate-500">Monitor system-wide performance and engagement</p>
      </header>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Analytics sections">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-md px-6 py-3 text-sm font-bold transition-colors ${
                  active ? 'bg-[#08275c] text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Icon size={17} />
                {tab.label}
              </button>
            );
          })}
        </div>
        {activeTab !== 'university' ? <TimeFilterBar value={timeFilter} onChange={setTimeFilter} /> : null}
      </div>

      <div className="mt-8">
        {activeTab === 'company' ? (
          <CompanyAnalyticsView accessToken={accessToken} accessTokenRef={accessTokenRef} timeFilter={timeFilter} />
        ) : null}
        {activeTab === 'student' ? (
          <StudentAnalyticsView accessToken={accessToken} accessTokenRef={accessTokenRef} timeFilter={timeFilter} />
        ) : null}
        {activeTab === 'university' ? <UnderDevelopment moduleName="University Analytics" /> : null}
      </div>
    </div>
  );
};

export default SystemAdminAnalyticsTab;
