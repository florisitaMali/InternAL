'use client';

import React from 'react';
import { Building, Edit2, Link as LinkIcon, MapPin } from 'lucide-react';
import type { CompanyProfileFromApi } from '@/src/types';
import { profileImageDisplayUrl } from '@/src/lib/supabase/companyProfilePhotos';
import { cn } from '@/src/lib/utils';

function CompanyInfoCard({ profile }: { profile: CompanyProfileFromApi }) {
  const website = profile.website;
  const employees = profile.employeeCount != null ? String(profile.employeeCount) : '—';
  const hq = profile.location ?? '—';
  const founded = profile.foundedYear != null ? String(profile.foundedYear) : '—';
  const specialties = profile.specialties ?? '—';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Number of Employees</p>
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
  );
}

export type CompanyProfileTabbedViewProps = {
  profile: CompanyProfileFromApi | null;
  /** Bump when logo/cover URLs refresh after save (company dashboard). */
  mediaRev?: number;
  section: 'about' | 'opportunities';
  onSectionChange: (s: 'about' | 'opportunities') => void;
  /** Show Edit profile only when the signed-in company matches this profile (e.g. linkedEntityId === companyId). */
  canEditProfile: boolean;
  onEditProfile?: () => void;
  /** Full-width panel for the Opportunities tab (list + headings). */
  opportunitiesPanel: React.ReactNode;
  /** Same condition as company dashboard: loading initial profile for About tab. */
  aboutLoading?: boolean;
};

export default function CompanyProfileTabbedView({
  profile,
  mediaRev = 0,
  section,
  onSectionChange,
  canEditProfile,
  onEditProfile,
  opportunitiesPanel,
  aboutLoading,
}: CompanyProfileTabbedViewProps) {
  const displayName = profile?.name ?? 'Company';

  const hero = (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {profile?.coverUrl ? (
        <div
          className="h-44 w-full bg-cover bg-center"
          style={{
            backgroundImage: `url(${JSON.stringify(profileImageDisplayUrl(profile.coverUrl, mediaRev))})`,
          }}
        />
      ) : (
        <div className="h-44 bg-gradient-to-r from-[#003A83] to-[#00A7A0]" />
      )}
      <div className="px-6 pb-3">
        {profile?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${profile.logoUrl}-${mediaRev}`}
            src={profileImageDisplayUrl(profile.logoUrl, mediaRev)}
            alt=""
            className="-mt-14 h-24 w-24 rounded-xl border-4 border-white object-cover shadow-sm bg-white"
          />
        ) : (
          <div className="-mt-14 h-24 w-24 rounded-xl border-4 border-white bg-slate-100 shadow-sm" />
        )}
        <div className="mt-3">
          <h2 className="text-4xl font-bold text-[#0E2A50] leading-tight">{displayName}</h2>
          <p className="text-slate-500 text-sm mt-1 line-clamp-2">
            {profile?.description?.trim()
              ? profile.description.split('\n')[0].slice(0, 160)
              : canEditProfile
                ? 'Add an overview in the About section.'
                : 'No overview available.'}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-3">
            <span className="flex items-center gap-1.5">
              <MapPin size={13} />
              {profile?.location ?? '—'}
            </span>
            <span className="flex items-center gap-1.5">
              <Building size={13} />
              {profile?.employeeCount != null ? `${profile.employeeCount} employees` : '—'}
            </span>
            <span className="flex items-center gap-1.5">
              <LinkIcon size={13} />
              {profile?.website ?? '—'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6 mt-5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => onSectionChange('about')}
            className={cn(
              'pb-2 text-sm font-semibold border-b-2 transition-colors',
              section === 'about'
                ? 'text-[#0E2A50] border-[#0E2A50]'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            )}
          >
            About
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('opportunities')}
            className={cn(
              'pb-2 text-sm font-semibold border-b-2 transition-colors',
              section === 'opportunities'
                ? 'text-[#0E2A50] border-[#0E2A50]'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            )}
          >
            Opportunities
          </button>
        </div>
      </div>
    </div>
  );

  const aboutPanel =
    aboutLoading ? (
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading company profile…
      </div>
    ) : profile ? (
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mt-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h3 className="text-2xl font-bold text-slate-900">About</h3>
            {canEditProfile && onEditProfile ? (
              <button
                type="button"
                onClick={onEditProfile}
                disabled={!profile}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-[#0E2A50] hover:bg-slate-50 disabled:opacity-50"
              >
                <Edit2 size={16} />
                Edit profile
              </button>
            ) : null}
          </div>
          <p className="text-sm text-slate-600 leading-7 whitespace-pre-wrap">
            {(profile.description ?? '').trim()
              ? profile.description
              : canEditProfile
                ? 'No overview yet. Click Edit profile to add one.'
                : 'No description provided.'}
          </p>
        </div>
        <CompanyInfoCard profile={profile} />
      </div>
    ) : null;

  const opportunitiesTab = (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mt-6">
      <div>{opportunitiesPanel}</div>
      {profile ? <CompanyInfoCard profile={profile} /> : <div className="hidden lg:block" />}
    </div>
  );

  return (
    <div className="space-y-4">
      {hero}
      {section === 'about' ? aboutPanel : opportunitiesTab}
    </div>
  );
}
