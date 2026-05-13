'use client';

import React, { MutableRefObject, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, BriefcaseBusiness, Building2, CalendarDays, GraduationCap, RefreshCcw, Users } from 'lucide-react';
import {
  AdminCompanyResponse,
  AdminUniversityResponse,
  fetchSysAdminAnalytics,
  fetchSysAdminCompanies,
  fetchSysAdminUniversities,
  SysAdminAnalyticsGranularity,
  SysAdminAnalyticsRange,
  SysAdminAnalyticsResponse,
} from '@/src/lib/auth/sysadmin';

interface Props {
  accessToken: string;
  accessTokenRef?: MutableRefObject<string | null>;
}

const NAVY = '#08275c';
const TEAL = '#2a9d90';
const BLUE = '#2f80d1';
const ORANGE = '#ffae2d';
const GREEN = '#67ba68';
const RED = '#f05252';
const PURPLE = '#a936d4';

const emptyAnalytics: SysAdminAnalyticsResponse = {
  summary: {
    totalUniversities: 0,
    totalCompanies: 0,
    totalOpportunities: 0,
    totalApplications: 0,
  },
  applicationStatusDistribution: [],
  applicationsOverTime: [],
  opportunitiesVsApplications: [],
  applicationTypeDistribution: [],
  approvalRate: {
    approved: 0,
    rejected: 0,
    total: 0,
    approvalPercentage: 0,
    rejectionPercentage: 0,
  },
};

