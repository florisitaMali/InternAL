'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Role } from '@/src/types';

type Props = {
  isLoggedIn: boolean;
  role: Role;
  setActiveTab: (tab: string) => void;
};

export default function UrlStudentTabSync({ isLoggedIn, role, setActiveTab }: Props) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (!isLoggedIn || !tab || role !== 'STUDENT') return;
    const allowed = new Set(['opportunities', 'best-matches', 'applications', 'profile', 'dashboard']);
    if (allowed.has(tab)) setActiveTab(tab);
  }, [searchParams, isLoggedIn, role, setActiveTab]);

  return null;
}
