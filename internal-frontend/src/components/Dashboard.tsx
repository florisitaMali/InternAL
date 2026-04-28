'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { Bell, Search, User } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import Logo from './Logo';

interface DashboardProps {
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
  actions?: React.ReactNode;
  userName: string;
  userRole: string;
  onToggleSidebar?: () => void;
  /**
   * When set, the header bell toggles a dropdown with this content, e.g.
   * (close) => <NotificationsPanel onClose={close} />. Backdrop, Escape, and the panel X close it.
   */
  notificationPanel?: (close: () => void) => React.ReactNode;
  /** When set, top bar shows the InternAL mark on larger screens instead of the search field. */
  topBarVariant?: 'default' | 'brand';
  /** Hide the large page title block below the top bar (e.g. student profile layout). */
  hidePageIntro?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({
  title,
  subtitle,
  children,
  actions,
  userName,
  userRole,
  notificationPanel,
  topBarVariant = 'default',
  hidePageIntro = false,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);

  const closeNotifications = useCallback(() => setNotifOpen(false), []);

  useEffect(() => {
    if (!notifOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNotifications();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notifOpen, closeNotifications]);

  const hasNotifications = Boolean(notificationPanel);
  const showTitle = Boolean(title?.trim());
  const showSubtitle = subtitle != null && subtitle !== '';
  const showPageHeader = showTitle || showSubtitle;
  return (
    <div className="flex-1 min-h-screen flex flex-col bg-[#F4F6F8]">
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-50 px-6 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Logo size="md" showText={false} className="md:hidden shrink-0" />
          {topBarVariant === 'brand' ? (
            <div className="hidden md:flex items-center min-w-0">
              <Logo size="md" className="shrink-0" />
            </div>
          ) : (
            <div className="hidden md:flex items-center mr-4 scale-75 origin-left"><Logo /></div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => {
                if (!hasNotifications) return;
                setNotifOpen((o) => !o);
              }}
              disabled={!hasNotifications}
              aria-label={hasNotifications ? 'Notifications' : 'Notifications unavailable'}
              aria-expanded={hasNotifications ? notifOpen : undefined}
              aria-haspopup={hasNotifications ? 'dialog' : undefined}
              title={hasNotifications ? 'Notifications' : undefined}
              className={cn(
                'p-2 rounded-xl transition-all relative',
                hasNotifications
                  ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer'
                  : 'text-slate-400 cursor-default opacity-60'
              )}
            >
              <Bell size={20} />
              {hasNotifications ? (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white pointer-events-none" />
              ) : null}
            </button>

            {notifOpen && hasNotifications && notificationPanel ? (
              <>
                <div
                  className="fixed inset-0 z-40 bg-slate-900/20"
                  aria-hidden
                  onClick={closeNotifications}
                />
                <div
                  className="fixed z-[55] right-3 top-16 w-[min(100vw-1.5rem,26rem)] max-h-[min(85vh,640px)] flex flex-col sm:right-8"
                  role="dialog"
                  aria-label="Notifications"
                  onClick={(e) => e.stopPropagation()}
                >
                  {notificationPanel(closeNotifications)}
                </div>
              </>
            ) : null}
          </div>
          <div className="h-8 w-px bg-slate-200 mx-2"></div>
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-slate-900">{userName}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{userRole}</div>
            </div>
          </div>

          <div
            className={cn(
              'w-10 h-10 flex items-center justify-center border',
              topBarVariant === 'brand'
                ? 'rounded-full bg-[#0f2744] text-white border-[#0f2744]'
                : 'rounded-xl bg-slate-100 text-slate-400 border-slate-200'
            )}
          >
            <User size={20} />
          </div>
          {actions && <div className="ml-4">{actions}</div>}
        </div>
      </header>

      <main className="p-10 max-w-7xl w-full mx-auto">
        {!hidePageIntro && showPageHeader && (
          <header className="mb-10">
            {showTitle && (
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
            )}
            {showSubtitle && (
              <p className="text-slate-500 mt-2 text-sm font-medium">{subtitle}</p>
            )}
          </header>
        )}
        <div className="space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