const SystemAdminAnalyticsTab: React.FC<Props> = ({ accessToken, accessTokenRef }) => {
  const [analytics, setAnalytics] = useState<SysAdminAnalyticsResponse>(emptyAnalytics);
  const [universities, setUniversities] = useState<AdminUniversityResponse[]>([]);
  const [companies, setCompanies] = useState<AdminCompanyResponse[]>([]);
  const [universityId, setUniversityId] = useState<number | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [granularity, setGranularity] = useState<SysAdminAnalyticsGranularity>('weekly');
  const [timeScope, setTimeScope] = useState<SysAdminAnalyticsRange>('total');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedScope = useMemo(() => {
    const university = universities.find((u) => u.universityId === universityId);
    const company = companies.find((c) => c.companyId === companyId);
    const rangeLabel = timeScope === 'total' ? 'All Time' : timeScope.charAt(0).toUpperCase() + timeScope.slice(1);
    if (university && company) return `${university.name} + ${company.name} (${rangeLabel})`;
    if (university) return `${university.name} (${rangeLabel})`;
    if (company) return `${company.name} (${rangeLabel})`;
    return rangeLabel;
  }, [companies, companyId, timeScope, universities, universityId]);

  const refresh = useCallback(async () => {
    const token = (accessTokenRef?.current ?? '') || accessToken;
    setLoading(true);
    const [analyticsRes, universitiesRes, companiesRes] = await Promise.all([
      fetchSysAdminAnalytics(token, { universityId, companyId, granularity, range: timeScope }),
      fetchSysAdminUniversities(token),
      fetchSysAdminCompanies(token),
    ]);
    if (universitiesRes.data) setUniversities(universitiesRes.data.items);
    if (companiesRes.data) setCompanies(companiesRes.data.items);
    if (analyticsRes.errorMessage) {
      setAnalytics(emptyAnalytics);
      setErrorMessage(analyticsRes.errorMessage);
    } else if (analyticsRes.data) {
      setAnalytics(analyticsRes.data);
      setErrorMessage(null);
    }
    setLoading(false);
  }, [accessToken, accessTokenRef, companyId, granularity, timeScope, universityId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearFilters = () => {
    setUniversityId(null);
    setCompanyId(null);
  };

  const statusData = withStatusColors(analytics.applicationStatusDistribution);
  const typeData = analytics.applicationTypeDistribution.map((item, index) => ({
    ...item,
    fill: index === 0 ? NAVY : BLUE,
  }));
  const approvalData = [
    { label: 'Approved', value: analytics.approvalRate.approved, fill: TEAL },
    { label: 'Rejected', value: analytics.approvalRate.rejected, fill: RED },
  ];

  return (
    <div className="min-h-screen bg-[#f3f6fa] -m-6 p-6 lg:p-10">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-[#08275c] tracking-normal">Platform Analytics</h1>
          <p className="mt-3 text-xl text-slate-500">Monitor system-wide performance and engagement</p>
        </div>
        <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {(['monthly', 'yearly', 'total'] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setTimeScope(scope)}
              className={`px-6 py-3 rounded-md text-sm font-bold transition-colors ${
                timeScope === scope ? 'bg-[#08275c] text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {scope.charAt(0).toUpperCase() + scope.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <section className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <SelectBox
            value={universityId ?? ''}
            icon={<GraduationCap size={18} />}
            label="All Universities"
            onChange={(value) => {
              setUniversityId(value ? Number(value) : null);
            }}
          >
            <option value="">All Universities</option>
            {universities.map((university) => (
              <option key={university.universityId} value={university.universityId}>
                {university.name}
              </option>
            ))}
          </SelectBox>
          <SelectBox
            value={companyId ?? ''}
            icon={<Building2 size={18} />}
            label="All Companies"
            onChange={(value) => {
              setCompanyId(value ? Number(value) : null);
            }}
          >
            <option value="">All Companies</option>
            {companies.map((company) => (
              <option key={company.companyId} value={company.companyId}>
                {company.name}
              </option>
            ))}
          </SelectBox>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-[52px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-[#08275c] shadow-sm hover:bg-slate-50"
          >
            <RefreshCcw size={17} />
            Reset
          </button>
        </div>

        <div className="inline-flex w-fit items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3 text-slate-500 shadow-sm">
          <CalendarDays size={18} />
          <span>Showing data for:</span>
          <span className="font-extrabold text-[#08275c]">{selectedScope}</span>
        </div>
      </section>

      {errorMessage ? (
        <div className="mt-8 rounded-lg border border-rose-100 bg-white p-6 text-rose-600 shadow-sm">{errorMessage}</div>
      ) : null}

      <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<GraduationCap size={24} />} tone="teal" label="Total Universities" value={analytics.summary.totalUniversities} tag="Active" />
        <SummaryCard icon={<BriefcaseBusiness size={24} />} tone="blue" label="Total Companies" value={analytics.summary.totalCompanies} tag="Active" />
        <SummaryCard icon={<BarChart3 size={24} />} tone="orange" label="Total Opportunities" value={analytics.summary.totalOpportunities} tag={`${analytics.summary.totalOpportunities} active`} />
        <SummaryCard icon={<Users size={24} />} tone="purple" label="Total Applications" value={analytics.summary.totalApplications} tag="Growing" />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Application Status Distribution">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={statusData} margin={{ top: 18, right: 18, bottom: 72, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfe7f1" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                angle={-24}
                textAnchor="end"
                interval={0}
                height={74}
              />
              <YAxis allowDecimals={false} tick={{ fill: '#6b7280' }} />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Application Type Distribution">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Tooltip />
              <Pie data={typeData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={115} label={renderPieLabel}>
                {typeData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Applications Over Time"
          action={
            <div className="inline-flex rounded-md bg-slate-100 p-1">
              {(['daily', 'weekly', 'monthly'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setGranularity(item)}
                  className={`rounded px-4 py-2 text-xs font-bold ${
                    granularity === item ? 'bg-white text-[#08275c] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.applicationsOverTime} margin={{ top: 20, right: 22, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfe7f1" />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#6b7280' }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke={PURPLE} strokeWidth={3} dot={{ r: 4, fill: 'white', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Opportunities vs Applications">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.opportunitiesVsApplications} margin={{ top: 20, right: 22, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfe7f1" />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#6b7280' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="opportunities" stroke={BLUE} strokeWidth={3} dot={{ r: 4, fill: 'white', strokeWidth: 2 }} />
              <Line type="monotone" dataKey="applications" stroke={PURPLE} strokeWidth={3} dot={{ r: 4, fill: 'white', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <SectionTitle title="Approval Rate" />
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Tooltip />
              <Pie data={approvalData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={115} label={renderPieLabel}>
                {approvalData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-6">
            <RatePanel
              label="Approval Rate"
              value={analytics.approvalRate.approvalPercentage}
              detail={`${analytics.approvalRate.approved} of ${analytics.approvalRate.total} applications approved`}
              tone="approved"
            />
            <RatePanel
              label="Rejection Rate"
              value={analytics.approvalRate.rejectionPercentage}
              detail={`${analytics.approvalRate.rejected} of ${analytics.approvalRate.total} applications rejected`}
              tone="rejected"
            />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit rounded-lg bg-[#08275c] px-5 py-3 text-sm font-bold text-white shadow-lg">
          Loading analytics...
        </div>
      ) : null}
    </div>
  );
};

function SelectBox({
  value,
  icon,
  label,
  onChange,
  children,
}: {
  value: number | string;
  icon: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative flex w-full items-center md:w-72">
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="h-[52px] w-full appearance-none rounded-lg border border-slate-200 bg-white px-5 pr-12 font-semibold text-[#08275c] shadow-sm outline-none focus:border-[#08275c] focus:ring-2 focus:ring-[#08275c]/10"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-4 text-slate-500">{icon}</span>
    </label>
  );
}

function SummaryCard({
  icon,
  tone,
  label,
  value,
  tag,
}: {
  icon: React.ReactNode;
  tone: 'teal' | 'blue' | 'orange' | 'purple';
  label: string;
  value: number;
  tag: string;
}) {
  const toneClasses = {
    teal: 'bg-teal-50 text-teal-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-500',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="min-h-44 rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={`flex h-14 w-14 items-center justify-center rounded-lg ${toneClasses[tone]}`}>{icon}</div>
        <span className="text-sm font-bold text-teal-600">{tag}</span>
      </div>
      <p className="mt-6 text-base text-slate-500">{label}</p>
      <p className="mt-2 text-4xl font-extrabold text-[#08275c]">{value}</p>
    </div>
  );
}

function ChartCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <SectionTitle title={title} />
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-2xl font-extrabold text-[#08275c]">
      <BarChart3 size={22} />
      {title}
    </h2>
  );
}

function RatePanel({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: 'approved' | 'rejected' }) {
  const colors = tone === 'approved' ? 'bg-teal-50 text-teal-600' : 'bg-red-50 text-red-500';
  return (
    <div className={`rounded-lg p-7 ${colors}`}>
      <p className="text-base text-slate-500">{label}</p>
      <p className="mt-2 text-5xl font-extrabold">{value}%</p>
      <p className="mt-3 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function withStatusColors(data: { label: string; value: number }[]) {
  const colors: Record<string, string> = {
    Waiting: ORANGE,
    'Approved by PPA': '#45a6e8',
    'Approved by Company': GREEN,
    'Fully Approved': TEAL,
    Rejected: RED,
  };
  return data.map((item) => ({ ...item, fill: colors[item.label] ?? BLUE }));
}

function renderPieLabel({ name, value, percent }: { name?: string; value?: number; percent?: number }) {
  if (!value) return '';
  return `${name ?? ''}: ${Math.round((percent ?? 0) * 100)}%`;
}

export default SystemAdminAnalyticsTab;
