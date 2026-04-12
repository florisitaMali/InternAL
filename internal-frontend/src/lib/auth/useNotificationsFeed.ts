'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { getBrowserAccessToken } from '@/src/lib/supabase/session';
import { fetchNotifications, markNotificationRead } from '@/src/lib/auth/notifications';
import type { AppNotification } from '@/src/types';

const DEFAULT_POLL_MS = 30_000;

export type NotificationsFeedValue = {
  items: AppNotification[];
  loading: boolean;
  load: () => Promise<void>;
  lastError: string | null;
  markItemRead: (n: AppNotification) => Promise<void>;
  markAllRead: () => Promise<void>;
  markingAllRead: boolean;
};

const NotificationsFeedContext = createContext<NotificationsFeedValue | null>(null);

function useNotificationsFeedState(pollMs: number = DEFAULT_POLL_MS): NotificationsFeedValue {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const load = useCallback(async () => {
    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      return;
    }
    const token = await getBrowserAccessToken(supabase);
    if (!token) return;

    setLoading(true);
    try {
      const { data, errorMessage } = await fetchNotifications(token);
      setLastError(errorMessage);
      if (errorMessage) {
        setItems([]);
        return;
      }
      setItems(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);

  const markItemRead = useCallback(async (n: AppNotification) => {
    if (n.isRead) return;
    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      return;
    }
    const token = await getBrowserAccessToken(supabase);
    if (!token) return;
    const { ok } = await markNotificationRead(token, n.notificationId);
    if (ok) {
      setItems((prev) =>
        prev.map((x) =>
          x.notificationId === n.notificationId ? { ...x, isRead: true } : x
        )
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      return;
    }
    const token = await getBrowserAccessToken(supabase);
    if (!token) return;

    const unread = items.filter((x) => !x.isRead);
    if (unread.length === 0) return;

    setMarkingAllRead(true);
    try {
      const results = await Promise.all(
        unread.map((n) => markNotificationRead(token, n.notificationId))
      );
      if (results.every((r) => r.ok)) {
        const ids = new Set(unread.map((n) => n.notificationId));
        setItems((prev) =>
          prev.map((x) => (ids.has(x.notificationId) ? { ...x, isRead: true } : x))
        );
      }
    } finally {
      setMarkingAllRead(false);
    }
  }, [items]);

  return { items, loading, load, lastError, markItemRead, markAllRead, markingAllRead };
}

export function NotificationsFeedProvider({ children }: { children: React.ReactNode }) {
  const value = useNotificationsFeedState();
  return React.createElement(
    NotificationsFeedContext.Provider,
    { value },
    children
  );
}

export function useNotificationsFeed(): NotificationsFeedValue {
  const v = useContext(NotificationsFeedContext);
  if (!v) {
    throw new Error('useNotificationsFeed must be used within NotificationsFeedProvider');
  }
  return v;
}
