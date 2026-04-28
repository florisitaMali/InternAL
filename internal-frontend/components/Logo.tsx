'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className, size = 'md', showText = true }) => {
  const sizes = {
    sm: { icon: 'w-6 h-6', text: 'text-lg' },
    md: { icon: 'w-10 h-10', text: 'text-2xl' },
    lg: { icon: 'w-16 h-16', text: 'text-4xl' },
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("relative", sizes[size].icon)}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Left part of A - Dark Navy */}
          <path d="M20 80L50 20L65 50" stroke="#002B5B" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          {/* Right part of A - Light Blue */}
          <path d="M80 80L50 20L35 50" stroke="#38BDF8" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          {/* Horizontal bar - Teal */}
          <path d="M30 60H70" stroke="#20948B" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={cn("font-bold text-[#002B5B] tracking-tight", sizes[size].text)}>
            InternAL
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
            Management
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
