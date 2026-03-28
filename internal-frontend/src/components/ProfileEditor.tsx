'use client';

import React, { useState } from 'react';
import { User, Briefcase, Award, Globe, Heart, Save, X } from 'lucide-react';
import { Student } from '@/src/types';
import { toast } from 'sonner';

interface ProfileEditorProps {
  student: Student;
  onSave: (updatedStudent: Student) => void;
  onCancel: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ student, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Student>({ ...student });
  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('extendedProfile.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        extendedProfile: {
          ...prev.extendedProfile!,
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddSkill = () => {
    if (newSkill && !formData.extendedProfile?.skills.includes(newSkill)) {
      setFormData(prev => ({
        ...prev,
        extendedProfile: {
          ...prev.extendedProfile!,
          skills: [...prev.extendedProfile!.skills, newSkill]
        }
      }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      extendedProfile: {
        ...prev.extendedProfile!,
        skills: prev.extendedProfile!.skills.filter(s => s !== skill)
      }
    }));
  };

  const handleAddLanguage = () => {
    if (newLanguage && !formData.extendedProfile?.languages.includes(newLanguage)) {
      setFormData(prev => ({
        ...prev,
        extendedProfile: {
          ...prev.extendedProfile!,
          languages: [...prev.extendedProfile!.languages, newLanguage]
        }
      }));
      setNewLanguage('');
    }
  };

  const handleRemoveLanguage = (lang: string) => {
    setFormData(prev => ({
      ...prev,
      extendedProfile: {
        ...prev.extendedProfile!,
        languages: prev.extendedProfile!.languages.filter(l => l !== lang)
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    toast.success('Profile updated successfully!');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <User className="text-[#002B5B]" size={24} />
          Edit Profile
        </h2>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
          <X size={24} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Full Name</span>
              <input 
                type="text" 
                name="fullName" 
                value={formData.fullName} 
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Email</span>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
              />
            </label>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">About Me</span>
              <textarea 
                name="extendedProfile.description" 
                value={formData.extendedProfile?.description} 
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all resize-none"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Award size={16} />
              Skills
            </h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newSkill} 
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add a skill..."
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
              />
              <button 
                type="button" 
                onClick={handleAddSkill}
                className="px-4 py-2 bg-[#20948B] text-white rounded-xl font-bold hover:bg-[#1a7a72] transition-all"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.extendedProfile?.skills.map(skill => (
                <span key={skill} className="px-3 py-1 bg-[#002B5B]/10 text-[#002B5B] rounded-lg text-xs font-bold flex items-center gap-2">
                  {skill}
                  <button type="button" onClick={() => handleRemoveSkill(skill)} className="hover:text-red-500 transition-all">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Globe size={16} />
              Languages
            </h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newLanguage} 
                onChange={(e) => setNewLanguage(e.target.value)}
                placeholder="Add a language..."
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
              />
              <button 
                type="button" 
                onClick={handleAddLanguage}
                className="px-4 py-2 bg-[#20948B] text-white rounded-xl font-bold hover:bg-[#1a7a72] transition-all"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.extendedProfile?.languages.map(lang => (
                <span key={lang} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-2">
                  {lang}
                  <button type="button" onClick={() => handleRemoveLanguage(lang)} className="hover:text-red-500 transition-all">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-8 border-t border-slate-50">
          <button 
            type="button" 
            onClick={onCancel}
            className="px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="px-8 py-3 bg-[#002B5B] text-white rounded-xl font-bold hover:bg-[#001F42] transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileEditor;
