'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/src/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className, size = 'md' }) => {
  const widths: Record<string, number> = { sm: 80, md: 120, lg: 160 };
  const w = widths[size] ?? 120;

  return (
    <div className={cn('inline-flex items-center', className)}>
      <Image
        src="/logo.png"
        alt="InternAL"
        width={w}
        height={w}
        style={{ objectFit: 'contain', width: w, height: 'auto' }}
        priority
      />
    </div>
  );
};

export default Logo;
