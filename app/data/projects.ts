export const projectRoles = ['Engineering', 'Design', 'Research'] as const;
export const compensationTypes = ['Paid', 'Fixed bounty', 'Revenue share', 'Portfolio'] as const;
export const commitmentBands = ['Under 6 hrs/week', '6–8 hrs/week', '8+ hrs/week'] as const;

export type ProjectRole = (typeof projectRoles)[number];
export type CompensationType = (typeof compensationTypes)[number];
export type CommitmentBand = (typeof commitmentBands)[number];

export type ProjectOpening = {
  id: string;
  title: string;
  summary: string;
  skills: string[];
  role: ProjectRole;
  compensation: CompensationType;
  commitment: string;
  commitmentBand: CommitmentBand;
  duration: string;
  timezone: string;
  freshness: string;
  stage: string;
  desiredOutcome: string;
  firstMilestone: string;
  ownerContribution: string;
  ownerName: string;
  ownerSignal: string;
  confidentiality: string;
};

export type ProjectFilters = {
  query: string;
  role: ProjectRole | 'All roles';
  compensation: CompensationType | 'All compensation';
  commitment: CommitmentBand | 'Any commitment';
};

export const defaultProjectFilters: ProjectFilters = {
  query: '',
  role: 'All roles',
  compensation: 'All compensation',
  commitment: 'Any commitment',
};

