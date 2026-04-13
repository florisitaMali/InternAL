/** First line = bold title; rest = body (optional). Matches seeded multi-line messages. */
export function splitNotificationMessage(message: string): { title: string; body: string | null } {
  const trimmed = message.trim();
  const nl = trimmed.indexOf('\n');
  if (nl === -1) {
    return { title: trimmed, body: null };
  }
  const body = trimmed.slice(nl + 1).trim();
  return { title: trimmed.slice(0, nl).trim(), body: body || null };
}

export function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];

  for (const [unit, secondsInUnit] of divisions) {
    if (Math.abs(diffSec) >= secondsInUnit || unit === 'second') {
      return rtf.format(Math.round(diffSec / secondsInUnit), unit);
    }
  }
  return rtf.format(0, 'second');
}
