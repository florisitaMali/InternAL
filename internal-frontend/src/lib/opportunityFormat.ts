export function formatTargetUniversitiesDisplay(opp: {
  targetUniversities?: { universityId: number; name: string }[];
  targetUniversityIds?: string[];
}): string {
  const names = (opp.targetUniversities ?? [])
    .map((t) => t.name?.trim())
    .filter((n): n is string => Boolean(n));
  if (names.length) return names.join(', ');
  const ids = (opp.targetUniversityIds ?? []).filter(Boolean);
  if (ids.length) return ids.map((id) => `ID ${id}`).join(', ');
  return 'All universities';
}

export function formatOpportunityType(type?: string): string {
  if (!type) return 'Opportunity';
  return type
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Spring/Jackson may serialize {@code LocalDate} as {@code [y,m,d]} in JSON. */
export function coerceApiDateToIsoString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? t : undefined;
  }
  if (Array.isArray(value) && value.length >= 3) {
    const y = Number(value[0]);
    const m = Number(value[1]);
    const d = Number(value[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return undefined;
}

export function formatDbDuration(duration?: string | null): string {
  if (!duration?.trim()) return '—';
  const m = /^(\d+)_MONTHS?$/i.exec(duration.trim());
  if (m) return `${m[1]} months`;
  return duration.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatRelativePosted(iso?: string | null): string {
  if (!iso?.trim()) return 'Recently posted';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Recently posted';
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  if (days < 7) return `Posted ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'Posted 1 week ago';
  if (weeks < 8) return `Posted ${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 1) return `Posted ${weeks} weeks ago`;
  if (months === 1) return 'Posted 1 month ago';
  return `Posted ${months} months ago`;
}

export function formatDbWorkType(workType?: string | null): string {
  if (!workType?.trim()) return '—';
  const map: Record<string, string> = {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    INTERNSHIP: 'Internship',
    PROFESSIONAL_PRACTICE: 'Professional practice',
  };
  return map[workType] ?? workType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Normalize Spring/JSON {@code postedAt} (ISO string, epoch ms, or legacy array) for {@link formatPostedDisplay}. */
export function normalizePostedAtFromApi(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t.length > 0 ? t : undefined;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    return new Date(ms).toISOString();
  }
  if (Array.isArray(raw) && raw.length >= 1 && typeof raw[0] === 'number') {
    const sec = raw[0];
    const nano = typeof raw[1] === 'number' ? raw[1] : 0;
    return new Date(sec * 1000 + nano / 1e6).toISOString();
  }
  return undefined;
}

/**
 * Human-friendly “Posted …” line for company/student opportunity cards (relative when recent).
 */
export function formatPostedDisplay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const ms = Date.now() - date.getTime();
  if (ms < 0) {
    return `Posted ${date.toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
  }
  const sec = Math.floor(ms / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (sec < 50) return `Posted ${rtf.format(-sec, 'second')}`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Posted ${rtf.format(-min, 'minute')}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Posted ${rtf.format(-hr, 'hour')}`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `Posted ${rtf.format(-day, 'day')}`;
  const week = Math.floor(day / 7);
  if (week < 8) return `Posted ${rtf.format(-week, 'week')}`;
  const month = Math.floor(day / 30);
  if (month < 18) return `Posted ${rtf.format(-month, 'month')}`;
  const year = Math.floor(day / 365);
  return `Posted ${rtf.format(-year, 'year')}`;
}

export function formatDeadline(deadline?: string): string {
  if (!deadline) return 'No deadline specified';
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Student “Explore” cards: normalise stored/API work mode labels for display.
 */
export function formatExploreWorkMode(mode?: string | null): string {
  if (!mode?.trim()) return '';
  const u = mode.trim().toUpperCase().replace(/-/g, '_').replace(/\s+/g, '_');
  const map: Record<string, string> = {
    REMOTE: 'Remote',
    HYBRID: 'Hybrid',
    IN_PERSON: 'In-person',
    ON_SITE: 'On-site',
    ONSITE: 'On-site',
  };
  if (map[u]) return map[u];
  if (mode === 'Remote' || mode === 'Hybrid' || mode === 'On-site') return mode;
  return mode;
}

export function getOpportunityCardInitials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

/** Maps API `workType` (FULL_TIME / PART_TIME) for company views. */
export function formatWorkTypeLabel(workType: string | null | undefined): string | undefined {
  if (workType == null || !workType.trim()) return undefined;
  const u = workType.trim().toUpperCase().replace(/-/g, '_');
  if (u === 'FULL_TIME') return 'Full time';
  if (u === 'PART_TIME') return 'Part time';
  return formatOpportunityType(u);
}

/** Maps stored duration codes from the create form / API. */
export function formatDurationCodeLabel(duration: string | null | undefined): string | undefined {
  if (duration == null || !duration.trim()) return undefined;
  const key = duration.trim().toUpperCase();
  const map: Record<string, string> = {
    '3_MONTHS': '3 months',
    '6_MONTHS': '6 months',
    '12_MONTHS': '12 months',
  };
  if (map[key]) return map[key];
  return duration.trim();
}

/**
 * `nice_to_have` is a single text field; the company detail UI expects a bullet list under "Responsibilities".
 */
export function responsibilitiesFromNiceToHave(niceToHave: string | null | undefined): string[] | undefined {
  if (niceToHave == null || !niceToHave.trim()) return undefined;
  const lines = niceToHave
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.length ? lines : undefined;
}