// Representative openings include the structured facts a candidate needs before applying.
export const projects: ProjectOpening[] = [
  {
    id: 'climate-data-explorer',
    title: 'Frontend engineer for a climate data explorer',
    summary: 'Turn open emissions data into a fast, understandable planning tool for local teams.',
    skills: ['TypeScript', 'React', 'Data visualization'],
    role: 'Engineering',
    compensation: 'Fixed bounty',
    commitment: '6–8 hrs/week',
    commitmentBand: '6–8 hrs/week',
    duration: '6 weeks',
    timezone: 'UTC to UTC+4',
    freshness: 'Posted 2h ago',
    stage: 'Working prototype',
    desiredOutcome: 'A responsive explorer that turns regional emissions data into decisions a local planning team can explain.',
    firstMilestone: 'Build and document the interactive region-comparison view using the existing API.',
    ownerContribution: 'Data model, API, user interviews, and a deployed internal prototype are ready.',
    ownerName: 'Maya Chen',
    ownerSignal: 'Collaboration Proven · 3 projects',
    confidentiality: 'Public project with limited repository access during the trial.',
  },
  {
    id: 'accessible-finance',
    title: 'Product designer for an accessible finance app',
    summary: 'Shape a privacy-first cash-flow experience for freelancers with variable income.',
    skills: ['Product design', 'Figma', 'Accessibility'],
    role: 'Design',
    compensation: 'Paid',
    commitment: '5 hrs/week',
    commitmentBand: 'Under 6 hrs/week',
    duration: '4 weeks',
    timezone: 'UTC+1 to UTC+5:30',
    freshness: 'Posted yesterday',
    stage: 'Validated concept',
    desiredOutcome: 'A tested mobile-first flow that helps freelancers see upcoming cash gaps without exposing bank credentials.',
    firstMilestone: 'Review six interview notes and produce a clickable weekly cash-flow prototype.',
    ownerContribution: 'Research synthesis, compliance constraints, and the first information architecture are complete.',
    ownerName: 'Noah Williams',
    ownerSignal: 'Work Demonstrated · 2 shipped products',
    confidentiality: 'Limited details until both people accept a short confidentiality agreement.',
  },
  {
    id: 'research-assistant',
    title: 'Full-stack builder for an AI research assistant',
    summary: 'Prototype a citation-first workspace that helps small research teams review evidence.',
    skills: ['Next.js', 'Python', 'LLM evaluation'],
    role: 'Engineering',
    compensation: 'Revenue share',
    commitment: '8–10 hrs/week',
    commitmentBand: '8+ hrs/week',
    duration: '8 weeks',
    timezone: 'UTC-5 to UTC+1',
    freshness: 'Posted 2 days ago',
    stage: 'Private alpha',
    desiredOutcome: 'A reliable evidence-review loop where every generated claim stays connected to a source passage.',
    firstMilestone: 'Implement the citation inspection flow against a fixed evaluation set of 40 documents.',
    ownerContribution: 'Retrieval service, evaluation rubric, and five alpha teams are already in place.',
    ownerName: 'Elena García',
    ownerSignal: 'Skill Screened · AI evaluation',
    confidentiality: 'Confidential dataset; the trial uses a sandbox and synthetic documents.',
  },
  {
    id: 'open-source-onboarding',
    title: 'UX researcher for open-source contributor onboarding',
    summary: 'Find the friction that stops capable developers from making their first useful contribution.',
    skills: ['User research', 'Journey mapping', 'Open source'],
    role: 'Research',
    compensation: 'Portfolio',
    commitment: '4–5 hrs/week',
    commitmentBand: 'Under 6 hrs/week',
    duration: '3 weeks',
    timezone: 'UTC-2 to UTC+5:30',
    freshness: 'Posted 3 days ago',
    stage: 'Active community',
    desiredOutcome: 'A prioritized onboarding plan grounded in interviews with new and recently retained contributors.',
    firstMilestone: 'Run three structured interviews and deliver a friction map with supporting evidence.',
    ownerContribution: 'Recruiting access, analytics, community moderation, and an interview guide are provided.',
    ownerName: 'Arjun Mehta',
    ownerSignal: 'Collaboration Proven · 5 projects',
    confidentiality: 'Public research; participants remain anonymous in published notes.',
  },
  {
    id: 'developer-portfolio',
    title: 'Visual designer for a calm developer portfolio system',
    summary: 'Create a reusable visual language for engineers who want their work—not decoration—to lead.',
    skills: ['Visual design', 'Design systems', 'Typography'],
    role: 'Design',
    compensation: 'Fixed bounty',
    commitment: '6 hrs/week',
    commitmentBand: '6–8 hrs/week',
    duration: '5 weeks',
    timezone: 'UTC+3 to UTC+8',
    freshness: 'Posted 4 days ago',
    stage: 'Design brief',
    desiredOutcome: 'A flexible portfolio kit with restrained typography, accessible themes, and strong project storytelling.',
    firstMilestone: 'Establish typography, spacing, and color tokens, then apply them to one case-study page.',
    ownerContribution: 'Content model, component inventory, and three complete case studies are available.',
    ownerName: 'Sofia Kim',
    ownerSignal: 'Work Demonstrated · design engineering',
    confidentiality: 'Public project; all reusable assets will have an explicit open-source license.',
  },
];

/**
 * Applies text and structured filters together. Text terms use AND matching so
 * precise searches such as “React climate” stay useful as the catalogue grows.
 */
export function filterProjects(openings: ProjectOpening[], filters: ProjectFilters) {
  const terms = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

  return openings.filter((opening) => {
    const searchableText = [
      opening.title,
      opening.summary,
      opening.skills.join(' '),
      opening.role,
      opening.compensation,
      opening.commitment,
      opening.duration,
      opening.timezone,
      opening.stage,
    ]
      .join(' ')
      .toLocaleLowerCase();

    const matchesText = terms.every((term) => searchableText.includes(term));
    const matchesRole = filters.role === 'All roles' || opening.role === filters.role;
    const matchesCompensation =
      filters.compensation === 'All compensation' || opening.compensation === filters.compensation;
    const matchesCommitment =
      filters.commitment === 'Any commitment' || opening.commitmentBand === filters.commitment;

    return matchesText && matchesRole && matchesCompensation && matchesCommitment;
  });
}

type ProjectListEnvelope = {
  data?: unknown;
  meta?: { count?: unknown };
};

