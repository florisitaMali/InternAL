import type { AppNotification } from '@/src/types';

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080';
}

export async function fetchNotifications(
  accessToken: string
): Promise<{ data: AppNotification[] | null; errorMessage: string | null }> {
  try {
    const url = `${getApiBaseUrl()}/api/notifications`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const raw = await response.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return { data: null, errorMessage: 'Invalid JSON from notifications API' };
    }

    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : `Request failed with status ${response.status}`;
      return { data: null, errorMessage: message };
    }

    if (!Array.isArray(parsed)) {
      return { data: [], errorMessage: null };
    }

    return { data: parsed as AppNotification[], errorMessage: null };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Request failed',
    };
  }
}

export async function markNotificationRead(
  accessToken: string,
  notificationId: number
): Promise<{ ok: boolean; errorMessage: string | null }> {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/notifications/${notificationId}/read`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (response.status === 204) {
      return { ok: true, errorMessage: null };
    }

    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as { error?: string }) : null;
    const message =
      parsed?.error || `Request failed with status ${response.status}`;
    return { ok: false, errorMessage: message };
  } catch (e) {
    return {
      ok: false,
      errorMessage: e instanceof Error ? e.message : 'Request failed',
    };
  }
}
