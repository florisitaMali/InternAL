'use client';

/**
 * Shared primitives for the System Admin "Platform Analytics" page (US-32).
 * Extracted from the original single-view SystemAdminAnalyticsTab so the
 * Company and Student tabs can reuse the same colours, cards and helpers.
 */
import React from 'react';
import { BarChart3 } from 'lucide-react';
import { SysAdminAnalyticsGranularity, SysAdminAnalyticsRange } from '@/src/lib/auth/sysadmin';

/* ---------- Colour palette ---------- */
export const NAVY = '#08275c';
export const TEAL = '#2a9d90';
export const BLUE = '#2f80d1';
export const ORANGE = '#ffae2d';
export const GREEN = '#67ba68';
export const RED = '#f05252';
export const PURPLE = '#a936d4';
export const AMBER = '#ffae2d';

/* ---------- Time filter ---------- */
export type AnalyticsTimeFilter = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total';

export const timeFilters: AnalyticsTimeFilter[] = ['daily', 'weekly', 'monthly', 'yearly', 'total'];

export function queryForTimeFilter(filter: AnalyticsTimeFilter): {
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

export function sortTimeSeries<T extends { label: string }>(data: T[], filter: AnalyticsTimeFilter) {
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

/* ---------- Pie label renderers ---------- */
export function renderPieLabelInside({ percent }: { percent?: number }) {
  if (!percent) return '';
  return `${Math.round(percent * 100)}%`;
}

export function renderPieLabelOutside({ name, value, percent }: { name?: string; value?: number; percent?: number }) {
  if (!value) return '';
  return `${name ?? ''}: ${Math.round((percent ?? 0) * 100)}%`;
}

export function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value * 100) / total);
}

/* ---------- UI primitives ---------- */
export function TimeFilterBar({
  value,
  onChange,
}: {
  value: AnalyticsTimeFilter;
  onChange: (filter: AnalyticsTimeFilter) => void;
}) {
  return (
    <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-white p-1 shadow-sm" aria-label="Analytics period">
      {timeFilters.map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => onChange(filter)}
          className={`px-5 py-3 rounded-md text-sm font-bold transition-colors ${
            value === filter ? 'bg-[#08275c] text-white' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          {filter.charAt(0).toUpperCase() + filter.slice(1)}
        </button>
      ))}
    </div>
  );
}

export function SelectBox({
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

export type CardTone = 'teal' | 'blue' | 'orange' | 'purple';

export function SummaryCard({
  icon,
  tone,
  label,
  value,
  tag,
}: {
  icon: React.ReactNode;
  tone: CardTone;
  label: string;
  value: number | string;
  tag: string;
}) {
  const toneClasses: Record<CardTone, string> = {
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

export function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-2xl font-extrabold text-[#08275c]">
      <BarChart3 size={22} />
      {title}
    </h2>
  );
}

export function ChartCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
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

export function RatePanel({
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
