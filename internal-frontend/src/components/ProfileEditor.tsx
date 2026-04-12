'use client';

import React, { useEffect, useState } from 'react';
import { Save, Trash2, Upload, X } from 'lucide-react';
import type { Student } from '@/src/types';
import { toast } from 'sonner';

const NAVY = '#0f2744';

function getTwoInitials(name: string | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

interface ProfileEditorProps {
  student: Student;
  onSave: (updatedStudent: Student) => Promise<void>;
  onUploadCv: (file: File) => Promise<void>;
  onDeleteCv: () => Promise<void>;
  onDownloadFile: (path: string, filename: string) => Promise<void>;
  onCancel: () => void;
  onRefreshProfile?: () => Promise<void>;
  onUploadProfilePhoto?: (file: File) => Promise<void>;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({
  student,
  onSave,
  onUploadCv,
  onDeleteCv,
  onDownloadFile,
  onCancel,
  onUploadProfilePhoto,
}) => {
  const [formData, setFormData] = useState<Student>({ ...student });
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [newHobby, setNewHobby] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      fullName: student.fullName,
      email: student.email,
      phone: student.phone,
      universityId: student.universityId,
      departmentId: student.departmentId,
      studyFieldId: student.studyFieldId,
      university: student.university,
      departmentName: student.departmentName,
      studyFieldName: student.studyFieldName,
      studyYear: student.studyYear,
      cgpa: student.cgpa,
      hasCompletedPP: student.hasCompletedPP,
      accessStartDate: student.accessStartDate,
      accessEndDate: student.accessEndDate,
      profilePhotoUrl: student.profilePhotoUrl,
      coverPhotoUrl: student.coverPhotoUrl,
      projects: student.projects,
      experiences: student.experiences,
      extendedProfile: {
        ...prev.extendedProfile!,
        description: student.extendedProfile?.description || '',
        skills: student.extendedProfile?.skills || [],
        certificates: student.extendedProfile?.certificates || [],
        languages: student.extendedProfile?.languages || [],
        experience: student.extendedProfile?.experience || [],
        hobbies: student.extendedProfile?.hobbies || [],
        cvUrl: student.extendedProfile?.cvUrl,
        cvFilename: student.extendedProfile?.cvFilename,
        cvFile: student.extendedProfile?.cvFile,
        certificationFiles: student.extendedProfile?.certificationFiles || [],
      },
    }));
  }, [student]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'extendedProfile.description') {
      setFormData((prev) => ({
        ...prev,
        extendedProfile: {
          ...prev.extendedProfile!,
          description: value,
        },
      }));
      return;
    }

    if (name === 'studyFieldName') {
      setFormData((prev) => ({ ...prev, studyFieldName: value }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSkill = () => {
    const skill = newSkill.trim();
    if (!skill || formData.extendedProfile?.skills.includes(skill)) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      extendedProfile: {
        ...prev.extendedProfile!,
        skills: [...(prev.extendedProfile?.skills || []), skill],
      },
    }));
    setNewSkill('');
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      extendedProfile: {
        ...prev.extendedProfile!,
        skills: (prev.extendedProfile?.skills || []).filter((item) => item !== skill),
      },
    }));
  };

  const handleAddLanguage = () => {
    const language = newLanguage.trim();
    if (!language || formData.extendedProfile?.languages.includes(language)) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      extendedProfile: {
        ...prev.extendedProfile!,
        languages: [...(prev.extendedProfile?.languages || []), language],
      },
    }));
    setNewLanguage('');
  };

  const handleRemoveLanguage = (lang: string) => {
    setFormData((prev) => ({
      ...prev,
      extendedProfile: {
        ...prev.extendedProfile!,
        languages: (prev.extendedProfile?.languages || []).filter((item) => item !== lang),
      },
    }));
  };

  const handleAddHobby = () => {
    const hobby = newHobby.trim();
    if (!hobby || formData.extendedProfile?.hobbies.includes(hobby)) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      extendedProfile: {
        ...prev.extendedProfile!,
        hobbies: [...(prev.extendedProfile?.hobbies || []), hobby],
      },
    }));
    setNewHobby('');
  };

  const handleRemoveHobby = (hobby: string) => {
    setFormData((prev) => ({
      ...prev,
      extendedProfile: {
        ...prev.extendedProfile!,
        hobbies: (prev.extendedProfile?.hobbies || []).filter((item) => item !== hobby),
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    void (async () => {
      setIsSaving(true);
      try {
        const ep = formData.extendedProfile;
        await onSave({
          ...formData,
          extendedProfile: {
            description: ep?.description ?? '',
            skills: ep?.skills ?? [],
            certificates: ep?.certificates ?? [],
            languages: ep?.languages ?? [],
            experience: [],
            hobbies: ep?.hobbies ?? [],
            cvUrl: ep?.cvUrl,
            cvFilename: ep?.cvFilename,
            cvFile: ep?.cvFile,
            certificationFiles: ep?.certificationFiles ?? [],
          },
        });
        toast.success('Profile updated successfully!');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not save profile.');
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const handleCvSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    void (async () => {
      setIsUploadingCv(true);
      try {
        await onUploadCv(file);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not upload CV.');
      } finally {
        setIsUploadingCv(false);
      }
    })();
  };

  const handleProfilePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUploadProfilePhoto) return;
    void (async () => {
      setIsUploadingPhoto(true);
      try {
        await onUploadProfilePhoto(file);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not upload photo.');
      } finally {
        setIsUploadingPhoto(false);
      }
    })();
  };

  const photoUrl = student.profilePhotoUrl?.trim();

  const renderChipList = (items: string[], onRemove: (value: string) => void) => (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold text-white"
          style={{ backgroundColor: NAVY }}
        >
          {item}
          <button type="button" onClick={() => onRemove(item)} className="text-white/90 transition hover:text-white">
            <X size={14} />
          </button>
        </span>
      ))}
    </div>
  );

  const renderFileCard = ({
    title,
    fileLabel,
    fileName,
    onDownload,
    onDelete,
    deleteDisabled,
    uploadLabel,
    uploadLoadingLabel,
    isUploading,
    onSelectFile,
  }: {
    title: string;
    fileLabel: string;
    fileName?: string;
    onDownload?: () => void;
    onDelete?: () => void;
    deleteDisabled?: boolean;
    uploadLabel: string;
    uploadLoadingLabel: string;
    isUploading: boolean;
    onSelectFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <div className="space-y-3 w-full min-w-0">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3 shadow-sm w-full min-w-0">
        {fileName ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
            <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{fileLabel}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDownload}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-[#163968] transition hover:bg-slate-50"
              >
                Download
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleteDisabled}
                className="rounded-md p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
            No file uploaded yet.
          </div>
        )}
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0E2A59] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#0A2248]">
          <Upload size={14} />
          {isUploading ? uploadLoadingLabel : uploadLabel}
          <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={onSelectFile} />
        </label>
      </div>
    </div>
  );

  const fieldInput =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:ring-2 focus:ring-[#0f2744]';
  const readonlyInput = `${fieldInput} bg-slate-50 text-slate-600 cursor-not-allowed`;

  return (
    <div className="mx-auto max-w-6xl rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-visible">
      <form onSubmit={handleSubmit} className="space-y-8 p-8 sm:p-10">
        <div>
          <h2 className="text-[1.75rem] sm:text-[2rem] font-bold tracking-tight" style={{ color: NAVY }}>
            Edit Profile
          </h2>
          <p className="text-slate-500 text-sm mt-1">Update your profile information and settings.</p>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,260px)_1fr] lg:gap-12 items-start">
          <div className="space-y-6 lg:sticky lg:top-6">
            <div className="flex flex-col items-center text-center pt-1">
              <div
                className="w-[7.5rem] h-[7.5rem] rounded-xl border-4 border-white shadow-lg overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-slate-200"
                style={photoUrl ? { backgroundColor: '#f1f5f9' } : { backgroundColor: NAVY }}
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-3xl font-bold text-white tracking-tight">{getTwoInitials(student.fullName)}</span>
                )}
              </div>
              {onUploadProfilePhoto ? (
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                  style={{ backgroundColor: NAVY }}>
                  <Upload size={16} />
                  {isUploadingPhoto ? 'Uploading…' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    disabled={isUploadingPhoto}
                    onChange={handleProfilePhotoSelected}
                  />
                </label>
              ) : null}
              <p className="text-xs text-slate-500 mt-2">JPG, PNG or GIF (max 5MB)</p>

              <label className="mt-6 block w-full max-w-[16rem] text-left">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Study Field (Banner)
                </span>
                <input
                  type="text"
                  name="studyFieldName"
                  value={formData.studyFieldName || ''}
                  onChange={handleChange}
                  placeholder="e.g. Software Engineer PROFILE"
                  className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  End with <span className="font-semibold">PROFILE</span> for the mint highlight.
                </p>
              </label>
            </div>
          </div>

          <div className="space-y-8 min-w-0">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-4">Personal information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">Email</span>
                  <input type="text" readOnly value={formData.email} className={readonlyInput} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">Phone number</span>
                  <input type="text" readOnly value={formData.phone || ''} className={readonlyInput} placeholder="—" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">Faculty</span>
                  <input
                    type="text"
                    readOnly
                    value={formData.departmentName || ''}
                    className={readonlyInput}
                    placeholder="—"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500">University</span>
                  <input type="text" readOnly value={formData.university} className={readonlyInput} />
                </label>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-900">Introduction</span>
              <textarea
                name="extendedProfile.description"
                value={formData.extendedProfile?.description || ''}
                onChange={handleChange}
                rows={5}
                placeholder="Tell employers about yourself…"
                className="w-full resize-y rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#0f2744] min-h-[120px]"
              />
            </label>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Skills</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Add a skill"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0f2744]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="shrink-0 rounded-full px-4 py-2.5 text-sm font-bold text-white"
                    style={{ backgroundColor: NAVY }}
                  >
                    + Add
                  </button>
                </div>
                {renderChipList(formData.extendedProfile?.skills || [], handleRemoveSkill)}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Languages</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    placeholder="Add a language"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0f2744]"
                  />
                  <button
                    type="button"
                    onClick={handleAddLanguage}
                    className="shrink-0 rounded-full px-4 py-2.5 text-sm font-bold text-white"
                    style={{ backgroundColor: NAVY }}
                  >
                    + Add
                  </button>
                </div>
                {renderChipList(formData.extendedProfile?.languages || [], handleRemoveLanguage)}
              </div>
            </div>

            <div className="space-y-3 w-full min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Hobbies</h3>
              <div className="flex gap-2 w-full min-w-0">
                <input
                  type="text"
                  value={newHobby}
                  onChange={(e) => setNewHobby(e.target.value)}
                  placeholder="Add a hobby"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0f2744]"
                />
                <button
                  type="button"
                  onClick={handleAddHobby}
                  className="shrink-0 rounded-full px-4 py-2.5 text-sm font-bold text-white"
                  style={{ backgroundColor: NAVY }}
                >
                  + Add
                </button>
              </div>
              {renderChipList(formData.extendedProfile?.hobbies || [], handleRemoveHobby)}
            </div>

            <div className="space-y-3 w-full min-w-0">
              {renderFileCard({
                title: 'CV / Resum',
                fileLabel: formData.extendedProfile?.cvFile?.originalFilename || '',
                fileName: formData.extendedProfile?.cvFile?.originalFilename,
                onDownload: () =>
                  void onDownloadFile(
                    formData.extendedProfile?.cvFile?.downloadUrl || '/api/student/profile/cv',
                    formData.extendedProfile?.cvFile?.originalFilename || 'cv.pdf'
                  ),
                onDelete: () => {
                  void (async () => {
                    setPendingDeleteKey('cv');
                    try {
                      await onDeleteCv();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Could not delete CV.');
                    } finally {
                      setPendingDeleteKey(null);
                    }
                  })();
                },
                deleteDisabled: pendingDeleteKey === 'cv',
                uploadLabel: 'Upload New CV',
                uploadLoadingLabel: 'Uploading…',
                isUploading: isUploadingCv,
                onSelectFile: handleCvSelected,
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-8 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center justify-center gap-2 rounded-xl px-8 py-3 text-base font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: NAVY }}
          >
            <Save size={18} />
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileEditor;
