'use client';

import React, { useState } from 'react';
import { Briefcase, Calendar, MapPin, FileText, Save, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface AddOpportunityFormProps {
  onSave: (opportunity: any) => void;
  onCancel: () => void;
  companyName: string;
  companyId: string;
}

const AddOpportunityForm: React.FC<AddOpportunityFormProps> = ({ onSave, onCancel, companyName, companyId }) => {
  const [formData, setFormData] = useState({
    id: `opp${Math.floor(Math.random() * 1000)}`,
    title: '',
    description: '',
    companyId: companyId,
    companyName: companyName,
    location: '',
    deadline: '',
    type: 'INTERNSHIP',
    requirements: [] as string[],
    benefits: [] as string[]
  });

  const [newRequirement, setNewRequirement] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddRequirement = () => {
    if (newRequirement && !formData.requirements.includes(newRequirement)) {
      setFormData(prev => ({
        ...prev,
        requirements: [...prev.requirements, newRequirement]
      }));
      setNewRequirement('');
    }
  };

  const handleRemoveRequirement = (req: string) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter(r => r !== req)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.deadline) {
      toast.error('Please fill in all required fields.');
      return;
    }
    onSave(formData);
    toast.success('Opportunity created successfully!');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <Plus className="text-[#002B5B]" size={24} />
          Create New Opportunity
        </h2>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
          <X size={24} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Opportunity Title *</span>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  name="title" 
                  value={formData.title} 
                  onChange={handleChange}
                  placeholder="e.g. Software Engineering Intern"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Location</span>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  name="location" 
                  value={formData.location} 
                  onChange={handleChange}
                  placeholder="e.g. Remote or City, Country"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                />
              </div>
            </label>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Application Deadline *</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="date" 
                  name="deadline" 
                  value={formData.deadline} 
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Type</span>
              <select 
                name="type" 
                value={formData.type} 
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all appearance-none"
              >
                <option value="INTERNSHIP">Internship</option>
                <option value="PROFESSIONAL_PRACTICE">Professional Practice</option>
                <option value="FULL_TIME">Full Time</option>
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Description *</span>
            <textarea 
              name="description" 
              value={formData.description} 
              onChange={handleChange}
              rows={4}
              placeholder="Describe the role and responsibilities..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all resize-none"
            />
          </label>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 block">Requirements</h3>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newRequirement} 
              onChange={(e) => setNewRequirement(e.target.value)}
              placeholder="Add a requirement..."
              className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#002B5B] outline-none transition-all"
            />
            <button 
              type="button" 
              onClick={handleAddRequirement}
              className="px-4 py-2 bg-[#20948B] text-white rounded-xl font-bold hover:bg-[#1a7a72] transition-all"
            >
              Add
            </button>
          </div>
          <div className="space-y-2">
            {formData.requirements.map(req => (
              <div key={req} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm text-slate-700">{req}</span>
                <button type="button" onClick={() => handleRemoveRequirement(req)} className="text-slate-400 hover:text-red-500 transition-all">
                  <X size={16} />
                </button>
              </div>
            ))}
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
            Create Opportunity
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddOpportunityForm;
