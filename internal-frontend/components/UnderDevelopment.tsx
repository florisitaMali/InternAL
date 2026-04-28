'use client';

import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';

interface UnderDevelopmentProps {
  moduleName?: string;
  onBack?: () => void;
}

const UnderDevelopment: React.FC<UnderDevelopmentProps> = ({ moduleName, onBack }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center">
      <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Construction size={48} className="text-amber-500" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        {moduleName ? `${moduleName} Module` : 'Module'} Under Development
      </h2>
      <p className="text-slate-500 max-w-md mx-auto mb-8">
        We&apos;re working hard to bring you this feature. Please check back later for updates!
      </p>
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 bg-[#002B5B] text-white rounded-xl font-bold hover:bg-[#001F42] transition-all shadow-lg shadow-indigo-500/20"
        >
          <ArrowLeft size={18} />
          Go Back
        </button>
      )}
    </div>
  );
};

export default UnderDevelopment;
