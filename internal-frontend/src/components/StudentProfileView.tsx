'use client';

import React, { useMemo, useState } from 'react';
import { Download, Edit2, FileText, ExternalLink, Pencil, Plus, Trash2, Eye } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { Student, StudentExperience, StudentProfileFile, StudentProject } from '@/src/types';
import { toast } from 'sonner';

export type ProfileSectionTab = 'about' | 'projects' | 'certifications';

function getTwoInitials(name: string | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function formatShortDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

function formatMonthYear(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

interface StudentProfileViewProps {
  student: Student;
  projects?: StudentProject[];
  onEdit: () => void;
  onDownloadCv: () => void;
  onPreviewCv: () => void;
  onDownloadCertification: (file: StudentProfileFile) => void;
  onPreviewCertification: (file: StudentProfileFile) => void;
  onEditExperience?: (e: StudentExperience) => void;
  onEditProject?: (p: StudentProject) => void;
  onEditCertification?: (file: StudentProfileFile) => void;
  onDeleteExperience?: (e: StudentExperience) => Promise<void>;
  onDeleteProject?: (p: StudentProject) => Promise<void>;
  onDeleteCertification?: (file: StudentProfileFile) => Promise<void>;
  onAddExperience?: () => void;
  onAddProject?: () => void;
  onAddCertification?: () => void;
}

const NAVY = '#0f2744';
const NAVY_CARD = '#132a47';
/** Mint accent for trailing “PROFILE” (reference header). */
const BANNER_PROFILE_ACCENT = '#7dd3c0';
/** Navy → teal, left → right (matches reference). */
const BANNER_GRADIENT = 'linear-gradient(90deg, #0a1628 0%, #143a5c 36%, #1a4a6e 58%, #2a9d8f 100%)';

function parseBannerTitleParts(raw: string): { before: string; showGreenProfile: boolean } {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(.+?)(\s+PROFILE)$/i);
  if (m) {
    return { before: m[1].trimEnd(), showGreenProfile: true };
  }
  return { before: trimmed, showGreenProfile: false };
}

const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  student,
  projects = [],
  onEdit,
  onDownloadCv,
  onPreviewCv,
  onDownloadCertification,
  onPreviewCertification,
  onEditExperience,
  onEditProject,
  onEditCertification,
  onDeleteExperience,
  onDeleteProject,
  onDeleteCertification,
  onAddExperience,
  onAddProject,
  onAddCertification,
}) => {
  const [section, setSection] = useState<ProfileSectionTab>('about');
  const [skillsExpanded, setSkillsExpanded] = useState(false);

  const skills = student.extendedProfile?.skills || [];
  const visibleSkills = skillsExpanded ? skills : skills.slice(0, 2);
  const hiddenSkillCount = Math.max(0, skills.length - 2);

  const languages = student.extendedProfile?.languages || [];
  const experienceLines = student.extendedProfile?.experience || [];
  const structuredExperiences = student.experiences || [];
  const certifications = student.extendedProfile?.certificationFiles || [];
  const photoUrl = student.profilePhotoUrl?.trim();
  const coverUrl = student.coverPhotoUrl?.trim();

  const subtitleLine = useMemo(() => {
    const parts = [
      student.fullName,
      student.departmentName ? `Faculty of ${student.departmentName}` : null,
    ].filter(Boolean);
    return parts.join(' | ');
  }, [student.fullName, student.departmentName]);

  const roleSubtitle = student.studyFieldName
    ? `${student.studyFieldName} Student`
    : 'Student';

  /** Banner line: DB `banner_title` or “{FIELD} ” + green PROFILE / “STUDENT ” + green PROFILE. */
  const bannerTitleDisplay = useMemo(() => {
    const custom = student.bannerTitle?.trim();
    if (custom) {
      return parseBannerTitleParts(custom);
    }
    const field = student.studyFieldName?.trim();
    if (field) {
      return { before: `${field.toUpperCase()} `, showGreenProfile: true as const };
    }
    return { before: 'STUDENT ', showGreenProfile: true as const };
  }, [student.bannerTitle, student.studyFieldName]);

  const cvLabel =
    student.extendedProfile?.cvFile?.originalFilename ||
    student.extendedProfile?.cvFilename ||
    null;

  const parseProjectSkills = (raw: string | null | undefined): string[] => {
    if (!raw?.trim()) return [];
    return raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  /** Compact pill: similar vertical rhythm to tab labels (text-sm + tab pb-3). */
  const addButtonCls =
    'inline-flex items-center gap-1 shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 leading-none';

  return (
    <div className="w-full max-w-6xl mx-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* overflow-visible so the avatar can hang below the banner without clipping */}
      <div className="relative rounded-t-xl shadow-md overflow-visible">
        <div
          className={cn(
            'relative w-full min-h-[170px] sm:min-h-[190px] md:min-h-[210px] overflow-hidden rounded-t-xl'
          )}
          style={coverUrl ? undefined : { background: BANNER_GRADIENT }}
        >
          {coverUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 pointer-events-none" />
            </>
          ) : null}
          {/* Decorative circle (reference: faint disc on the right) */}
          <div
            className="pointer-events-none absolute -right-12 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-white/[0.08] sm:-right-16 sm:h-52 sm:w-52 md:h-60 md:w-60"
            aria-hidden
          />
          <div className="relative z-10 flex min-h-[170px] sm:min-h-[190px] md:min-h-[210px] w-full flex-col items-center justify-center px-6 sm:px-10 py-8 text-center">
            <h1 className="max-w-[90%] sm:max-w-4xl text-base sm:text-lg md:text-2xl font-bold tracking-wide text-white drop-shadow-md">
              {bannerTitleDisplay.before}
              {bannerTitleDisplay.showGreenProfile ? (
                <span style={{ color: BANNER_PROFILE_ACCENT }}>PROFILE</span>
              ) : null}
            </h1>
            <p className="mt-2 max-w-3xl text-xs sm:text-sm text-white/95 drop-shadow-sm">{subtitleLine}</p>
          </div>
        </div>

        <div className="absolute left-6 sm:left-8 bottom-0 z-30 translate-y-1/2">
          <div
            className={cn(
              'w-[6.5rem] h-[6.5rem] sm:w-[7rem] sm:h-[7rem] rounded-xl border-[3px] border-white shadow-lg overflow-hidden flex items-center justify-center',
              photoUrl && 'bg-slate-100'
            )}
            style={photoUrl ? undefined : { backgroundColor: NAVY }}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {getTwoInitials(student.fullName)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 pt-16 sm:pt-20 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200/90 pb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: NAVY }}>
            {student.fullName}
          </h2>
          <p className="text-slate-600 text-sm mt-1 font-medium">{roleSubtitle}</p>
          {student.departmentName ? (
            <p className="text-slate-500 text-sm">{student.departmentName}</p>
          ) : null}
          <p className="text-slate-500 text-sm">{student.university}</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          suppressHydrationWarning
          className="inline-flex items-center gap-2 self-start px-5 py-2.5 rounded-full text-sm font-semibold text-white shadow-sm hover:opacity-95 transition-opacity"
          style={{ backgroundColor: NAVY }}
        >
          <Edit2 size={16} />
          Edit Profile
        </button>
      </div>

      <div className="px-6 sm:px-8 pt-3 sm:pt-3.5 pb-0 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b border-slate-200">
        <div className="flex gap-8 sm:gap-8 min-w-0 pl-0.5">
          {(
            [
              { id: 'about' as const, label: 'About' },
              { id: 'projects' as const, label: 'Projects' },
              { id: 'certifications' as const, label: 'Certifications' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={cn(
                'pb-3 pt-1 text-sm font-bold border-b-2 -mb-px transition-colors',
                section === tab.id
                  ? 'text-[#0f2744] border-[#0f2744]'
                  : 'text-slate-500 border-transparent hover:text-slate-800'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="pb-3 flex items-center shrink-0">
          {section === 'about' && onAddExperience ? (
            <button type="button" onClick={onAddExperience} className={addButtonCls} style={{ backgroundColor: NAVY }}>
              <Plus size={14} strokeWidth={2.5} className="shrink-0" />
              Add Experience
            </button>
          ) : null}
          {section === 'projects' && onAddProject ? (
            <button type="button" onClick={onAddProject} className={addButtonCls} style={{ backgroundColor: NAVY }}>
              <Plus size={14} strokeWidth={2.5} className="shrink-0" />
              Add Project
            </button>
          ) : null}
          {section === 'certifications' && onAddCertification ? (
            <button type="button" onClick={onAddCertification} className={addButtonCls} style={{ backgroundColor: NAVY }}>
              <Plus size={14} strokeWidth={2.5} className="shrink-0" />
              Add Certification
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-6 sm:px-8 pb-10 grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,280px)] gap-8 mt-8 items-start">
        <div className="space-y-5 lg:order-2">
          <div
            className="rounded-xl px-5 py-5 text-white shadow-sm"
            style={{ backgroundColor: NAVY_CARD }}
          >
            <h3 className="text-sm font-bold mb-4">General Information</h3>
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
                  Email
                </div>
                <div className="font-medium break-all">{student.email || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
                  Phone number
                </div>
                <div className="font-medium">{student.phone || '—'}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">C.V</h3>
            {cvLabel ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <FileText className="text-slate-400 shrink-0" size={22} />
                <button
                  type="button"
                  onClick={onPreviewCv}
                  className="flex-1 text-left text-sm font-medium text-[#0f2744] truncate hover:underline"
                >
                  {cvLabel}
                </button>
                <button
                  type="button"
                  onClick={onDownloadCv}
                  className="p-2 rounded-lg text-slate-600 hover:bg-white hover:text-[#0f2744] transition-colors"
                  aria-label="Download CV"
                >
                  <Download size={18} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No CV uploaded yet.</p>
            )}
          </div>

          <div
            className={cn(
              'rounded-xl px-4 py-3 text-sm font-semibold border',
              student.hasCompletedPP
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            )}
          >
            {student.hasCompletedPP
              ? 'You have completed the Professional Practice.'
              : 'You have not completed the Professional Practice yet.'}
          </div>
        </div>

        <div className="min-w-0 lg:order-1">
          {section === 'about' ? (
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Introduction</h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 leading-relaxed min-h-[100px]">
                  {student.extendedProfile?.description?.trim()
                    ? student.extendedProfile.description
                    : 'No introduction added yet.'}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {visibleSkills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: NAVY }}
                    >
                      {skill}
                    </span>
                  ))}
                  {!skillsExpanded && hiddenSkillCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSkillsExpanded(true)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                    >
                      + {hiddenSkillCount} more
                    </button>
                  ) : null}
                  {skillsExpanded && hiddenSkillCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSkillsExpanded(false)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Show less
                    </button>
                  ) : null}
                  {!skills.length ? (
                    <span className="text-sm text-slate-500">No skills listed yet.</span>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang) => (
                    <span
                      key={lang}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: NAVY }}
                    >
                      {lang}
                    </span>
                  ))}
                  {!languages.length ? (
                    <span className="text-sm text-slate-500">No languages added yet.</span>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">Experience</h3>
                <div className="space-y-3">
                  {structuredExperiences.length ? (
                    structuredExperiences.map((exp) => (
                      <div
                        key={exp.experienceId}
                        className="relative rounded-xl border border-slate-200 bg-white px-4 py-4 pr-14 sm:pr-20 shadow-sm"
                      >
                        <div className="absolute right-2 top-2 flex items-center gap-0.5">
                          {onEditExperience ? (
                            <button
                              type="button"
                              onClick={() => onEditExperience(exp)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#0f2744]"
                              aria-label="Edit experience"
                            >
                              <Pencil size={16} />
                            </button>
                          ) : null}
                          {onDeleteExperience ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm('Remove this experience entry?')) return;
                                void onDeleteExperience(exp).catch((err) => {
                                  toast.error(err instanceof Error ? err.message : 'Could not remove experience.');
                                });
                              }}
                              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              aria-label="Remove experience"
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : null}
                        </div>
                        <p className="text-sm font-bold text-[#0f2744] leading-snug">
                          {exp.position} — {exp.companyName}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatShortDate(exp.startDate) || '—'} –{' '}
                          {exp.endDate ? formatShortDate(exp.endDate) : 'Present'}
                        </p>
                        {exp.description ? (
                          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{exp.description}</p>
                        ) : null}
                      </div>
                    ))
                  ) : experienceLines.length ? (
                    experienceLines.map((line, i) => (
                      <div
                        key={`${i}-${line.slice(0, 24)}`}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                      >
                        <p className="text-sm font-bold text-[#0f2744] leading-snug">{line}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No experience entries yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {section === 'projects' ? (
            <div className="space-y-4">
              {projects.length ? (
                projects.map((p) => {
                  const tags = parseProjectSkills(p.skills);
                  return (
                    <div
                      key={p.projectId}
                      className="relative rounded-xl border border-slate-200 bg-white px-5 py-5 pr-14 sm:pr-20 shadow-sm"
                    >
                      <div className="absolute right-2 top-2 flex items-center gap-0.5">
                        {onEditProject ? (
                          <button
                            type="button"
                            onClick={() => onEditProject(p)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#0f2744]"
                            aria-label="Edit project"
                          >
                            <Pencil size={16} />
                          </button>
                        ) : null}
                        {onDeleteProject ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm('Remove this project?')) return;
                              void onDeleteProject(p).catch((err) => {
                                toast.error(err instanceof Error ? err.message : 'Could not remove project.');
                              });
                            }}
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Remove project"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>
                      <h3 className="text-base font-bold text-[#0f2744]">{p.title}</h3>
                      {p.githubUrl ? (
                        <a
                          href={p.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 font-medium mt-1 hover:underline"
                        >
                          Github link
                          <ExternalLink size={14} />
                        </a>
                      ) : null}
                      {p.description ? (
                        <p className="text-sm text-slate-600 mt-3 leading-relaxed">{p.description}</p>
                      ) : null}
                      {tags.length ? (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {tags.map((t) => (
                            <span
                              key={t}
                              className="px-2.5 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                  No projects added yet. Use Edit Profile when project management is available.
                </div>
              )}
            </div>
          ) : null}

          {section === 'certifications' ? (
            <div className="space-y-4">
              {certifications.length ? (
                certifications.map((file) => {
                  const issued = formatMonthYear(file.uploadedAt);
                  return (
                    <div
                      key={file.certificationId ?? file.originalFilename}
                      className="relative flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-5 sm:pr-24 shadow-sm"
                    >
                      <div className="absolute right-2 top-2 flex items-center gap-0.5 sm:top-1/2 sm:-translate-y-1/2">
                        <button
                          type="button"
                          onClick={() => onPreviewCertification(file)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#0f2744]"
                          aria-label="View certification"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDownloadCertification(file)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#0f2744]"
                          aria-label="Download certification"
                        >
                          <Download size={16} />
                        </button>
                        {onEditCertification && typeof file.certificationId === 'number' ? (
                          <button
                            type="button"
                            onClick={() => onEditCertification(file)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#0f2744]"
                            aria-label="Edit certification"
                          >
                            <Pencil size={16} />
                          </button>
                        ) : null}
                        {onDeleteCertification && typeof file.certificationId === 'number' ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm('Remove this certification? The file will be deleted.')) return;
                              void onDeleteCertification(file).catch((err) => {
                                toast.error(err instanceof Error ? err.message : 'Could not remove certification.');
                              });
                            }}
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Remove certification"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-900">
                          {file.displayName || file.originalFilename}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {file.issuer ? `Issued by ${file.issuer}` : 'Certification file'}
                          {file.originalFilename ? ` · ${file.originalFilename}` : ''}
                        </p>
                        {file.issueDate ? (
                          <p className="text-sm text-slate-500 mt-0.5">
                            Issue date: {formatShortDate(file.issueDate)}
                          </p>
                        ) : issued ? (
                          <p className="text-sm text-slate-500 mt-0.5">Uploaded: {issued}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                  No certifications uploaded yet. Add files from Edit Profile.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StudentProfileView;
