'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchTargetUniversities,
  type CompanyOpportunityCreateBody,
  type TargetUniversityOption,
} from '@/src/lib/auth/companyOpportunities';
import { messageFromUnknown } from '@/src/lib/messageFromUnknown';

interface AddOpportunityFormProps {
  getAccessToken: () => Promise<string | null>;
  onSave: (payload: CompanyOpportunityCreateBody) => Promise<void>;
  onCancel: () => void;
}

function Req({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-semibold text-slate-800 mb-2 block">
      {children} <span className="text-red-500">*</span>
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold text-slate-900 pb-2 mb-4 border-b border-slate-200">{children}</h3>
  );
}

const DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: '3_MONTHS', label: '3 months' },
  { value: '6_MONTHS', label: '6 months' },
  { value: '12_MONTHS', label: '12 months' },
];

const AddOpportunityForm: React.FC<AddOpportunityFormProps> = ({ getAccessToken, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [positionCount, setPositionCount] = useState('1');
  const [deadline, setDeadline] = useState('');
  const [startDate, setStartDate] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [workplaceType, setWorkplaceType] = useState<CompanyOpportunityCreateBody['workplaceType']>('Hybrid');
  const [workType, setWorkType] = useState<CompanyOpportunityCreateBody['workType']>('FULL_TIME');
  const [duration, setDuration] = useState('3_MONTHS');
  const [paid, setPaid] = useState<boolean | null>(null);
  const [salaryMonthly, setSalaryMonthly] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [niceToHave, setNiceToHave] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [targetUniversities, setTargetUniversities] = useState<TargetUniversityOption[]>([]);
  const [targetUniversitiesLoading, setTargetUniversitiesLoading] = useState(true);
  /** `all` = open listing to every university (empty id list to API). */
  const [targetScope, setTargetScope] = useState<'all' | 'selected'>('all');
  const [selectedUniversityIds, setSelectedUniversityIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTargetUniversitiesLoading(true);
      try {
        const token = await getAccessToken();
        if (!token || cancelled) {
          if (!cancelled) setTargetUniversitiesLoading(false);
          return;
        }
        const { data, errorMessage } = await fetchTargetUniversities(token);
        if (cancelled) return;
        if (errorMessage) {
          toast.error(errorMessage);
          setTargetUniversities([]);
        } else {
          setTargetUniversities(data ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(messageFromUnknown(e));
          setTargetUniversities([]);
        }
      } finally {
        if (!cancelled) setTargetUniversitiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s || skills.includes(s)) return;
    setSkills((prev) => [...prev, s]);
    setSkillInput('');
  };

  const removeSkill = (s: string) => setSkills((prev) => prev.filter((x) => x !== s));

  const toggleUniversityTarget = (id: number) => {
    setSelectedUniversityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Job title is required.';
    const pc = Number(positionCount);
    if (!Number.isFinite(pc) || pc < 1) return 'Number of positions must be at least 1.';
    if (!deadline) return 'Application deadline is required.';
    if (!startDate) return 'Expected start date is required.';
    if (!jobLocation.trim()) return 'Location is required.';
    if (paid === null) return 'Select paid status.';
    if (!description.trim()) return 'Job description is required.';
    if (!requirements.trim()) return 'Requirements are required.';
    if (skills.length === 0) return 'Add at least one required skill.';
    if (targetScope === 'selected' && selectedUniversityIds.length === 0) {
      return 'Select at least one target university, or choose “All universities”.';
    }
    if (paid && salaryMonthly.trim()) {
      const sal = Number(salaryMonthly);
      if (!Number.isFinite(sal) || sal < 0) return 'Enter a valid salary amount.';
    }
    return null;
  };

  const buildPayload = (draft: boolean): CompanyOpportunityCreateBody => {
    const salTrim = salaryMonthly.trim();
    const targetUniversityIds =
      targetScope === 'all' ? [] : [...selectedUniversityIds].filter((n) => Number.isFinite(n));
    return {
      title: title.trim(),
      description: description.trim(),
      requiredSkills: skills,
      requirements: requirements.trim(),
      deadline,
      startDate,
      targetUniversityIds,
      positionCount: Math.max(1, Number(positionCount) || 1),
      jobLocation: jobLocation.trim(),
      workplaceType,
      workType,
      duration,
      paid: paid === true,
      salaryMonthly: paid && salTrim ? Number(salTrim) : null,
      niceToHave: niceToHave.trim() || null,
      draft,
    };
  };

  const runSave = async (draft: boolean) => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave(buildPayload(draft));
      toast.success(draft ? 'Draft saved.' : 'Opportunity published.');
    } catch (e) {
      toast.error(messageFromUnknown(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-4xl mx-auto">
      <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create New Opportunity</h2>
          <p className="text-sm text-slate-500 mt-1">Post a new internship opportunity for students</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all shrink-0"
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>

      <div className="p-8 space-y-10">
        <section>
          <SectionTitle>Basic Information</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="block md:col-span-2">
              <Req>Job Title</Req>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Frontend Developer Intern"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
              />
            </label>
            <label className="block">
              <Req>Number of Positions</Req>
              <input
                type="number"
                min={1}
                value={positionCount}
                onChange={(e) => setPositionCount(e.target.value)}
                placeholder="1"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
              />
            </label>
            <label className="block">
              <Req>Application Deadline</Req>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Stored as YYYY-MM-DD; shown in your locale elsewhere.</p>
            </label>
            <label className="block">
              <Req>Expected start date</Req>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">When the internship or role is expected to begin.</p>
            </label>
          </div>
        </section>

        <section>
          <SectionTitle>Job Details</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="block">
              <Req>Location</Req>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                <input
                  type="text"
                  value={jobLocation}
                  onChange={(e) => setJobLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
                />
              </div>
            </label>
            <label className="block">
              <Req>Workplace Type</Req>
              <select
                value={workplaceType}
                onChange={(e) => setWorkplaceType(e.target.value as CompanyOpportunityCreateBody['workplaceType'])}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
              >
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site</option>
              </select>
            </label>
            <label className="block">
              <Req>Work Type</Req>
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value as CompanyOpportunityCreateBody['workType'])}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
              >
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
              </select>
            </label>
            <label className="block">
              <Req>Duration</Req>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
              >
                {DURATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section>
          <SectionTitle>Compensation</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="block">
              <Req>Paid Status</Req>
              <select
                value={paid === null ? '' : paid ? 'paid' : 'unpaid'}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'paid') setPaid(true);
                  else if (v === 'unpaid') {
                    setPaid(false);
                    setSalaryMonthly('');
                  } else setPaid(null);
                }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
              >
                <option value="" disabled>
                  Select…
                </option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-800 mb-2 block">Salary ($ / month)</span>
              <input
                type="number"
                min={0}
                value={salaryMonthly}
                onChange={(e) => setSalaryMonthly(e.target.value)}
                placeholder="e.g. 2500"
                disabled={!paid}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none disabled:opacity-50"
              />
            </label>
          </div>
        </section>

        <section>
          <SectionTitle>Description &amp; Requirements</SectionTitle>
          <div className="space-y-4">
            <label className="block">
              <Req>Job Description</Req>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Describe the role, responsibilities, and what the intern will learn…"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none resize-y min-h-[120px]"
              />
            </label>
            <label className="block">
              <Req>Requirements</Req>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                rows={4}
                placeholder="List the required qualifications, skills, and experience…"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none resize-y min-h-[100px]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-800 mb-2 block">Nice to Have</span>
              <textarea
                value={niceToHave}
                onChange={(e) => setNiceToHave(e.target.value)}
                rows={3}
                placeholder="Optional skills or qualifications that are beneficial…"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none resize-y min-h-[80px]"
              />
            </label>
          </div>
        </section>

        <section>
          <SectionTitle>Required Skills</SectionTitle>
          <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
            {skills.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-[#002B5B] text-white text-sm font-medium"
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeSkill(s)}
                  className="p-0.5 rounded-full hover:bg-white/20"
                  aria-label={`Remove ${s}`}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Add a skill (e.g. JavaScript, Python…)"
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002B5B] outline-none"
            />
            <button
              type="button"
              onClick={addSkill}
              className="px-5 py-3 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#001F42] transition-colors inline-flex items-center gap-2 shrink-0"
            >
              <Plus size={18} />
              Add Skill
            </button>
          </div>
        </section>

        <section>
          <SectionTitle>Target universities</SectionTitle>
          <div className="max-w-xl space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 has-[:checked]:border-[#002B5B] has-[:checked]:bg-[#002B5B]/5">
                <input
                  type="radio"
                  name="targetScope"
                  checked={targetScope === 'all'}
                  onChange={() => {
                    setTargetScope('all');
                    setSelectedUniversityIds([]);
                  }}
                  className="h-4 w-4 border-slate-300 text-[#002B5B] focus:ring-[#002B5B]"
                />
                All universities
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 has-[:checked]:border-[#002B5B] has-[:checked]:bg-[#002B5B]/5">
                <input
                  type="radio"
                  name="targetScope"
                  checked={targetScope === 'selected'}
                  onChange={() => setTargetScope('selected')}
                  className="h-4 w-4 border-slate-300 text-[#002B5B] focus:ring-[#002B5B]"
                />
                Selected only (multi-select)
              </label>
            </div>
            {targetScope === 'selected' ? (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">
                  Choose one or more institutions you want to collaborate with. Each will be notified.
                </p>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                  {targetUniversitiesLoading ? (
                    <p className="p-4 text-sm text-slate-500">Loading universities…</p>
                  ) : targetUniversities.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No universities available.</p>
                  ) : (
                    targetUniversities.map((u) => (
                      <label
                        key={u.universityId}
                        className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50/80"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUniversityIds.includes(u.universityId)}
                          onChange={() => toggleUniversityTarget(u.universityId)}
                          className="h-4 w-4 rounded border-slate-300 text-[#002B5B] focus:ring-[#002B5B]"
                        />
                        <span className="text-sm font-medium text-slate-800">{u.name}</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {selectedUniversityIds.length} selected
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                The listing will be visible to students at every university that uses the platform.
              </p>
            )}
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void runSave(false)}
            className="flex-1 py-3.5 px-6 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#001F42] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Publish Opportunity'}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void runSave(true)}
            className="sm:w-44 py-3.5 px-6 bg-white border border-slate-200 text-slate-800 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="sm:w-36 py-3.5 px-6 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddOpportunityForm;
