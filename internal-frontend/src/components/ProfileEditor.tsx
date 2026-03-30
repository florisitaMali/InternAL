'use client';

import React, { useState, useRef } from 'react';
import { User, Award, Globe, Briefcase, Heart, Save, X, Upload, FileText } from 'lucide-react';
import { Student } from '@/src/types';
import { toast } from 'sonner';

interface ProfileEditorProps {
  student: Student;
  onSave: (updatedStudent: Student) => void;
  onCancel: () => void;
}

const PREDEFINED_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js',
  'Python', 'Java', 'Spring Boot', 'SQL', 'MySQL', 'PostgreSQL',
  'Git', 'Docker', 'AWS', 'Figma', 'HTML', 'CSS', 'C++', 'C#',
  'MongoDB', 'Redis', 'GraphQL', 'REST API', 'Angular', 'Vue.js',
];

interface ProfileEditorProps {
  student: Student;
  onSave: (updatedStudent: Student) => void;
  onCancel: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ student, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Student>({
    ...student,
    extendedProfile: {
      description: student.extendedProfile?.description ?? '',
      skills: student.extendedProfile?.skills ?? [],
      certificates: student.extendedProfile?.certificates ?? [],
      languages: student.extendedProfile?.languages ?? [],
      experience: student.extendedProfile?.experience ?? [],
      hobbies: student.extendedProfile?.hobbies ?? [],
      cvUrl: student.extendedProfile?.cvUrl,
    }
  });

  const [newLanguage, setNewLanguage] = useState('');
  const [newExperience, setNewExperience] = useState('');
  const [newHobby, setNewHobby] = useState('');
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [cvFileName, setCvFileName] = useState<string | null>(student.extendedProfile?.cvUrl ?? null);

  const cvRef = useRef<HTMLInputElement>(null);
  const certRef = useRef<HTMLInputElement>(null);

