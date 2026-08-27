import { describe, expect, it } from 'vitest';
import { filterProjects, projects } from './projects';

describe('filterProjects', () => {
  it('returns every opening for an empty or whitespace-only query', () => {
    expect(filterProjects(projects, '')).toEqual(projects);
    expect(filterProjects(projects, '   ')).toEqual(projects);
  });

  it('matches case-insensitively across titles and summaries', () => {
    expect(filterProjects(projects, 'FRONTEND')).toHaveLength(1);
    expect(filterProjects(projects, 'privacy-first')).toHaveLength(1);
  });

  it('matches skills and project metadata', () => {
    expect(filterProjects(projects, 'Figma')[0]?.title).toContain('Product designer');
    expect(filterProjects(projects, 'Revenue share')[0]?.title).toContain('AI research');
    expect(filterProjects(projects, 'UTC+5:30')).toHaveLength(1);
  });

  it('requires every word in a multi-word query to match the same opening', () => {
    const results = filterProjects(projects, 'typescript climate');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toContain('climate data');
  });

  it('returns an empty collection when nothing matches', () => {
    expect(filterProjects(projects, 'underwater archaeology')).toEqual([]);
  });
});
