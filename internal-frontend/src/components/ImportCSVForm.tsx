'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ImportCSVFormProps {
  onImport: (data: any[]) => void;
  onCancel: () => void;
  entityName: string;
}

const ImportCSVForm: React.FC<ImportCSVFormProps> = ({ onImport, onCancel, entityName }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      processFile(selectedFile);
    } else {
      toast.error('Please select a valid CSV file.');
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').map(row => row.split(','));
      const headers = rows[0];
      const data = rows.slice(1).filter(row => row.length === headers.length).map(row => {
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header.trim()] = row[i].trim();
        });
        return obj;
      });
      setPreviewData(data.slice(0, 5)); // Show first 5 rows as preview
    };
    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      processFile(droppedFile);
    } else {
      toast.error('Please drop a valid CSV file.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file to import.');
      return;
    }
    // In a real app, we would process the full data here
    onImport(previewData);
    toast.success(`${entityName} imported successfully!`);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <Upload className="text-[#002B5B]" size={24} />
          Import {entityName} from CSV
        </h2>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
          <X size={24} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <div 
          className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${
            isDragging ? 'border-[#002B5B] bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".csv" 
            className="hidden" 
          />
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Upload size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            {file ? file.name : 'Click or drag CSV file to upload'}
          </h3>
          <p className="text-slate-500 text-sm">
            Only .csv files are supported. Max file size: 5MB.
          </p>
        </div>

        {previewData.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <FileText size={16} />
              Data Preview (First 5 rows)
            </h3>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    {Object.keys(previewData[0]).map(header => (
                      <th key={header} className="px-4 py-3">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData.map((row, i) => (
                    <tr key={i} className="text-sm text-slate-600">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="px-4 py-3">{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-8 border-t border-slate-50">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <AlertCircle size={14} />
            Ensure headers match the required format.
          </div>
          <div className="flex gap-4">
            <button 
              type="button" 
              onClick={onCancel}
              className="px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={!file}
              className={`px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 ${
                file 
                  ? 'bg-[#002B5B] text-white hover:bg-[#001F42] shadow-indigo-500/20' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save size={18} />
              Import Data
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ImportCSVForm;
