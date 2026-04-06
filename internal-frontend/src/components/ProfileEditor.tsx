'use client';

import React, { useEffect, useState } from 'react';
import { Upload, Save, Trash2, X } from 'lucide-react';
import { Student } from '@/src/types';
import { toast } from 'sonner';

interface ProfileEditorProps {
  student: Student;
  onSave: (updatedStudent: Student) => Promise<void>;
  onUploadCv: (file: File) => Promise<void>;
  onDeleteCv: () => Promise<void>;
  onUploadCertification: (file: File, displayName?: string) => Promise<void>;
  onDeleteCertification: (certificationId: number) => Promise<void>;
  onDownloadFile: (path: string, filename: string) => Promise<void>;
  onCancel: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({
  student,
  onSave,
  onUploadCv,
  onDeleteCv,
  onUploadCertification,
  onDeleteCertification,
  onDownloadFile,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Student>({ ...student });
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [newHobby, setNewHobby] = useState('');
  const [experienceText, setExperienceText] = useState(
    (student.extendedProfile?.experience || []).join(', ')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [isUploadingCertification, setIsUploadingCertification] = useState(false);
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
    setExperienceText((student.extendedProfile?.experience || []).join(', '));
  }, [student]);

  const parseCommaSeparatedList = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

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

    if (name === 'extendedProfile.experience') {
      setExperienceText(value);
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
        await onSave({
          ...formData,
          extendedProfile: {
            ...formData.extendedProfile!,
            experience: parseCommaSeparatedList(experienceText),
            hobbies: formData.extendedProfile?.hobbies || [],
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

  const handleCertificationSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    void (async () => {
      setIsUploadingCertification(true);
      try {
        await onUploadCertification(file);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not upload certification.');
      } finally {
        setIsUploadingCertification(false);
      }
    })();
  };

  const renderChipList = (items: string[], onRemove: (value: string) => void) => (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-2 rounded-full bg-[#EAF0FB] px-3 py-1 text-sm font-semibold text-[#163968]"
        >
          {item}
          <button
            type="button"
            onClick={() => onRemove(item)}
            className="text-[#163968] transition hover:text-red-500"
          >
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
    <div className="space-y-3">
      <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">{title}</h3>
      <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3 shadow-sm">
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

  return (
    <div className="mx-auto max-w-5xl rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-8 p-9">
        <div>
          <h2 className="text-[2rem] font-bold tracking-tight text-slate-900">Edit Profile</h2>
        </div>

        <label className="block">
          <span className="mb-3 block text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
            About Me
          </span>
          <textarea
            name="extendedProfile.description"
            value={formData.extendedProfile?.description || ''}
            onChange={handleChange}
            rows={4}
            placeholder="Let's introduce myself. I'm..."
            className="w-full resize-none rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-4 text-sm text-slate-700 outline-none transition-all focus:ring-2 focus:ring-[#163968]"
          />
        </label>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Skills</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add a skill..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[#163968]"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="rounded-xl bg-[#20948B] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#1A7A72]"
              >
                Add
              </button>
            </div>
            {renderChipList(formData.extendedProfile?.skills || [], handleRemoveSkill)}
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Languages</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                placeholder="Add a language..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[#163968]"
              />
              <button
                type="button"
                onClick={handleAddLanguage}
                className="rounded-xl bg-[#20948B] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#1A7A72]"
              >
                Add
              </button>
            </div>
            {renderChipList(formData.extendedProfile?.languages || [], handleRemoveLanguage)}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Hobbies</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newHobby}
                onChange={(e) => setNewHobby(e.target.value)}
                placeholder="Add a hobby..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-[#163968]"
              />
              <button
                type="button"
                onClick={handleAddHobby}
                className="rounded-xl bg-[#20948B] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#1A7A72]"
              >
                Add
              </button>
            </div>
            {renderChipList(formData.extendedProfile?.hobbies || [], handleRemoveHobby)}
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-3 block text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                Experiences
              </span>
              <textarea
                name="extendedProfile.experience"
                value={experienceText}
                onChange={handleChange}
                rows={4}
                placeholder="Experiences should be included here."
                className="w-full resize-none rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-4 text-sm text-slate-700 outline-none transition-all focus:ring-2 focus:ring-[#163968]"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Certification Files</h3>
            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3 shadow-sm">
              <div className="space-y-3">
                {formData.extendedProfile?.certificationFiles?.length ? (
                  formData.extendedProfile.certificationFiles.map((file) => (
                    <div
                      key={file.certificationId ?? file.originalFilename}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                    >
                      <span className="min-w-0 truncate text-sm font-semibold text-slate-800">
                        {file.displayName || file.originalFilename}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void onDownloadFile(
                              file.downloadUrl || `/api/student/profile/certifications/${file.certificationId}`,
                              file.originalFilename
                            )
                          }
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-[#163968] transition hover:bg-slate-50"
                        >
                          Download
                        </button>
                        {typeof file.certificationId === 'number' ? (
                          <button
                            type="button"
                            disabled={pendingDeleteKey === `cert-${file.certificationId}`}
                            onClick={() => {
                              const certificationId = file.certificationId;
                              if (typeof certificationId !== 'number') {
                                return;
                              }
                              void (async () => {
                                setPendingDeleteKey(`cert-${certificationId}`);
                                try {
                                  await onDeleteCertification(certificationId);
                                } catch (error) {
                                  toast.error(
                                    error instanceof Error ? error.message : 'Could not delete certification.'
                                  );
                                } finally {
                                  setPendingDeleteKey(null);
                                }
                              })();
                            }}
                            className="rounded-md p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                    No certification files uploaded yet.
                  </div>
                )}
              </div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0E2A59] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#0A2248]">
                <Upload size={14} />
                {isUploadingCertification ? 'Uploading...' : 'Upload Certification'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleCertificationSelected}
                />
              </label>
            </div>
          </div>

          {renderFileCard({
            title: 'CV',
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
            uploadLabel: 'Upload CV',
            uploadLoadingLabel: 'Uploading CV...',
            isUploading: isUploadingCv,
            onSelectFile: handleCvSelected,
          })}
        </div>

        <div className="flex justify-end gap-4 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-8 py-3 text-base font-semibold text-slate-700 transition-all hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-[#0E2A59] px-8 py-3 text-base font-semibold text-white transition-all hover:bg-[#0A2248]"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileEditor;
