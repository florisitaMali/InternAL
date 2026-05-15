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
import { BarChart3, BriefcaseBusiness, Building2, CalendarDays, RefreshCcw, Users } from 'lucide-react';
import {
  AdminCompanyResponse,
  fetchSysAdminAnalytics,
  fetchSysAdminCompanies,
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
const AMBER = '#ffae2d';

type AnalyticsTimeFilter = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total';

const timeFilters: AnalyticsTimeFilter[] = ['daily', 'weekly', 'monthly', 'yearly', 'total'];

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
  const [companies, setCompanies] = useState<AdminCompanyResponse[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState<AnalyticsTimeFilter>('total');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasActiveCompanyFilter = companyId !== null;
  const analyticsQuery = useMemo(() => queryForTimeFilter(timeFilter), [timeFilter]);

  const selectedScope = useMemo(() => {
    const company = companies.find((c) => c.companyId === companyId);
    const rangeLabel = timeFilter === 'total' ? 'All Time' : timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1);
    if (company) return `${company.name} (${rangeLabel})`;
    return rangeLabel;
  }, [companies, companyId, timeFilter]);

  const refresh = useCallback(async () => {
    const token = (accessTokenRef?.current ?? '') || accessToken;
    setLoading(true);
    const [analyticsRes, companiesRes] = await Promise.all([
      fetchSysAdminAnalytics(token, { companyId, ...analyticsQuery }),
      fetchSysAdminCompanies(token),
    ]);
    if (companiesRes.data) setCompanies(companiesRes.data.items);
    if (analyticsRes.errorMessage) {
      setAnalytics(emptyAnalytics);
      setErrorMessage(analyticsRes.errorMessage);
    } else if (analyticsRes.data) {
      setAnalytics(analyticsRes.data);
      setErrorMessage(null);
    }
    setLoading(false);
  }, [accessToken, accessTokenRef, analyticsQuery, companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearFilters = () => {
    setCompanyId(null);
  };

  const statusData = withStatusColors(analytics.applicationStatusDistribution);
  const applicationsOverTime = sortTimeSeries(analytics.applicationsOverTime, timeFilter);
  const opportunitiesVsApplications = sortTimeSeries(analytics.opportunitiesVsApplications, timeFilter);
  const typeData = analytics.applicationTypeDistribution.map((item, index) => ({
    ...item,
    fill: index === 0 ? NAVY : BLUE,
  }));
  const pendingApplications = Math.max(
    analytics.approvalRate.total - analytics.approvalRate.approved - analytics.approvalRate.rejected,
    0,
  );
  const pendingPercentage = percentage(pendingApplications, analytics.approvalRate.total);
  const approvalData = [
    { label: 'Approved', value: analytics.approvalRate.approved, fill: TEAL },
    { label: 'Rejected', value: analytics.approvalRate.rejected, fill: RED },
    { label: 'Pending', value: pendingApplications, fill: AMBER },
  ];

  return (
    <div className="min-h-screen bg-[#f3f6fa] -m-6 p-6 lg:p-10">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-[#08275c] tracking-normal">Platform Analytics</h1>
          <p className="mt-3 text-xl text-slate-500">Monitor system-wide performance and engagement</p>
        </div>
        <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-white p-1 shadow-sm" aria-label="Analytics period">
          {timeFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setTimeFilter(filter)}
              className={`px-5 py-3 rounded-md text-sm font-bold transition-colors ${
                timeFilter === filter ? 'bg-[#08275c] text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <section className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row">
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

      {!hasActiveCompanyFilter ? (
        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          <SummaryCard icon={<BriefcaseBusiness size={24} />} tone="blue" label="Total Companies" value={analytics.summary.totalCompanies} tag="Active" />
          <SummaryCard icon={<BarChart3 size={24} />} tone="orange" label="Total Opportunities" value={analytics.summary.totalOpportunities} tag={`${analytics.summary.totalOpportunities} active`} />
          <SummaryCard
            icon={<Users size={24} />}
            tone="purple"
            label="Total Applications"
            value={analytics.summary.totalApplications}
            tag={analytics.summary.totalApplications > 0 ? 'Growing' : 'No activity'}
          />
        </section>
      ) : null}

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
              <Legend verticalAlign="bottom" height={36} />
              <Pie
                data={typeData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="45%"
                outerRadius={96}
                label={renderPieLabelInside}
                labelLine={false}
              >
                {typeData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Applications Over Time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={applicationsOverTime} margin={{ top: 20, right: 22, bottom: 0, left: 0 }}>
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
            <LineChart data={opportunitiesVsApplications} margin={{ top: 20, right: 22, bottom: 0, left: 0 }}>
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
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.05fr_1.25fr]">
          <ResponsiveContainer width="100%" height={410}>
            <PieChart>
              <Tooltip />
              <Pie
                data={approvalData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={122}
                label={renderPieLabelOutside}
                labelLine
              >
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
              count={analytics.approvalRate.approved}
              total={analytics.approvalRate.total}
              tone="approved"
            />
            <RatePanel
              label="Rejection Rate"
              value={analytics.approvalRate.rejectionPercentage}
              detail={`${analytics.approvalRate.rejected} of ${analytics.approvalRate.total} applications rejected`}
              count={analytics.approvalRate.rejected}
              total={analytics.approvalRate.total}
              tone="rejected"
            />
            <RatePanel
              label="Pending Rate"
              value={pendingPercentage}
              detail={`${pendingApplications} of ${analytics.approvalRate.total} applications waiting or pending`}
              count={pendingApplications}
              total={analytics.approvalRate.total}
              tone="pending"
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

function RatePanel({
  label,
  value,
  detail,
  count,
  total,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  count: number;
  total: number;
  tone: 'approved' | 'rejected' | 'pending';
}) {
  const colors = {
    approved: {
      panel: 'bg-teal-50 text-teal-600',
      bar: 'bg-teal-500',
      track: 'bg-teal-100',
      chip: 'bg-white text-teal-700',
    },
    rejected: {
      panel: 'bg-red-50 text-red-500',
      bar: 'bg-red-500',
      track: 'bg-red-100',
      chip: 'bg-white text-red-600',
    },
    pending: {
      panel: 'bg-amber-50 text-amber-600',
      bar: 'bg-amber-500',
      track: 'bg-amber-100',
      chip: 'bg-white text-amber-700',
    },
  }[tone];
  const width = total > 0 ? Math.min(Math.max(value, 0), 100) : 0;

  return (
    <div className={`rounded-lg p-7 ${colors.panel}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base text-slate-500">{label}</p>
          <p className="mt-2 text-5xl font-extrabold">{value}%</p>
        </div>
        <span className={`rounded-md px-3 py-2 text-sm font-extrabold shadow-sm ${colors.chip}`}>
          {count}/{total}
        </span>
      </div>
      <div className={`mt-5 h-3 overflow-hidden rounded-full ${colors.track}`}>
        <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${width}%` }} />
      </div>
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

function queryForTimeFilter(filter: AnalyticsTimeFilter): {
  granularity: SysAdminAnalyticsGranularity;
  range: SysAdminAnalyticsRange;
} {
  if (filter === 'daily') {
    return { granularity: 'daily', range: 'daily' };
  }
  if (filter === 'weekly') {
    return { granularity: 'weekly', range: 'weekly' };
  }
  if (filter === 'monthly') {
    return { granularity: 'monthly', range: 'monthly' };
  }
  if (filter === 'yearly') {
    return { granularity: 'monthly', range: 'yearly' };
  }
  return { granularity: 'monthly', range: 'total' };
}

function sortTimeSeries<T extends { label: string }>(data: T[], filter: AnalyticsTimeFilter) {
  return [...data].sort((a, b) => timeSeriesSortValue(a.label, filter) - timeSeriesSortValue(b.label, filter));
}

function timeSeriesSortValue(label: string, filter: AnalyticsTimeFilter) {
  if (filter === 'daily') {
    return leadingNumber(label);
  }

  if (filter === 'weekly') {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(label);
  }

  if (filter === 'monthly') {
    const week = label.match(/Week\s+(\d+)/i);
    return week ? Number(week[1]) : Number.MAX_SAFE_INTEGER;
  }

  if (filter === 'yearly') {
    const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(label);
    return monthIndex < 0 ? Number.MAX_SAFE_INTEGER : monthIndex;
  }

  return leadingNumber(label);
}

function leadingNumber(label: string) {
  const value = Number(label.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function renderPieLabelInside({ percent }: { percent?: number }) {
  if (!percent) return '';
  return `${Math.round(percent * 100)}%`;
}

function renderPieLabelOutside({ name, value, percent }: { name?: string; value?: number; percent?: number }) {
  if (!value) return '';
  return `${name ?? ''}: ${Math.round((percent ?? 0) * 100)}%`;
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value * 100) / total);
}

export default SystemAdminAnalyticsTab;
