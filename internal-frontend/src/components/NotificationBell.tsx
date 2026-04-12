'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useNotificationsFeed } from '@/src/lib/auth/useNotificationsFeed';
import NotificationItemRow from '@/src/components/NotificationItemRow';

const NotificationBell: React.FC = () => {
  const { items, loading, load, markItemRead, markAllRead, markingAllRead } = useNotificationsFeed();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        suppressHydrationWarning
        onClick={() => {
          setOpen((v) => !v);
          void load();
        }}
        className={cn(
          'p-2 rounded-xl transition-all relative',
          'text-slate-500 hover:text-[#002B5B] hover:bg-sky-50',
          open && 'text-[#002B5B] bg-sky-50 ring-1 ring-[#002B5B]/15'
        )}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 flex items-center justify-center text-[10px] font-bold text-white rounded-full bg-rose-500 border-2 border-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-[min(100vw-2rem,24rem)] max-h-[min(72vh,26rem)] flex flex-col rounded-xl border border-[#002B5B]/12 bg-white shadow-xl shadow-[#002B5B]/10 z-50 overflow-hidden ring-1 ring-black/[0.03]"
        >
          <div className="px-4 py-3.5 shrink-0 flex items-center justify-between gap-2 bg-[#002B5B] text-white border-b border-white/15">
            <span className="text-base font-bold tracking-tight">Notifications</span>
            {loading ? (
              <span className="text-xs text-teal-100/90 font-medium">Updating…</span>
            ) : null}
          </div>

          <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500 bg-slate-50">
                <p className="text-slate-600 font-medium">No notifications yet.</p>
                <p className="text-xs text-teal-700/70 mt-1">You&apos;re all caught up.</p>
              </div>
            ) : (
              <ul className="list-none m-0 p-0">
                {items.map((n) => (
                  <NotificationItemRow
                    key={n.notificationId}
                    n={n}
                    compact
                    onClick={() => void markItemRead(n)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 px-3 py-3 border-t border-slate-200/80 bg-slate-50 flex justify-end">
            <button
              type="button"
              disabled={unreadCount === 0 || markingAllRead}
              onClick={() => void markAllRead()}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors',
                'bg-[#002B5B] hover:bg-[#001f42] shadow-sm shadow-slate-900/10',
                'disabled:opacity-45 disabled:pointer-events-none disabled:shadow-none'
              )}
            >
              {markingAllRead ? 'Marking…' : 'Mark All As Read'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;
