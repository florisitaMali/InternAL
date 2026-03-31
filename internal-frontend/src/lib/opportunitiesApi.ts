import type { Opportunity } from '@/src/types';

function apiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  return raw.replace(/\/$/, '');
}

function normalizeOpportunity(raw: Record<string, unknown>): Opportunity {
  return {
    id: String(raw.id ?? ''),
    companyId: String(raw.companyId ?? ''),
    companyName: String(raw.companyName ?? ''),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    requiredSkills: Array.isArray(raw.requiredSkills)
      ? (raw.requiredSkills as unknown[]).map((s) => String(s))
      : [],
    requiredExperience: String(raw.requiredExperience ?? ''),
    deadline: String(raw.deadline ?? ''),
    targetUniversityIds: Array.isArray(raw.targetUniversityIds)
      ? (raw.targetUniversityIds as unknown[]).map((s) => String(s))
      : [],
    type: raw.type != null ? String(raw.type) : undefined,
    companyLocation: raw.companyLocation != null ? String(raw.companyLocation) : undefined,
    companyIndustry: raw.companyIndustry != null ? String(raw.companyIndustry) : undefined,
  };
}

export async function fetchOpportunities(): Promise<Opportunity[]> {
  const url = `${apiBase()}/api/opportunities`;
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new Error(
      `Cannot reach the API at ${url}. Start the Spring Boot server (internal-backend, port 8080) and ensure internal-backend/.env has valid Supabase JDBC settings.`
    );
  }
  if (!res.ok) {
    throw new Error(`Failed to load opportunities (${res.status})`);
  }

  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Invalid response from opportunities API');
  }

  return data.map((row) => normalizeOpportunity(row as Record<string, unknown>));
}

type ApplicationType = 'PROFESSIONAL_PRACTICE' | 'INDIVIDUAL_GROWTH';

export interface ApplyPayload {
  studentId: number;
  companyId: number;
  opportunityId: number;
  applicationType: ApplicationType;
  accuracyConfirmed: boolean;
}

export async function applyOpportunity(payload: ApplyPayload): Promise<void> {
  const url = `${apiBase()}/api/opportunities/apply`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(`Cannot reach the API at ${url}.`);
  }

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Failed to submit application (${res.status})`);
  }
}

