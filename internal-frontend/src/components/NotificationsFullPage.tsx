'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { useNotificationsFeed } from '@/src/lib/auth/useNotificationsFeed';
import NotificationItemRow from '@/src/components/NotificationItemRow';

const NotificationsFullPage: React.FC = () => {
  const { items, loading, lastError, markItemRead, markAllRead, markingAllRead } =
    useNotificationsFeed();
  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="bg-white rounded-3xl border border-[#002B5B]/10 shadow-lg shadow-[#002B5B]/[0.07] overflow-hidden flex flex-col max-h-[calc(100vh-12rem)] ring-1 ring-black/[0.02]">
      <div className="px-8 py-5 shrink-0 flex items-start justify-between gap-4 bg-[#002B5B] text-white border-b border-white/15">
        <h2 className="text-xl font-bold tracking-tight">Notifications</h2>
        {loading ? (
          <span className="text-xs text-teal-100/90 shrink-0 pt-1 font-medium">Updating…</span>
        ) : null}
      </div>

      {lastError ? (
        <div className="px-8 py-6 text-sm text-red-600 shrink-0">{lastError}</div>
      ) : null}

      {!lastError && items.length === 0 ? (
        <div className="px-8 py-16 text-center text-sm max-w-lg mx-auto shrink-0 bg-slate-50">
          <p className="font-semibold text-[#002B5B] mb-2">No notifications yet.</p>
          <p className="text-teal-800/80 text-xs mb-4">You&apos;re all caught up.</p>
          <p className="text-slate-600 text-xs leading-relaxed">
            Use the first line of <code className="text-[#0d9488] bg-teal-50 px-1 rounded font-mono">message</code>{' '}
            as the title and following lines as the body. Seed:{' '}
            <code className="text-[#0369a1] bg-sky-50 px-1 rounded font-mono text-[11px]">
              seed-example-notification.sql
            </code>
          </p>
        </div>
      ) : null}

      {!lastError && items.length > 0 ? (
        <>
          <div className="overflow-y-auto flex-1 min-h-0">
            <ul className="list-none m-0 p-0">
              {items.map((n) => (
                <NotificationItemRow
                  key={n.notificationId}
                  n={n}
                  onClick={() => void markItemRead(n)}
                />
              ))}
            </ul>
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-slate-200/80 flex justify-end bg-slate-50">
            <button
              type="button"
              disabled={unreadCount === 0 || markingAllRead}
              onClick={() => void markAllRead()}
              className={cn(
                'px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors',
                'bg-[#002B5B] hover:bg-[#001f42] shadow-sm shadow-slate-900/10',
                'disabled:opacity-45 disabled:pointer-events-none disabled:shadow-none'
              )}
            >
              {markingAllRead ? 'Marking…' : 'Mark All As Read'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default NotificationsFullPage;
