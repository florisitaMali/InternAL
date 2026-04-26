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

export function getOpportunityCardInitials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
}