  const setExt = (field: keyof NonNullable<Student['extendedProfile']>, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      extendedProfile: { ...prev.extendedProfile!, [field]: value }
    }));
  };

  // Skills
  const addSkill = (skill: string) => {
    if (!formData.extendedProfile?.skills.includes(skill)) {
      setExt('skills', [...formData.extendedProfile!.skills, skill]);
    }
    setShowSkillModal(false);
  };
  const removeSkill = (skill: string) => setExt('skills', formData.extendedProfile!.skills.filter(s => s !== skill));
  const availableSkills = PREDEFINED_SKILLS.filter(s => !formData.extendedProfile?.skills.includes(s));

  // Languages
  const addLanguage = () => {
    const val = newLanguage.trim();
    if (val && !formData.extendedProfile?.languages.includes(val)) {
      setExt('languages', [...formData.extendedProfile!.languages, val]);
      setNewLanguage('');
    }
  };
  const removeLanguage = (lang: string) => setExt('languages', formData.extendedProfile!.languages.filter(l => l !== lang));

  // Experience
  const addExperience = () => {
    const val = newExperience.trim();
    if (val) {
      setExt('experience', [...formData.extendedProfile!.experience, val]);
      setNewExperience('');
    }
  };
  const removeExperience = (exp: string) => setExt('experience', formData.extendedProfile!.experience.filter(e => e !== exp));

  // Hobbies
  const addHobby = () => {
    const val = newHobby.trim();
    if (val) {
      setExt('hobbies', [...formData.extendedProfile!.hobbies, val]);
      setNewHobby('');
    }
  };
  const removeHobby = (hobby: string) => setExt('hobbies', formData.extendedProfile!.hobbies.filter(h => h !== hobby));

  // CV
  const handleCVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) { toast.error('Only PDF, DOC, DOCX allowed.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max file size is 5MB.'); return; }
    setCvFileName(file.name);
    setExt('cvUrl', file.name);
    toast.success('CV uploaded successfully!');
  };

  // Certificates
  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExt('certificates', [...formData.extendedProfile!.certificates, file.name]);
    toast.success(`Certificate "${file.name}" uploaded.`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    toast.success('Profile updated successfully!');
  };

  const inputCls = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all text-sm';
  const readCls = 'w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed';

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <User className="text-[#002B5B]" size={24} />
          Edit Profile
        </h2>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">

        {/* Personal Information - READ ONLY */}
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <User size={16} /> Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Full Name</span>
              <div className={readCls}>{formData.fullName}</div>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Email</span>
              <div className={readCls}>{formData.email}</div>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Department</span>
              <div className={readCls}>{formData.departmentId}</div>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Study Field</span>
              <div className={readCls}>{formData.studyFieldId}</div>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Study Year</span>
              <div className={readCls}>{formData.studyYear}</div>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">CGPA</span>
              <div className={readCls}>{formData.cgpa}</div>
            </div>
          </div>
        </div>

        {/* About Me */}
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">About Me</h3>
          <textarea
            value={formData.extendedProfile?.description}
            onChange={(e) => setExt('description', e.target.value)}
            rows={4}
            placeholder="Write a short description about yourself..."
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Skills */}
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Award size={16} /> Skills
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {formData.extendedProfile?.skills.map(skill => (
              <span key={skill} className="px-3 py-1 bg-[#002B5B]/10 text-[#002B5B] rounded-lg text-xs font-bold flex items-center gap-2">
                {skill}
                <button type="button" onClick={() => removeSkill(skill)} className="hover:text-red-500 transition-all">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowSkillModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-[#002B5B] rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
          >
            + Add Skill
          </button>
        </div>

        {/* Languages */}
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Globe size={16} /> Languages
          </h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLanguage(); } }}
              placeholder="e.g. English - Fluent"
              className={`flex-1 ${inputCls}`}
            />
            <button type="button" onClick={addLanguage}
              className="px-4 py-2 bg-[#002B5B] text-white rounded-xl font-bold hover:bg-[#001F42] transition-all text-sm">
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.extendedProfile?.languages.map(lang => (
              <span key={lang} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-2">
                {lang}
                <button type="button" onClick={() => removeLanguage(lang)} className="hover:text-red-500 transition-all">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Experience */}
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Briefcase size={16} /> Experience
          </h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newExperience}
              onChange={(e) => setNewExperience(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExperience(); } }}
              placeholder="e.g. Frontend Intern at XYZ"
              className={`flex-1 ${inputCls}`}
            />
            <button type="button" onClick={addExperience}
              className="px-4 py-2 bg-[#002B5B] text-white rounded-xl font-bold hover:bg-[#001F42] transition-all text-sm">
              Add
            </button>
          </div>
          <div className="space-y-2">
            {formData.extendedProfile?.experience.map((exp, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-700">{exp}</span>
                <button type="button" onClick={() => removeExperience(exp)} className="text-slate-400 hover:text-red-500 transition-all">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Hobbies */}
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Heart size={16} /> Hobbies
          </h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newHobby}
              onChange={(e) => setNewHobby(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHobby(); } }}
              placeholder="e.g. Photography"
              className={`flex-1 ${inputCls}`}
            />
            <button type="button" onClick={addHobby}
              className="px-4 py-2 bg-[#002B5B] text-white rounded-xl font-bold hover:bg-[#001F42] transition-all text-sm">
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.extendedProfile?.hobbies.map((hobby, i) => (
              <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-2">
                {hobby}
                <button type="button" onClick={() => removeHobby(hobby)} className="hover:text-red-500 transition-all">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* CV Upload */}
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <FileText size={16} /> Curriculum Vitae
          </h3>
          {cvFileName ? (
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-[#002B5B]" />
                <span className="text-sm font-medium text-slate-700">{cvFileName}</span>
              </div>
              <button type="button" onClick={() => cvRef.current?.click()}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
                Replace
              </button>
            </div>
          ) : (
            <div onClick={() => cvRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#002B5B] transition-all">
              <Upload size={24} className="text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 mb-1">Upload your CV</p>
              <p className="text-xs text-slate-400 mb-4">PDF, DOC, DOCX (Max 5MB)</p>
              <button type="button"
                className="px-6 py-2 bg-[#002B5B] text-white rounded-xl text-sm font-bold hover:bg-[#001F42] transition-all">
                Choose File
              </button>
            </div>
          )}
          <input ref={cvRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleCVUpload} />
        </div>

        {/* Certificates */}
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Award size={16} /> Certificates
          </h3>
          <div className="space-y-2 mb-3">
            {formData.extendedProfile?.certificates.length === 0 && (
              <p className="text-sm text-slate-400">No certificates uploaded yet.</p>
            )}
            {formData.extendedProfile?.certificates.map((cert, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-700">{cert}</span>
                </div>
                <button type="button"
                  onClick={() => setExt('certificates', formData.extendedProfile!.certificates.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-red-500 transition-all">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => certRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
            <Upload size={16} />
            Upload Certificate
          </button>
          <input ref={certRef} type="file" accept=".pdf,.doc,.docx,.jpg,.png" className="hidden" onChange={handleCertUpload} />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-8 border-t border-slate-100">
          <button type="button" onClick={onCancel}
            className="px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button type="submit"
            className="px-8 py-3 bg-[#002B5B] text-white rounded-xl font-bold hover:bg-[#001F42] transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2">
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </form>

      {/* Skills Modal */}
      {showSkillModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[420px] shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900 text-lg">Add Skill</h3>
              <button onClick={() => setShowSkillModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
              {availableSkills.length === 0 && (
                <p className="text-sm text-slate-400">All skills have been added.</p>
              )}
              {availableSkills.map(skill => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => addSkill(skill)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-[#002B5B] hover:text-white hover:border-[#002B5B] transition-all"
                >
                  + {skill}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowSkillModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileEditor;
