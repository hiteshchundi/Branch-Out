import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultProjectFilters,
  filterProjects,
  listProjectOpenings,
  ProjectDiscoveryAPIError,
  projects,
} from './projects';

afterEach(() => vi.unstubAllGlobals());

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

describe('project discovery API client', () => {
  it('loads and validates the published catalogue', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: projects.slice(0, 2),
      meta: { count: 2 },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    await expect(listProjectOpenings(defaultProjectFilters)).resolves.toEqual(projects.slice(0, 2));
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8080/v1/openings',
      expect.objectContaining({ credentials: 'include', headers: { Accept: 'application/json' } }),
    );
  });

  it('sends only active filters to the backend', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [projects[0]],
      meta: { count: 1 },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    await listProjectOpenings({
      query: ' React climate ',
      role: 'Engineering',
      compensation: 'Fixed bounty',
      commitment: '6–8 hrs/week',
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'http://localhost:8080/v1/openings?query=React+climate&role=Engineering&compensation=Fixed+bounty&commitment=6%E2%80%938+hrs%2Fweek',
    );
  });

  it('preserves structured discovery errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'invalid_filter', message: 'invalid', field: 'role' },
    }), { status: 400 })));

    await expect(listProjectOpenings(defaultProjectFilters)).rejects.toEqual(
      new ProjectDiscoveryAPIError(400, 'invalid_filter', 'role'),
    );
  });

  it('rejects malformed catalogues and inconsistent counts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ ...projects[0], role: 'Unknown' }],
      meta: { count: 1 },
    }), { status: 200 })));
    await expect(listProjectOpenings(defaultProjectFilters)).rejects.toThrow(/invalid project opening/i);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: projects.slice(0, 1),
      meta: { count: 2 },
    }), { status: 200 })));
    await expect(listProjectOpenings(defaultProjectFilters)).rejects.toThrow(/invalid project openings/i);
  });
});
