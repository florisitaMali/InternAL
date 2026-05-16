'use client';

/**
 * Student analytics view (US-32) — student/subscription pie charts, application
 * status pies, and revenue / signup / renewal trends. Sourced from the
 * `studentsubscription` table via GET /api/sysadmin/analytics/students.
 */
import React, { MutableRefObject, useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { CalendarDays, DollarSign, GraduationCap, RefreshCcw, Star, Users } from 'lucide-react';
import {
  AdminUniversityResponse,
  fetchSysAdminStudentAnalytics,
  fetchSysAdminUniversities,
  SysAdminBillingCycle,
  SysAdminChartPoint,
  SysAdminStudentAnalyticsResponse,
  SysAdminSubscriptionTier,
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
  RED,
  SelectBox,
  SummaryCard,
  TEAL,
  queryForTimeFilter,
  renderPieLabelInside,
  sortTimeSeries,
} from './analyticsShared';

interface Props {
  accessToken: string;
  accessTokenRef?: MutableRefObject<string | null>;
  timeFilter: AnalyticsTimeFilter;
}

const emptyStudentAnalytics: SysAdminStudentAnalyticsResponse = {
  summary: { totalStudents: 0, baseStudents: 0, premiumStudents: 0, totalRevenue: 0 },
  tierDistribution: [],
  billingCycleDistribution: [],
  baseApplicationStatus: [],
  premiumApplicationStatus: [],
  revenueOverTime: [],
  signupsOverTime: [],
  renewalsOverTime: [],
};

const TIER_COLORS: Record<string, string> = { Base: BLUE, Premium: TEAL };
const CYCLE_COLORS: Record<string, string> = { Monthly: NAVY, Yearly: ORANGE };
const STATUS_COLORS: Record<string, string> = { Accepted: GREEN, Rejected: RED, Pending: AMBER };

const StudentAnalyticsView: React.FC<Props> = ({ accessToken, accessTokenRef, timeFilter }) => {
  const [analytics, setAnalytics] = useState<SysAdminStudentAnalyticsResponse>(emptyStudentAnalytics);
  const [universities, setUniversities] = useState<AdminUniversityResponse[]>([]);
  const [universityId, setUniversityId] = useState<number | null>(null);
  const [tier, setTier] = useState<SysAdminSubscriptionTier | null>(null);
  const [billingCycle, setBillingCycle] = useState<SysAdminBillingCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const analyticsQuery = useMemo(() => queryForTimeFilter(timeFilter), [timeFilter]);

  const selectedScope = useMemo(() => {
    const university = universities.find((u) => u.universityId === universityId);
    const rangeLabel = timeFilter === 'total' ? 'All Time' : timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1);
    const parts = [university ? university.name : 'All Universities'];
    if (tier) parts.push(tier === 'PREMIUM' ? 'Premium' : 'Base');
    if (billingCycle) parts.push(billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly');
    parts.push(rangeLabel);
    return parts.join(' · ');
  }, [universities, universityId, tier, billingCycle, timeFilter]);

  const refresh = useCallback(async () => {
    const token = (accessTokenRef?.current ?? '') || accessToken;
    setLoading(true);
    const [analyticsRes, universitiesRes] = await Promise.all([
      fetchSysAdminStudentAnalytics(token, { universityId, subscriptionTier: tier, billingCycle, ...analyticsQuery }),
      fetchSysAdminUniversities(token),
    ]);
    if (universitiesRes.data) setUniversities(universitiesRes.data.items);
    if (analyticsRes.errorMessage) {
      setAnalytics(emptyStudentAnalytics);
      setErrorMessage(analyticsRes.errorMessage);
    } else if (analyticsRes.data) {
      setAnalytics(analyticsRes.data);
      setErrorMessage(null);
    }
    setLoading(false);
  }, [accessToken, accessTokenRef, analyticsQuery, universityId, tier, billingCycle]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearFilters = () => {
    setUniversityId(null);
    setTier(null);
    setBillingCycle(null);
  };

  const tierData = withColors(analytics.tierDistribution, TIER_COLORS);
  const cycleData = withColors(analytics.billingCycleDistribution, CYCLE_COLORS);
  const baseStatusData = withColors(analytics.baseApplicationStatus, STATUS_COLORS);
  const premiumStatusData = withColors(analytics.premiumApplicationStatus, STATUS_COLORS);
  const revenueOverTime = sortTimeSeries(analytics.revenueOverTime, timeFilter);
  const signupsOverTime = sortTimeSeries(analytics.signupsOverTime, timeFilter);
  const renewalsOverTime = sortTimeSeries(analytics.renewalsOverTime, timeFilter);

  // Summary cards adapt to the tier filter: no tier -> 3 cards; Base -> only the
  // student-count card; Premium -> student-count + revenue (Premium card dropped).
  const showPremiumCard = tier === null;
  const showRevenueCard = tier !== 'BASE';
  const totalLabel = tier === 'BASE' ? 'Base Students' : tier === 'PREMIUM' ? 'Premium Students' : 'Total Students';
  const totalTag =
    tier === 'BASE' ? 'Free tier' : tier === 'PREMIUM' ? 'Subscribed' : `${analytics.summary.baseStudents} Base`;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
          <SelectBox
            value={universityId ?? ''}
            icon={<GraduationCap size={18} />}
            label="All Universities"
            onChange={(value) => setUniversityId(value ? Number(value) : null)}
          >
            <option value="">All Universities</option>
            {universities.map((university) => (
              <option key={university.universityId} value={university.universityId}>
                {university.name}
              </option>
            ))}
          </SelectBox>
          <SelectBox
            value={tier ?? ''}
            icon={<Star size={18} />}
            label="All Tiers"
            onChange={(value) => setTier(value ? (value as SysAdminSubscriptionTier) : null)}
          >
            <option value="">All Tiers</option>
            <option value="BASE">Base</option>
            <option value="PREMIUM">Premium</option>
          </SelectBox>
          <SelectBox
            value={billingCycle ?? ''}
            icon={<CalendarDays size={18} />}
            label="All Billing Cycles"
            onChange={(value) => setBillingCycle(value ? (value as SysAdminBillingCycle) : null)}
          >
            <option value="">All Billing Cycles</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
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

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <SummaryCard
          icon={<Users size={24} />}
          tone="blue"
          label={totalLabel}
          value={analytics.summary.totalStudents}
          tag={totalTag}
        />
        {showPremiumCard ? (
          <SummaryCard
            icon={<Star size={24} />}
            tone="purple"
            label="Premium Students"
            value={analytics.summary.premiumStudents}
            tag={analytics.summary.premiumStudents > 0 ? 'Subscribed' : 'No activity'}
          />
        ) : null}
        {showRevenueCard ? (
          <SummaryCard
            icon={<DollarSign size={24} />}
            tone="teal"
            label="Total Revenue"
            value={formatCurrency(analytics.summary.totalRevenue)}
            tag="Subscriptions"
          />
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Subscription Tier">
          <DistributionPie data={tierData} />
        </ChartCard>
        <ChartCard title="Billing Cycle Distribution">
          <DistributionPie data={cycleData} />
        </ChartCard>
        <ChartCard title="Base Students — Application Status">
          <DistributionPie data={baseStatusData} />
        </ChartCard>
        <ChartCard title="Premium Students — Application Status">
          <DistributionPie data={premiumStatusData} />
        </ChartCard>
      </section>

      <ChartCard title="Revenue Growth Over Time">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueOverTime} margin={{ top: 20, right: 22, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dfe7f1" />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} />
            <YAxis tick={{ fill: '#6b7280' }} />
            <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
            <Line type="monotone" dataKey="amount" name="Revenue" stroke={GREEN} strokeWidth={3} dot={{ r: 4, fill: 'white', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="New Student Signups Over Time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={signupsOverTime} margin={{ top: 20, right: 22, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfe7f1" />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#6b7280' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="base" name="Base" stroke={BLUE} strokeWidth={3} dot={{ r: 4, fill: 'white', strokeWidth: 2 }} />
              <Line type="monotone" dataKey="premium" name="Premium" stroke={TEAL} strokeWidth={3} dot={{ r: 4, fill: 'white', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Subscription Renewals Over Time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={renewalsOverTime} margin={{ top: 20, right: 22, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfe7f1" />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#6b7280' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="monthly" name="Monthly" stroke={NAVY} strokeWidth={3} dot={{ r: 4, fill: 'white', strokeWidth: 2 }} />
              <Line type="monotone" dataKey="yearly" name="Yearly" stroke={ORANGE} strokeWidth={3} dot={{ r: 4, fill: 'white', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {loading ? (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit rounded-lg bg-[#08275c] px-5 py-3 text-sm font-bold text-white shadow-lg">
          Loading analytics...
        </div>
      ) : null}
    </div>
  );
};

type ColoredPoint = SysAdminChartPoint & { fill: string };

function DistributionPie({ data }: { data: ColoredPoint[] }) {
  const hasData = data.some((entry) => entry.value > 0);
  if (!hasData) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm font-semibold text-slate-400">
        No data for the selected filters
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Tooltip />
        <Legend verticalAlign="bottom" height={36} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="45%"
          outerRadius={92}
          label={renderPieLabelInside}
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.label} fill={entry.fill} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function withColors(data: SysAdminChartPoint[], colors: Record<string, string>): ColoredPoint[] {
  return data.map((item) => ({ ...item, fill: colors[item.label] ?? PURPLE }));
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default StudentAnalyticsView;
