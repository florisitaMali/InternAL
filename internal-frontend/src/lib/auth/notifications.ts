export type NotificationItem = {
  notificationId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
  senderName: string;
  senderPhotoUrl: string | null;
  senderInitials: string;
  senderRole: string;
};

export type NotificationsListResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080';
}

export async function fetchNotifications(
  accessToken: string
): Promise<{ data: NotificationsListResponse | null; errorMessage: string | null }> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/notifications`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as NotificationsListResponse | { error?: string }) : null;

    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
          ? parsed.error
          : `Request failed with status ${response.status}`;
      return { data: null, errorMessage: message };
    }

    return { data: parsed as NotificationsListResponse, errorMessage: null };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Request failed',
    };
  }
}

export async function patchNotificationRead(
  accessToken: string,
  notificationId: number,
  read: boolean
): Promise<{ ok: boolean; errorMessage: string | null }> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ read }),
    });
    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as { error?: string }) : null;

    if (!response.ok) {
      return {
        ok: false,
        errorMessage:
          parsed && typeof parsed.error === 'string'
            ? parsed.error
            : `Request failed with status ${response.status}`,
      };
    }
    return { ok: true, errorMessage: null };
  } catch (e) {
    return {
      ok: false,
      errorMessage: e instanceof Error ? e.message : 'Request failed',
    };
  }
}

export async function markAllNotificationsRead(accessToken: string): Promise<{
  data: NotificationsListResponse | null;
  errorMessage: string | null;
}> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const raw = await response.text();
    const parsed = raw
      ? (JSON.parse(raw) as NotificationsListResponse & { error?: string; updated?: boolean })
      : null;

    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
          ? parsed.error
          : `Request failed with status ${response.status}`;
      return { data: null, errorMessage: message };
    }

    if (!parsed || !Array.isArray(parsed.notifications)) {
      return { data: null, errorMessage: 'Invalid response' };
    }

    return {
      data: {
        notifications: parsed.notifications,
        unreadCount: typeof parsed.unreadCount === 'number' ? parsed.unreadCount : 0,
      },
      errorMessage: null,
    };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Request failed',
    };
  }
}
