'use client';

/**
 * Company analytics — the original Platform Analytics dashboard, extracted into
 * its own view so it can sit behind the Company tab (US-32). Behaviour unchanged.
 */
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
  SysAdminAnalyticsResponse,
} from '@/src/lib/auth/sysadmin';
import {
  AMBER,
  AnalyticsTimeFilter,
  BLUE,
  ChartCard,
  GREEN,
  NAVY,
  ORANGE,
  PURPLE,
  RatePanel,
  RED,
  SectionTitle,
  SelectBox,
  SummaryCard,
  TEAL,
  percentage,
  queryForTimeFilter,
  renderPieLabelInside,
  renderPieLabelOutside,
  sortTimeSeries,
} from './analyticsShared';

interface Props {
  accessToken: string;
  accessTokenRef?: MutableRefObject<string | null>;
  timeFilter: AnalyticsTimeFilter;
}

const emptyAnalytics: SysAdminAnalyticsResponse = {
  summary: {
    totalUniversities: 0,
    totalCompanies: 0,
    totalOpportunities: 0,
    totalApplications: 0,
  },
  ppApplicationStatus: [],
  igApplicationStatus: [],
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

const CompanyAnalyticsView: React.FC<Props> = ({ accessToken, accessTokenRef, timeFilter }) => {
  const [analytics, setAnalytics] = useState<SysAdminAnalyticsResponse>(emptyAnalytics);
  const [companies, setCompanies] = useState<AdminCompanyResponse[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [appStatusTab, setAppStatusTab] = useState<'pp' | 'ig'>('pp');
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

  const appStatusData = withStatusColors(
    appStatusTab === 'pp' ? analytics.ppApplicationStatus : analytics.igApplicationStatus,
  );
  const appStatusTotal = appStatusData.reduce((sum, entry) => sum + entry.value, 0);
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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
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
        <div className="rounded-lg border border-rose-100 bg-white p-6 text-rose-600 shadow-sm">{errorMessage}</div>
      ) : null}

      {!hasActiveCompanyFilter ? (
        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Application Status Distribution">
          <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(
              [
                ['pp', 'Professional Practice'],
                ['ig', 'Individual Growth'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAppStatusTab(id)}
                className={`rounded-md px-4 py-2 text-xs font-bold transition-colors ${
                  appStatusTab === id ? 'bg-[#08275c] text-white' : 'text-slate-500 hover:bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={appStatusData} margin={{ top: 18, right: 18, bottom: 72, left: 0 }}>
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
                {appStatusData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-center text-sm font-bold text-slate-500">
            Total {appStatusTab === 'pp' ? 'Professional Practice' : 'Individual Growth'} applications:{' '}
            <span className="text-[#08275c]">{appStatusTotal}</span>
          </p>
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

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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

function withStatusColors(data: { label: string; value: number }[] | undefined) {
  const colors: Record<string, string> = {
    // Professional Practice
    'Pending PPA': ORANGE,
    'Approved by PPA': BLUE,
    'Fully Approved': TEAL,
    // Individual Growth
    Pending: ORANGE,
    Approved: GREEN,
    // shared
    Rejected: RED,
  };
  return (data ?? []).map((item) => ({ ...item, fill: colors[item.label] ?? BLUE }));
}

export default CompanyAnalyticsView;
