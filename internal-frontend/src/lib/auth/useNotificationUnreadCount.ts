'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import { fetchNotifications } from '@/src/lib/auth/notifications';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';

const DEFAULT_POLL_MS = 30_000;

/**
 * Polls GET /api/notifications for {@link NotificationsListResponse.unreadCount} so the header bell can show a badge.
 */
export function useNotificationUnreadCount(pollMs: number = DEFAULT_POLL_MS) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const token = await getSessionAccessToken();
      if (!token) {
        setUnreadCount(0);
        return;
      }
      const { data, errorMessage } = await fetchNotifications(token);
      if (errorMessage || !data) {
        return;
      }
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    } catch {
      /* keep previous count */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  useEffect(() => {
    const onFocus = () => void refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notification' }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { unreadCount, refresh };
}
