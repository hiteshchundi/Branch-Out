export type ProjectOpening = {
  id: string;
  title: string;
  summary: string;
  skills: string[];
  compensation: string;
  commitment: string;
  duration: string;
  timezone: string;
  freshness: string;
};

// Representative openings make the discovery experience realistic before API data exists.
export const projects: ProjectOpening[] = [
  {
    id: 'climate-data-explorer',
    title: 'Frontend engineer for a climate data explorer',
    summary: 'Turn open emissions data into a fast, understandable planning tool for local teams.',
    skills: ['TypeScript', 'React', 'Data visualization'],
    compensation: 'Fixed bounty',
    commitment: '6–8 hrs/week',
    duration: '6 weeks',
    timezone: 'UTC to UTC+4',
    freshness: 'Posted 2h ago',
  },
  {
    id: 'accessible-finance',
    title: 'Product designer for an accessible finance app',
    summary: 'Shape a privacy-first cash-flow experience for freelancers with variable income.',
    skills: ['Product design', 'Figma', 'Accessibility'],
    compensation: 'Paid',
    commitment: '5 hrs/week',
    duration: '4 weeks',
    timezone: 'UTC+1 to UTC+5:30',
    freshness: 'Posted yesterday',
  },
  {
    id: 'research-assistant',
    title: 'Full-stack builder for an AI research assistant',
    summary: 'Prototype a citation-first workspace that helps small research teams review evidence.',
    skills: ['Next.js', 'Python', 'LLM evaluation'],
    compensation: 'Revenue share',
    commitment: '8–10 hrs/week',
    duration: '8 weeks',
    timezone: 'UTC-5 to UTC+1',
    freshness: 'Posted 2 days ago',
  },
];

/**
 * Searches all user-visible project fields. Every query word must match at least
 * one field, which produces useful results for phrases such as “React climate”.
 */
export function filterProjects(openings: ProjectOpening[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return openings;

  return openings.filter((opening) => {
    const searchableText = [
      opening.title,
      opening.summary,
      opening.skills.join(' '),
      opening.compensation,
      opening.commitment,
      opening.duration,
      opening.timezone,
    ]
      .join(' ')
      .toLocaleLowerCase();

    return terms.every((term) => searchableText.includes(term));
  });
}
