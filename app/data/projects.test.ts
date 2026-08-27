import { describe, expect, it } from 'vitest';
import { defaultProjectFilters, filterProjects, projects } from './projects';

describe('filterProjects', () => {
  it('returns every opening when all filters are at their defaults', () => {
    expect(filterProjects(projects, defaultProjectFilters)).toEqual(projects);
  });

  it('matches text case-insensitively across titles, summaries, skills, and metadata', () => {
    expect(filterProjects(projects, { ...defaultProjectFilters, query: 'FRONTEND' })).toHaveLength(1);
    expect(filterProjects(projects, { ...defaultProjectFilters, query: 'privacy-first' })).toHaveLength(1);
    expect(filterProjects(projects, { ...defaultProjectFilters, query: 'Figma' })[0]?.role).toBe('Design');
  });

  it('filters by role, compensation, and commitment independently', () => {
    expect(filterProjects(projects, { ...defaultProjectFilters, role: 'Research' })).toHaveLength(1);
    expect(filterProjects(projects, { ...defaultProjectFilters, compensation: 'Fixed bounty' })).toHaveLength(2);
    expect(filterProjects(projects, { ...defaultProjectFilters, commitment: '8+ hrs/week' })).toHaveLength(1);
  });

  it('combines structured filters with every text term', () => {
    const results = filterProjects(projects, {
      ...defaultProjectFilters,
      query: 'design accessible',
      role: 'Design',
      compensation: 'Paid',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('accessible-finance');
  });

  it('returns an empty collection when filters conflict', () => {
    expect(
      filterProjects(projects, {
        ...defaultProjectFilters,
        query: 'Python',
        role: 'Design',
      }),
    ).toEqual([]);
  });
});
