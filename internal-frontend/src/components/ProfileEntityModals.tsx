'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import type { StudentExperience, StudentProfileFile } from '@/src/types';
import type { StudentExperienceWrite, StudentProjectWrite } from '@/src/lib/auth/userAccount';

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50"
      role="dialog"
      aria-modal
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0f2744]';

export function ExperienceFormModal({
  open,
  title,
  initial,
  onClose,
  submit,
  onSuccess,
}: {
  open: boolean;
  title: string;
  initial: StudentExperience | null;
  onClose: () => void;
  submit: (body: StudentExperienceWrite) => Promise<string | null>;
  onSuccess: () => Promise<void>;
}) {
  const [companyName, setCompanyName] = useState('');
  const [position, setPosition] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCompanyName(initial?.companyName || '');
    setPosition(initial?.position || '');
    setStartDate(initial?.startDate?.slice(0, 10) || '');
    setEndDate(initial?.endDate?.slice(0, 10) || '');
    setDescription(initial?.description || '');
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      setLoading(true);
      try {
        const err = await submit({
          companyName: companyName.trim(),
          position: position.trim(),
          startDate: startDate || null,
          endDate: endDate || null,
          description: description.trim() || null,
        });
        if (err) {
          toast.error(err);
          return;
        }
        await onSuccess();
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save.');
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <ModalShell title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs font-bold text-slate-500 uppercase">Company</label>
        <input className={inputCls} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        <label className="block text-xs font-bold text-slate-500 uppercase">Position</label>
        <input className={inputCls} value={position} onChange={(e) => setPosition(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start</label>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End</label>
            <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <label className="block text-xs font-bold text-slate-500 uppercase">Description</label>
        <textarea
          className={`${inputCls} min-h-[88px] resize-y`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#0f2744] text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function ProjectFormModal({
  open,
  title,
  initial,
  onClose,
  submit,
  onSuccess,
}: {
  open: boolean;
  title: string;
  initial: { projectId: number; title: string; githubUrl?: string | null; description?: string | null; skills?: string | null } | null;
  onClose: () => void;
  submit: (body: StudentProjectWrite) => Promise<string | null>;
  onSuccess: () => Promise<void>;
}) {
  const [projTitle, setProjTitle] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [skills, setSkills] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProjTitle(initial?.title || '');
    setGithubUrl(initial?.githubUrl || '');
    setDesc(initial?.description || '');
    setSkills(initial?.skills || '');
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      setLoading(true);
      try {
        const err = await submit({
          title: projTitle.trim(),
          githubUrl: githubUrl.trim() || null,
          description: desc.trim() || null,
          skills: skills.trim() || null,
        });
        if (err) {
          toast.error(err);
          return;
        }
        await onSuccess();
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save.');
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <ModalShell title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs font-bold text-slate-500 uppercase">Title</label>
        <input className={inputCls} value={projTitle} onChange={(e) => setProjTitle(e.target.value)} required />
        <label className="block text-xs font-bold text-slate-500 uppercase">GitHub URL</label>
        <input className={inputCls} value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://..." />
        <label className="block text-xs font-bold text-slate-500 uppercase">Description</label>
        <textarea className={`${inputCls} min-h-[88px]`} value={desc} onChange={(e) => setDesc(e.target.value)} />
        <label className="block text-xs font-bold text-slate-500 uppercase">Skills (comma-separated)</label>
        <input className={inputCls} value={skills} onChange={(e) => setSkills(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#0f2744] text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function CertificationEditModal({
  open,
  file,
  onClose,
  submit,
  onSuccess,
}: {
  open: boolean;
  file: StudentProfileFile | null;
  onClose: () => void;
  submit: (body: { displayName?: string; issuer?: string; issueDate?: string | null }) => Promise<string | null>;
  onSuccess: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !file) return;
    setDisplayName(file.displayName || '');
    setIssuer(file.issuer || '');
    setIssueDate(file.issueDate?.slice(0, 10) || '');
  }, [open, file]);

  if (!open || !file) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      setLoading(true);
      try {
        const err = await submit({
          displayName: displayName.trim(),
          issuer: issuer.trim() || undefined,
          issueDate: issueDate || null,
        });
        if (err) {
          toast.error(err);
          return;
        }
        await onSuccess();
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save.');
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <ModalShell title="Edit certification" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-slate-500">File: {file.originalFilename}</p>
        <label className="block text-xs font-bold text-slate-500 uppercase">Display name</label>
        <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        <label className="block text-xs font-bold text-slate-500 uppercase">Issuer</label>
        <input className={inputCls} value={issuer} onChange={(e) => setIssuer(e.target.value)} />
        <label className="block text-xs font-bold text-slate-500 uppercase">Issue date</label>
        <input type="date" className={inputCls} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#0f2744] text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function CertificationUploadModal({
  open,
  onClose,
  onPickFile,
  uploading,
}: {
  open: boolean;
  onClose: () => void;
  onPickFile: (file: File, displayName: string) => void;
  uploading: boolean;
}) {
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (open) setDisplayName('');
  }, [open]);

  if (!open) return null;

  return (
    <ModalShell title="Add certification" onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-500 uppercase">Display name</label>
        <input
          className={inputCls}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. AWS Solutions Architect"
        />
        <label className="inline-flex items-center gap-2 rounded-lg bg-[#0f2744] text-white px-4 py-2 text-sm font-semibold cursor-pointer">
          Choose PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              onPickFile(f, displayName.trim() || f.name.replace(/\.pdf$/i, ''));
            }}
          />
        </label>
        {uploading ? <p className="text-xs text-slate-500">Uploading…</p> : null}
      </div>
    </ModalShell>
  );
}
