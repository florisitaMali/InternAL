'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  Building2,
  Check,
  CheckCheck,
  GraduationCap,
  Loader2,
  MessageSquare,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import {
  fetchNotifications,
  markAllNotificationsRead,
  patchNotificationRead,
  type NotificationItem,
} from '@/src/lib/auth/notifications';
import { toast } from 'sonner';

const POLL_MS = 30_000;

function formatShortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(d);
}

function overlayIcon(senderRole: string) {
  const wrap = 'absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm';
  switch (senderRole) {
    case 'STUDENT':
      return (
        <span className={cn(wrap, 'bg-emerald-500 text-white')}>
          <User size={10} strokeWidth={2.5} />
        </span>
      );
    case 'COMPANY':
      return (
        <span className={cn(wrap, 'bg-amber-500 text-white')}>
          <Building2 size={10} strokeWidth={2.5} />
        </span>
      );
    case 'PPA':
      return (
        <span className={cn(wrap, 'bg-violet-500 text-white')}>
          <GraduationCap size={10} strokeWidth={2.5} />
        </span>
      );
    default:
      return (
        <span className={cn(wrap, 'bg-[#002B5B] text-white')}>
          <MessageSquare size={10} strokeWidth={2.5} />
        </span>
      );
  }
}

type TabKey = 'unread' | 'read';

interface NotificationsPanelProps {
  onClose?: () => void;
  /** Merged onto the root card; use for dropdown layout (e.g. drop max-width centering). */
  className?: string;
  /** Called after mark read / mark all so the header bell badge can refresh without waiting for poll. */
  onUnreadMayHaveChanged?: () => void;
  /** When set, row click (if notification has applicationId) marks read then opens the linked application. */
  onActivateApplication?: (applicationId: number) => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  onClose,
  className,
  onUnreadMayHaveChanged,
  onActivateApplication,
}) => {
  const [tab, setTab] = useState<TabKey>('unread');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (muted) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setInitialLoading(false);
        return;
      }

      const { data, errorMessage } = await fetchNotifications(token);
      if (errorMessage) {
        setInitialLoading(false);
        toast.error(errorMessage);
        return;
      }
      if (data) {
        setItems(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load notifications');
    } finally {
      setInitialLoading(false);
    }
  }, [muted]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (muted) return;
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load, muted]);

  const filtered = items.filter((n) => (tab === 'unread' ? !n.isRead : n.isRead));

  const handleMarkOne = async (n: NotificationItem) => {
    if (n.isRead) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const { ok, errorMessage } = await patchNotificationRead(token, n.notificationId, true);
      if (!ok) {
        toast.error(errorMessage || 'Could not mark as read');
        return;
      }
      setItems((prev) =>
        prev.map((x) => (x.notificationId === n.notificationId ? { ...x, isRead: true } : x))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      onUnreadMayHaveChanged?.();
    } catch {
      toast.error('Could not mark as read');
    }
  };

  const handleRowClick = (n: NotificationItem) => {
    const aid = n.applicationId;
    if (aid == null || !onActivateApplication) return;
    void (async () => {
      if (!n.isRead) {
        await handleMarkOne(n);
      }
      onActivateApplication(aid);
    })();
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const { data, errorMessage } = await markAllNotificationsRead(token);
      if (errorMessage || !data) {
        toast.error(errorMessage || 'Could not mark all as read');
        return;
      }
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
      onUnreadMayHaveChanged?.();
    } catch {
      toast.error('Could not mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div
      className={cn(
        'max-w-xl w-full mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Notifications</h2>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            title="Mark all as read"
            disabled={markingAll || unreadCount === 0}
            onClick={() => void handleMarkAll()}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {markingAll ? <Loader2 size={18} className="animate-spin" /> : <CheckCheck size={18} />}
          </button>
          <button
            type="button"
            title={muted ? 'Resume updates' : 'Pause fetching (30s updates)'}
            onClick={() => setMuted((m) => !m)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              muted ? 'text-amber-600 bg-amber-50' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            )}
          >
            {muted ? <BellOff size={18} /> : <Bell size={18} />}
          </button>
          {onClose ? (
            <button
              type="button"
              title="Close"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex border-b border-slate-100 px-5 gap-8">
        {(['unread', 'read'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'pb-3 text-sm font-semibold transition-colors relative',
              tab === key ? 'text-[#002B5B]' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            {key === 'unread' ? 'Unread' : 'Read'}
            {tab === key ? (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#002B5B] rounded-full" />
            ) : null}
          </button>
        ))}
      </div>

      {muted ? (
        <p className="text-xs text-amber-700 bg-amber-50 px-5 py-2 border-b border-amber-100">
          Auto-refresh is paused. Turn the bell back on to fetch every {POLL_MS / 1000} seconds.
        </p>
      ) : null}

      <div className="max-h-[min(70vh,520px)] flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {initialLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm font-medium">
            <Loader2 size={20} className="animate-spin" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 px-5 text-center text-sm text-slate-500 font-medium">
            {tab === 'unread' ? 'No unread notifications.' : 'No read notifications yet.'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((n) => {
              const canOpenApp =
                onActivateApplication != null && n.applicationId != null && n.applicationId !== undefined;
              return (
              <li
                key={n.notificationId}
                className={cn(
                  'px-5 py-4 transition-colors border-l-[3px]',
                  !n.isRead ? 'border-l-indigo-400 bg-indigo-50/40' : 'border-l-transparent',
                  canOpenApp ? 'cursor-pointer hover:bg-slate-50/80' : 'hover:bg-slate-50/80'
                )}
                {...(canOpenApp
                  ? {
                      role: 'button' as const,
                      tabIndex: 0,
                      onClick: () => handleRowClick(n),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(n);
                        }
                      },
                    }
                  : {})}
              >
                <div className="flex gap-3">
                  <div className="relative shrink-0">
                    <div className="h-11 w-11 rounded-full overflow-hidden bg-slate-200 ring-1 ring-slate-100">
                      {n.senderPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={n.senderPhotoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs font-bold text-slate-600 bg-gradient-to-br from-slate-100 to-slate-200">
                          {n.senderInitials}
                        </div>
                      )}
                    </div>
                    {overlayIcon(n.senderRole)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-slate-400 font-medium truncate">
                        <span className="text-slate-500">{n.senderName}</span>
                        <span className="text-slate-300"> · </span>
                        <span>Notification</span>
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-slate-400 font-medium tabular-nums">
                          {formatShortDate(n.createdAt)}
                        </span>
                        {!n.isRead ? (
                          <button
                            type="button"
                            title="Mark as read"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleMarkOne(n);
                            }}
                            className="p-1 rounded-md text-[#002B5B] hover:bg-[#002B5B]/10 transition-colors"
                          >
                            <Check size={14} strokeWidth={2.5} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-1 leading-snug">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">InternAL</p>
                  </div>
                </div>
              </li>
            );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;
