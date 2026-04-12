'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface AddOpportunityFormProps {
  onSave: (opportunity: Record<string, unknown>) => void;
  onCancel: () => void;
  companyName: string;
  companyId: string;
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:border-[#002B5B]/40 focus:ring-2 focus:ring-[#002B5B]/20';
const labelClass = 'block text-xs font-bold uppercase tracking-wider text-slate-600';
const sectionTitleClass = 'text-base font-bold text-[#0E2A50]';

const AddOpportunityForm: React.FC<AddOpportunityFormProps> = ({
  onSave,
  onCancel,
  companyName,
  companyId,
}) => {
  const [title, setTitle] = useState('');
  const [positions, setPositions] = useState('1');
  const [deadline, setDeadline] = useState('');
  const [location, setLocation] = useState('');
  const [workplaceType, setWorkplaceType] = useState('');
  const [workType, setWorkType] = useState('');
  const [duration, setDuration] = useState('');
  const [paidStatus, setPaidStatus] = useState('');
  const [salary, setSalary] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [niceToHave, setNiceToHave] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [applicationPP, setApplicationPP] = useState(true);
  const [applicationIG, setApplicationIG] = useState(false);

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s || skills.includes(s)) return;
    setSkills((prev) => [...prev, s]);
    setSkillInput('');
  };

  const removeSkill = (s: string) => setSkills((prev) => prev.filter((x) => x !== s));

  const buildPayload = (draft: boolean) => ({
    id: `opp${Math.floor(Math.random() * 100000)}`,
    companyId,
    companyName,
    title,
    description,
    location,
    deadline,
    type: workType || 'INTERNSHIP',
    positions,
    workplaceType,
    workType,
    duration,
    paidStatus,
    salary,
    requirementsText: requirements,
    niceToHave,
    requiredSkills: skills,
    applicationTypes: { professionalPractice: applicationPP, individualGrowth: applicationIG },
    draft,
  });

  const validateRequired = () => {
    if (!title.trim()) return 'Job title is required.';
    if (!deadline) return 'Application deadline is required.';
    if (!location.trim()) return 'Location is required.';
    if (!workplaceType) return 'Workplace type is required.';
    if (!workType) return 'Work type is required.';
    if (!duration) return 'Duration is required.';
    if (!paidStatus) return 'Paid status is required.';
    if (!description.trim()) return 'Job description is required.';
    if (!requirements.trim()) return 'Requirements are required.';
    return null;
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateRequired();
    if (err) {
      toast.error(err);
      return;
    }
    onSave(buildPayload(false));
    toast.success('Opportunity published.');
  };

  const handleSaveDraft = () => {
    if (!title.trim()) {
      toast.error('Add at least a job title to save a draft.');
      return;
    }
    onSave(buildPayload(true));
    toast.success('Draft saved.');
  };

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 md:p-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#0E2A50] md:text-3xl">Create New Opportunity</h2>
        <p className="mt-2 text-sm text-slate-500">Post a new internship opportunity for students</p>
      </div>

      <form onSubmit={handlePublish} className="space-y-10">
        <section className="space-y-4">
          <h3 className={sectionTitleClass}>Basic Information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className={labelClass}>
                Job title <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Frontend Developer Intern"
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>
                Number of positions <span className="text-red-500">*</span>
              </span>
              <input
                type="number"
                min={1}
                value={positions}
                onChange={(e) => setPositions(e.target.value)}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>
                Application deadline <span className="text-red-500">*</span>
              </span>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className={sectionTitleClass}>Job Details</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label>
              <span className={labelClass}>
                Location <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA"
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>
                Workplace type <span className="text-red-500">*</span>
              </span>
              <select
                value={workplaceType}
                onChange={(e) => setWorkplaceType(e.target.value)}
                className={`${inputClass} appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                }}
              >
                <option value="">Select workplace type</option>
                <option value="On-site">On-site</option>
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>
                Work type <span className="text-red-500">*</span>
              </span>
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                className={`${inputClass} appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                }}
              >
                <option value="">Select work type</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="PROFESSIONAL_PRACTICE">Professional practice</option>
                <option value="PART_TIME">Part-time</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>
                Duration <span className="text-red-500">*</span>
              </span>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={`${inputClass} appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                }}
              >
                <option value="">Select duration</option>
                <option value="1-3 months">1-3 months</option>
                <option value="3-6 months">3-6 months</option>
                <option value="6-12 months">6-12 months</option>
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className={sectionTitleClass}>Compensation</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label>
              <span className={labelClass}>
                Paid status <span className="text-red-500">*</span>
              </span>
              <select
                value={paidStatus}
                onChange={(e) => setPaidStatus(e.target.value)}
                className={`${inputClass} appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                }}
              >
                <option value="">Select status</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Stipend">Stipend</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>Salary ($/month)</span>
              <input
                type="text"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. 2500"
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className={sectionTitleClass}>Description &amp; requirements</h3>
          <label className="block">
            <span className={labelClass}>
              Job description <span className="text-red-500">*</span>
            </span>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the role, responsibilities, and what the intern will learn..."
              className={`${inputClass} resize-none`}
            />
          </label>
          <label className="block">
            <span className={labelClass}>
              Requirements <span className="text-red-500">*</span>
            </span>
            <textarea
              rows={4}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="List the required qualifications, skills, and experience..."
              className={`${inputClass} resize-none`}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Nice to have</span>
            <textarea
              rows={3}
              value={niceToHave}
              onChange={(e) => setNiceToHave(e.target.value)}
              placeholder="Optional skills or qualifications that are beneficial..."
              className={`${inputClass} resize-none`}
            />
          </label>
        </section>

        <section className="space-y-4">
          <h3 className={sectionTitleClass}>Required skills</h3>
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#002B5B] px-3 py-1 text-xs font-semibold text-white"
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeSkill(s)}
                  className="rounded-full p-0.5 hover:bg-white/20"
                  aria-label={`Remove ${s}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className={labelClass}>Add skill</span>
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Add a skill (e.g. JavaScript, Python, etc...)"
                className={inputClass}
              />
            </label>
            <button
              type="button"
              onClick={addSkill}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#002B5B] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#001F42] sm:mb-0.5"
            >
              <Plus size={18} />
              Add Skill
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className={sectionTitleClass}>Application type</h3>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={applicationPP}
              onChange={(e) => setApplicationPP(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-[#002B5B]"
            />
            <span className="text-sm font-medium text-slate-800">Professional Practice</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={applicationIG}
              onChange={(e) => setApplicationIG(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-[#002B5B]"
            />
            <span className="text-sm font-medium text-slate-800">Individual Growth</span>
          </label>
        </section>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-8 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="submit"
            className="order-1 w-full rounded-full bg-[#002B5B] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#001F42] sm:order-none sm:w-auto sm:min-w-[200px]"
          >
            Publish Opportunity
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="order-2 w-full rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 sm:order-none sm:w-auto"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="order-3 w-full rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 sm:order-none sm:ml-auto sm:w-auto"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddOpportunityForm;
