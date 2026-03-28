'use client';

import React, { useState } from 'react';
import { User, Mail, GraduationCap, BookOpen, Save, X, Plus } from 'lucide-react';
import { mockDepartments, mockStudyFields } from '@/src/lib/mockData';
import { toast } from 'sonner';

interface AddStudentFormProps {
  onSave: (student: any) => void;
  onCancel: () => void;
}

const AddStudentForm: React.FC<AddStudentFormProps> = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    id: `s${Math.floor(Math.random() * 1000)}`,
    fullName: '',
    email: '',
    university: 'Global Tech University',
    departmentId: '',
    studyFieldId: '',
    studyYear: 1,
    cgpa: 0,
    role: 'STUDENT'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.departmentId || !formData.studyFieldId) {
      toast.error('Please fill in all required fields.');
      return;
    }
    onSave(formData);
    toast.success('Student added successfully!');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <Plus className="text-[#002B5B]" size={24} />
          Add New Student
        </h2>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
          <X size={24} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Full Name *</span>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  name="fullName" 
                  value={formData.fullName} 
                  onChange={handleChange}
                  placeholder="Enter full name"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Email Address *</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange}
                  placeholder="Enter email address"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                />
              </div>
            </label>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Department *</span>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select 
                  name="departmentId" 
                  value={formData.departmentId} 
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all appearance-none"
                >
                  <option value="">Select Department</option>
                  {mockDepartments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Study Field *</span>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select 
                  name="studyFieldId" 
                  value={formData.studyFieldId} 
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all appearance-none"
                >
                  <option value="">Select Study Field</option>
                  {mockStudyFields
                    .filter(sf => !formData.departmentId || sf.departmentId === formData.departmentId)
                    .map(sf => (
                      <option key={sf.id} value={sf.id}>{sf.name}</option>
                    ))
                  }
                </select>
              </div>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Study Year</span>
              <input 
                type="number" 
                name="studyYear" 
                value={formData.studyYear} 
                onChange={handleChange}
                min={1}
                max={6}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
              />
            </label>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">CGPA</span>
              <input 
                type="number" 
                name="cgpa" 
                value={formData.cgpa} 
                onChange={handleChange}
                step={0.01}
                min={0}
                max={4}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
              />
            </label>
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
            Save Student
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddStudentForm;
