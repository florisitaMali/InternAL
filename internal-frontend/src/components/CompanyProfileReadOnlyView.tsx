'use client';

import React from 'react';
import type { CompanyProfileFromApi } from '@/src/types';
import { profileImageDisplayUrl } from '@/src/lib/supabase/companyProfilePhotos';
import { MapPin, Building2, Link2 } from 'lucide-react';

type Props = {
  profile: CompanyProfileFromApi;
  /** For modal dialogs; page views can omit for a simpler heading. */
  titleId?: string;
};

function formatWebsiteLabel(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function formatEmployeeLabel(count: number): string {
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(count);
  return `${formatted} employees`;
}

export default function CompanyProfileReadOnlyView({ profile, titleId }: Props) {
  const website = profile.website;
  const employees = profile.employeeCount != null ? String(profile.employeeCount) : '—';
  const hq = profile.location ?? '—';
  const founded = profile.foundedYear != null ? String(profile.foundedYear) : '—';
  const specialties = profile.specialties ?? '—';

  const websiteTrim = profile.website?.trim() || null;
  const websiteHref = websiteTrim
    ? websiteTrim.startsWith('http')
      ? websiteTrim
      : `https://${websiteTrim}`
    : null;
  const hasLocation = Boolean(profile.location?.trim());
  const hasEmployees = profile.employeeCount != null && profile.employeeCount >= 0;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className="h-36 bg-slate-200 bg-cover bg-center sm:h-44"
        style={{
          backgroundImage: profile.coverUrl
            ? `url(${JSON.stringify(profileImageDisplayUrl(profile.coverUrl, 0))})`
            : undefined,
        }}
      />
      <div className="relative px-6 pb-6 pt-0 sm:px-8">
        <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border-4 border-white bg-white shadow-md">
              {profile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profileImageDisplayUrl(profile.logoUrl, 0)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#002B5B] text-lg font-bold text-white">
                  {(profile.name || '?').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <h2
                id={titleId}
                className="text-2xl font-bold text-slate-900"
              >
                {profile.name || 'Company'}
              </h2>
              <p className="text-sm font-medium text-slate-500">{profile.industry || '—'}</p>
            </div>
          </div>
        </div>

        <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-600">
          {profile.description?.trim() ? profile.description : 'No description provided.'}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-slate-100 pt-5">
          <div className="flex min-w-0 max-w-full items-center gap-2 text-sm text-slate-700">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="font-medium">{hasLocation ? profile.location : '—'}</span>
          </div>
          <div className="flex min-w-0 max-w-full items-center gap-2 text-sm text-slate-700">
            <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="font-medium">
              {hasEmployees ? formatEmployeeLabel(profile.employeeCount!) : '—'}
            </span>
          </div>
          <div className="flex min-w-0 max-w-full items-center gap-2 text-sm">
            <Link2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            {websiteHref ? (
              <a
                href={websiteHref}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#002B5B] hover:underline break-all"
              >
                {formatWebsiteLabel(websiteTrim!)}
              </a>
            ) : (
              <span className="font-medium text-slate-400">—</span>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <h3 className="text-lg font-bold text-slate-900">About</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {profile.description?.trim() ? profile.description : 'No description provided.'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-5">Company Info</h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Website</p>
                {website ? (
                  <a
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[#002B5B] font-medium hover:underline break-all"
                  >
                    {website}
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Industry</p>
                <p className="text-sm text-slate-700 font-medium">{profile.industry || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Number of Employees
                </p>
                <p className="text-sm text-slate-700 font-medium">{employees}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Headquarters</p>
                <p className="text-sm text-slate-700 font-medium">{hq}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Founded</p>
                <p className="text-sm text-slate-700 font-medium">{founded}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Specialties</p>
                <p className="text-sm text-slate-700 font-medium">{specialties}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