type ProjectErrorEnvelope = {
  error?: { code?: unknown; message?: unknown; field?: unknown };
};

export class ProjectDiscoveryAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly field?: keyof ProjectFilters,
  ) {
    super(code);
  }
}

function isBoundedString(value: unknown, maximum = 500): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
}

function parseProjectOpening(value: unknown): ProjectOpening {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid project opening.');
  const opening = value as Record<string, unknown>;
  const requiredStrings = [
    'id',
    'title',
    'summary',
    'commitment',
    'duration',
    'timezone',
    'freshness',
    'stage',
    'desiredOutcome',
    'firstMilestone',
    'ownerContribution',
    'ownerName',
    'ownerSignal',
    'confidentiality',
  ];
  const skills = opening.skills;
  if (
    requiredStrings.some((field) => !isBoundedString(opening[field]))
    || !projectRoles.includes(opening.role as ProjectRole)
    || !compensationTypes.includes(opening.compensation as CompensationType)
    || !commitmentBands.includes(opening.commitmentBand as CommitmentBand)
    || !Array.isArray(skills)
    || skills.length < 1
    || skills.length > 12
    || skills.some((skill) => !isBoundedString(skill, 40))
    || new Set(skills.map((skill) => (skill as string).trim().toLocaleLowerCase())).size !== skills.length
  ) {
    throw new Error('The API returned an invalid project opening.');
  }

  return {
    id: (opening.id as string).trim(),
    title: (opening.title as string).trim(),
    summary: (opening.summary as string).trim(),
    skills: skills.map((skill) => (skill as string).trim()),
    role: opening.role as ProjectRole,
    compensation: opening.compensation as CompensationType,
    commitment: (opening.commitment as string).trim(),
    commitmentBand: opening.commitmentBand as CommitmentBand,
    duration: (opening.duration as string).trim(),
    timezone: (opening.timezone as string).trim(),
    freshness: (opening.freshness as string).trim(),
    stage: (opening.stage as string).trim(),
    desiredOutcome: (opening.desiredOutcome as string).trim(),
    firstMilestone: (opening.firstMilestone as string).trim(),
    ownerContribution: (opening.ownerContribution as string).trim(),
    ownerName: (opening.ownerName as string).trim(),
    ownerSignal: (opening.ownerSignal as string).trim(),
    confidentiality: (opening.confidentiality as string).trim(),
  };
}

async function parseProjectError(response: Response) {
  let body: ProjectErrorEnvelope = {};
  try {
    body = await response.json() as ProjectErrorEnvelope;
  } catch {
    // Preserve the HTTP status when a proxy returns an unstructured error.
  }
  return new ProjectDiscoveryAPIError(
    response.status,
    typeof body.error?.code === 'string' ? body.error.code : 'project_discovery_failed',
    typeof body.error?.field === 'string' ? body.error.field as keyof ProjectFilters : undefined,
  );
}

/** Loads the published catalogue using the same filters shown by discovery. */
export async function listProjectOpenings(filters: ProjectFilters, signal?: AbortSignal) {
  const parameters = new URLSearchParams();
  const query = filters.query.trim();
  if (query) parameters.set('query', query);
  if (filters.role !== 'All roles') parameters.set('role', filters.role);
  if (filters.compensation !== 'All compensation') parameters.set('compensation', filters.compensation);
  if (filters.commitment !== 'Any commitment') parameters.set('commitment', filters.commitment);
  const queryString = parameters.toString();
  const response = await fetch(`${getAPIBaseURL()}/v1/openings${queryString ? `?${queryString}` : ''}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw await parseProjectError(response);

  const body = await response.json() as ProjectListEnvelope;
  if (!Array.isArray(body.data) || typeof body.meta?.count !== 'number' || body.meta.count !== body.data.length) {
    throw new Error('The API returned invalid project openings.');
  }
  return body.data.map(parseProjectOpening);
}
import { getAPIBaseURL } from './auth';
