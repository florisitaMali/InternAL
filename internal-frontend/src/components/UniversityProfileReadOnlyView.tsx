'use client';

import React from 'react';
import { Edit2 } from 'lucide-react';
import type { UniversityProfileFromApi } from '@/src/types';
import { profileImageDisplayUrl } from '@/src/lib/supabase/companyProfilePhotos';

type Props = {
  profile: UniversityProfileFromApi;
  /** Bump after logo/cover save so images refresh. */
  mediaRev?: number;
  titleId?: string;
  canEditProfile?: boolean;
  onEditProfile?: () => void;
};

export default function UniversityProfileReadOnlyView({
  profile,
  mediaRev = 0,
  titleId,
  canEditProfile = false,
  onEditProfile,
}: Props) {
  const website = profile.website;
  const employees = profile.employeeCount != null ? String(profile.employeeCount) : '—';
  const hq = profile.location ?? '—';
  const founded = profile.foundedYear != null ? String(profile.foundedYear) : '—';
  const specialties = profile.specialties ?? '—';
  const contactEmail = profile.email ?? '—';

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className="h-36 bg-slate-200 bg-cover bg-center sm:h-44"
        style={{
          backgroundImage: profile.coverUrl
            ? `url(${JSON.stringify(profileImageDisplayUrl(profile.coverUrl, mediaRev))})`
            : undefined,
        }}
      />
      <div className="relative px-6 pb-6 pt-0 sm:px-8">
        <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border-4 border-white bg-white shadow-md">
              {profile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profileImageDisplayUrl(profile.logoUrl, mediaRev)}
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
              <h2 id={titleId} className="text-2xl font-bold text-slate-900">
                {profile.name || 'University'}
              </h2>
              <p className="text-sm font-medium text-slate-500">{contactEmail !== '—' ? contactEmail : '—'}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-2xl font-bold text-slate-900">About</h3>
              {canEditProfile && onEditProfile ? (
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-[#002B5B] hover:bg-slate-50"
                >
                  <Edit2 size={16} />
                  Edit profile
                </button>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {profile.description?.trim()
                ? profile.description
                : canEditProfile
                  ? 'No overview yet. Click Edit profile to add one.'
                  : 'No description provided.'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-5">University Info</h3>
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contact email</p>
                <p className="text-sm text-slate-700 font-medium">{contactEmail}</p>
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
