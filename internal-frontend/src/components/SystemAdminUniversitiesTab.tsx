'use client';

import React, { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Edit2, Power, Trash2, Building2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  AdminUniversityCreateRequest,
  AdminUniversityResponse,
  AdminUniversityUpdateRequest,
  createSysAdminUniversity,
  deleteSysAdminUniversity,
  fetchSysAdminUniversities,
  setSysAdminUniversityActive,
  updateSysAdminUniversity,
} from '@/src/lib/auth/sysadmin';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { uploadUniversityProfilePhoto } from '@/src/lib/supabase/companyProfilePhotos';

interface Props {
  accessToken: string;
  accessTokenRef?: MutableRefObject<string | null>;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
}

const SystemAdminUniversitiesTab: React.FC<Props> = ({ accessToken, accessTokenRef }) => {
  const [items, setItems] = useState<AdminUniversityResponse[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUniversityResponse | null>(null);
  const [pendingToggle, setPendingToggle] = useState<AdminUniversityResponse | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUniversityResponse | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const token = (accessTokenRef?.current ?? '') || accessToken;
    setLoading(true);
    const { data, errorMessage } = await fetchSysAdminUniversities(token);
    if (errorMessage) {
      setErrorMessage(errorMessage);
      setItems([]);
      setStats({ total: 0, active: 0, inactive: 0 });
    } else if (data) {
      setItems(data.items);
      setStats({ total: data.total, active: data.active, inactive: data.inactive });
      setErrorMessage(null);
    }
    setLoading(false);
  }, [accessToken, accessTokenRef]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) => {
      const fields = [u.name, u.email, u.location, u.website].filter(Boolean) as string[];
      return fields.some((f) => f.toLowerCase().includes(q));
    });
  }, [items, searchTerm]);

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (u: AdminUniversityResponse) => {
    setEditTarget(u);
    setFormOpen(true);
  };

  const handleSubmit = async (
    payload: AdminUniversityCreateRequest | AdminUniversityUpdateRequest,
    logoFile: File | null,
    coverFile: File | null,
    logoRemoved: boolean,
    coverRemoved: boolean,
  ): Promise<boolean> => {
    const token = (accessTokenRef?.current ?? '') || accessToken;

    if (editTarget) {
      // Edit flow: upload images first (we have the universityId), then PUT once with the new URLs.
      const update = { ...(payload as AdminUniversityUpdateRequest) };
      const uploaded = await uploadImagesIfAny(editTarget.universityId, logoFile, coverFile);
      if (uploaded.errorMessage) {
        toast.error(uploaded.errorMessage);
        return false;
      }
      // New upload wins; explicit removal sends '' (which the backend treats as "clear").
      // Otherwise the field is omitted, leaving the existing value untouched.
      if (uploaded.logoUrl) update.logoUrl = uploaded.logoUrl;
      else if (logoRemoved) update.logoUrl = '';
      if (uploaded.coverUrl) update.coverUrl = uploaded.coverUrl;
      else if (coverRemoved) update.coverUrl = '';
      const { errorMessage } = await updateSysAdminUniversity(token, editTarget.universityId, update);
      if (errorMessage) {
        toast.error(errorMessage);
        return false;
      }
      toast.success('University updated');
    } else {
      // Create flow: create the row first to get universityId, then upload images, then patch the URLs in.
      const create = payload as AdminUniversityCreateRequest;
      const { data, errorMessage } = await createSysAdminUniversity(token, create);
      if (errorMessage || !data) {
        toast.error(errorMessage ?? 'Could not create university.');
        return false;
      }
      if (logoFile || coverFile) {
        const uploaded = await uploadImagesIfAny(data.universityId, logoFile, coverFile);
        if (uploaded.errorMessage) {
          toast.warning(`University created, but image upload failed: ${uploaded.errorMessage}`);
        } else if (uploaded.logoUrl || uploaded.coverUrl) {
          // The backend's PUT replaces all updatable fields, so the patch must
          // re-send everything the create supplied — otherwise location/website/etc. get wiped.
          const patch: AdminUniversityUpdateRequest = {
            name: create.name,
            location: create.location ?? null,
            description: create.description ?? null,
            website: create.website ?? null,
            founded: create.founded ?? null,
            specialties: create.specialties ?? null,
            numberOfEmployees: create.numberOfEmployees ?? null,
          };
          if (uploaded.logoUrl) patch.logoUrl = uploaded.logoUrl;
          if (uploaded.coverUrl) patch.coverUrl = uploaded.coverUrl;
          const { errorMessage: patchErr } = await updateSysAdminUniversity(token, data.universityId, patch);
          if (patchErr) {
            toast.warning(`University created, but saving image URLs failed: ${patchErr}`);
          }
        }
      }
      toast.success(`Invite email sent to ${create.email}`);
    }
    setFormOpen(false);
    setEditTarget(null);
    await refresh();
    return true;
  };

  const requestToggle = (u: AdminUniversityResponse) => {
    setPendingToggle(u);
  };

  const confirmToggle = async () => {
    if (!pendingToggle) return;
    const target = pendingToggle;
    const newActive = !target.isActive;
    setTogglingId(target.universityId);
    const token = (accessTokenRef?.current ?? '') || accessToken;
    const { errorMessage } = await setSysAdminUniversityActive(token, target.universityId, newActive);
    setTogglingId(null);
    setPendingToggle(null);
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }
    toast.success(newActive ? 'University activated' : 'University deactivated');
    await refresh();
  };

  const requestDelete = (u: AdminUniversityResponse) => {
    setPendingDelete(u);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeletingId(target.universityId);
    const token = (accessTokenRef?.current ?? '') || accessToken;
    const { errorMessage } = await deleteSysAdminUniversity(token, target.universityId);
    setDeletingId(null);
    setPendingDelete(null);
    if (errorMessage) {
      toast.error(errorMessage);
      await refresh();
      return;
    }
    toast.success('University deleted');
    await refresh();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold text-[#002B5B]">University Management</h1>
          <p className="text-slate-500 mt-1">Manage university onboarding and information</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-[#002B5B] hover:bg-[#001F42] text-white font-bold px-5 py-3 rounded-xl transition-colors"
        >
          <Plus size={18} strokeWidth={2.5} />
          Add University
        </button>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Universities" value={stats.total} valueClass="text-[#002B5B]" />
        <StatCard label="Active" value={stats.active} valueClass="text-emerald-600" />
        <StatCard label="Inactive" value={stats.inactive} valueClass="text-rose-500" />
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search universities..."
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002B5B] focus:ring-2 focus:ring-[#002B5B]/10 outline-none text-slate-700"
          />
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">Loading universities...</div>
        ) : errorMessage ? (
          <div className="p-10 text-center text-rose-500">{errorMessage}</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            {items.length === 0 ? 'No universities yet. Click + Add University to onboard one.' : 'No matches.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] tracking-widest uppercase">
                  <th className="text-left px-6 py-4 font-bold">University</th>
                  <th className="text-left px-6 py-4 font-bold">Location</th>
                  <th className="text-left px-6 py-4 font-bold">Founded</th>
                  <th className="text-left px-6 py-4 font-bold">Employees</th>
                  <th className="text-left px-6 py-4 font-bold">Status</th>
                  <th className="text-left px-6 py-4 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((u) => {
                  const deleteTitle = u.canDelete
                    ? `Delete ${u.name} permanently`
                    : `Has dependent records (${u.departmentCount} departments, ${u.studentCount} students) — deactivate instead`;
                  return (
                    <tr key={u.universityId} className="border-t border-slate-100 hover:bg-slate-50/40">
                      <td className="px-6 py-4">
                        <div className="font-bold text-[#002B5B]">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.website || '—'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{u.location || '—'}</td>
                      <td className="px-6 py-4 text-slate-600">{u.founded ?? '—'}</td>
                      <td className="px-6 py-4 text-slate-600">{u.numberOfEmployees ?? '—'}</td>
                      <td className="px-6 py-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Active</span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-600">Inactive</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openEdit(u)}
                            aria-label={`Edit ${u.name}`}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#002B5B] transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => requestToggle(u)}
                            disabled={togglingId === u.universityId}
                            aria-label={u.isActive ? `Deactivate ${u.name}` : `Activate ${u.name}`}
                            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                              u.isActive ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            <Power size={16} />
                          </button>
                          <button
                            onClick={() => requestDelete(u)}
                            disabled={!u.canDelete || deletingId === u.universityId}
                            aria-label={`Delete ${u.name}`}
                            title={deleteTitle}
                            className={`p-2 rounded-lg transition-colors ${
                              u.canDelete
                                ? 'text-rose-500 hover:bg-rose-50 disabled:opacity-50'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <UniversityFormModal
          mode={editTarget ? 'edit' : 'create'}
          initial={editTarget}
          onClose={() => {
            setFormOpen(false);
            setEditTarget(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {pendingToggle && (
        <ConfirmDialog
          title={pendingToggle.isActive ? 'Deactivate university?' : 'Activate university?'}
          message={
            pendingToggle.isActive
              ? `Deactivate ${pendingToggle.name}? Its admin and PPAs will be unable to log in until reactivated. Students stay logged in but cannot create new Professional Practice applications.`
              : `Reactivate ${pendingToggle.name}? Its admin and PPAs will regain access.`
          }
          confirmLabel={pendingToggle.isActive ? 'Deactivate' : 'Activate'}
          confirmTone={pendingToggle.isActive ? 'danger' : 'primary'}
          onCancel={() => setPendingToggle(null)}
          onConfirm={confirmToggle}
          loading={togglingId === pendingToggle.universityId}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Permanently delete university?"
          message={`Permanently delete ${pendingDelete.name}? This action cannot be undone. The university's admin account will be removed.`}
          confirmLabel="Delete"
          confirmTone="danger"
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
          loading={deletingId === pendingDelete.universityId}
        />
      )}
    </div>
  );
};

async function uploadImagesIfAny(
  universityId: number,
  logoFile: File | null,
  coverFile: File | null,
): Promise<{ logoUrl: string | null; coverUrl: string | null; errorMessage: string | null }> {
  if (!logoFile && !coverFile) {
    return { logoUrl: null, coverUrl: null, errorMessage: null };
  }
  const supabase = getSupabaseBrowserClient();
  let logoUrl: string | null = null;
  let coverUrl: string | null = null;
  if (logoFile) {
    const r = await uploadUniversityProfilePhoto(supabase, 'logo', universityId, logoFile);
    if (r.errorMessage) return { logoUrl: null, coverUrl: null, errorMessage: r.errorMessage };
    logoUrl = r.publicUrl;
  }
  if (coverFile) {
    const r = await uploadUniversityProfilePhoto(supabase, 'cover', universityId, coverFile);
    if (r.errorMessage) return { logoUrl, coverUrl: null, errorMessage: r.errorMessage };
    coverUrl = r.publicUrl;
  }
  return { logoUrl, coverUrl, errorMessage: null };
}

function StatCard({ label, value, valueClass }: { label: string; value: number; valueClass: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">{label}</div>
      <div className={`mt-2 text-4xl font-extrabold ${valueClass}`}>{value}</div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmTone,
  onCancel,
  onConfirm,
  loading,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmTone: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/55 flex items-center justify-center px-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold text-[#002B5B]">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2 rounded-xl text-white font-bold disabled:opacity-50 ${
              confirmTone === 'danger' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-[#002B5B] hover:bg-[#001F42]'
            }`}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FormState {
  name: string;
  email: string;
  location: string;
  description: string;
  website: string;
  founded: string;
  specialties: string;
  numberOfEmployees: string;
}

function UniversityFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initial: AdminUniversityResponse | null;
  onClose: () => void;
  onSubmit: (
    payload: AdminUniversityCreateRequest | AdminUniversityUpdateRequest,
    logoFile: File | null,
    coverFile: File | null,
    logoRemoved: boolean,
    coverRemoved: boolean,
  ) => Promise<boolean>;
}) {
  const [state, setState] = useState<FormState>({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    location: initial?.location ?? '',
    description: initial?.description ?? '',
    website: initial?.website ?? '',
    founded: initial?.founded != null ? String(initial.founded) : '',
    specialties: initial?.specialties ?? '',
    numberOfEmployees: initial?.numberOfEmployees != null ? String(initial.numberOfEmployees) : '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial?.logoUrl ?? null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initial?.coverUrl ?? null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setState((s) => ({ ...s, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const onPickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : initial?.logoUrl ?? null);
    if (file) setLogoRemoved(false);
  };

  const onPickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : initial?.coverUrl ?? null);
    if (file) setCoverRemoved(false);
  };

  const onRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoRemoved(true);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const onRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setCoverRemoved(true);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!state.name.trim()) next.name = 'Name is required';
    if (mode === 'create') {
      const email = state.email.trim();
      if (!email) next.email = 'Email is required';
      else if (!/.+@.+\..+/.test(email)) next.email = 'Email format is invalid';
    }
    if (state.founded.trim()) {
      const n = Number(state.founded);
      const currentYear = new Date().getFullYear();
      if (!Number.isInteger(n) || n < 1800 || n > currentYear + 1) {
        next.founded = `Founded must be between 1800 and ${currentYear + 1}`;
      }
    }
    if (state.numberOfEmployees.trim()) {
      const n = Number(state.numberOfEmployees);
      if (!Number.isInteger(n) || n < 0) next.numberOfEmployees = 'Must be a non-negative integer';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const profileFields = {
      location: state.location.trim() || null,
      description: state.description.trim() || null,
      website: state.website.trim() || null,
      founded: state.founded.trim() ? Number(state.founded) : null,
      specialties: state.specialties.trim() || null,
      numberOfEmployees: state.numberOfEmployees.trim() ? Number(state.numberOfEmployees) : null,
    };
    const payload =
      mode === 'create'
        ? ({
            name: state.name.trim(),
            email: state.email.trim().toLowerCase(),
            ...profileFields,
          } as AdminUniversityCreateRequest)
        : ({ name: state.name.trim(), ...profileFields } as AdminUniversityUpdateRequest);
    const ok = await onSubmit(payload, logoFile, coverFile, logoRemoved, coverRemoved);
    setSubmitting(false);
    if (!ok) return;
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#002B5B] focus:ring-2 focus:ring-[#002B5B]/10 outline-none';
  const disabledInputClass =
    'w-full px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 outline-none cursor-not-allowed';
  const uploadButtonClass =
    'inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50';

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/55 overflow-y-auto px-4 py-8" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-xl max-w-3xl w-full mx-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#002B5B]/10 text-[#002B5B] flex items-center justify-center">
            <Building2 size={18} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#002B5B]">
              {mode === 'create' ? 'Add University' : 'Edit University'}
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="University name" required error={errors.name}>
                <input
                  type="text"
                  value={state.name}
                  onChange={update('name')}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field
              label="Admin email"
              required={mode === 'create'}
              hint={mode === 'create' ? "We'll email the new admin a link to set their password." : 'Email is immutable after creation.'}
              error={errors.email}
            >
              <input
                type="email"
                value={state.email}
                onChange={update('email')}
                disabled={mode === 'edit'}
                className={mode === 'edit' ? disabledInputClass : inputClass}
              />
            </Field>

            <Field label="Location">
              <input
                type="text"
                value={state.location}
                onChange={update('location')}
                className={inputClass}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea
                  value={state.description}
                  onChange={update('description')}
                  rows={3}
                  placeholder="Brief description of the university"
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </div>

            <Field label="Website">
              <input
                type="text"
                value={state.website}
                onChange={update('website')}
                placeholder="https://..."
                className={inputClass}
              />
            </Field>

            <Field label="Founded year" error={errors.founded}>
              <input
                type="number"
                inputMode="numeric"
                value={state.founded}
                onChange={update('founded')}
                className={inputClass}
              />
            </Field>

            <Field label="Number of employees" error={errors.numberOfEmployees}>
              <input
                type="number"
                inputMode="numeric"
                value={state.numberOfEmployees}
                onChange={update('numberOfEmployees')}
                className={inputClass}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Specialties">
                <textarea
                  value={state.specialties}
                  onChange={update('specialties')}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Logo">
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-slate-400">No logo</span>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onPickLogo}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className={uploadButtonClass}
                  >
                    <Upload size={16} />
                    Upload Logo
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={onRemoveLogo}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 font-bold hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Cover Image">
                <div className="space-y-3">
                  <div className="w-full h-40 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {coverPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">No cover image</span>
                    )}
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onPickCover}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className={uploadButtonClass}
                    >
                      <Upload size={16} />
                      Upload Cover
                    </button>
                    {coverPreview && (
                      <button
                        type="button"
                        onClick={onRemoveCover}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 font-bold hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-5 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-[#002B5B] hover:bg-[#001F42] text-white font-bold disabled:opacity-50"
            >
              {submitting ? 'Saving…' : mode === 'create' ? 'Create university' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-bold text-slate-600 mb-1">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </div>
      {children}
      {hint && !error && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
      {error && <div className="text-[11px] text-rose-500 mt-1">{error}</div>}
    </label>
  );
}

export default SystemAdminUniversitiesTab;
