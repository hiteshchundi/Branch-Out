import { describe, expect, it } from 'vitest';
import { projects } from './projects';
import { parseSavedProjectIds } from './saved-projects';

describe('parseSavedProjectIds', () => {
  it('keeps unique IDs that exist in the project catalogue', () => {
    expect(parseSavedProjectIds(
      JSON.stringify([
        'climate-data-explorer',
        'climate-data-explorer',
        'accessible-finance',
      ]),
      projects,
    )).toEqual(['climate-data-explorer', 'accessible-finance']);
  });

  it('ignores stale IDs and values that are not strings', () => {
    expect(parseSavedProjectIds(
      JSON.stringify(['missing-project', 42, null, 'research-assistant']),
      projects,
    )).toEqual(['research-assistant']);
  });

  it.each([null, '', '{broken json', JSON.stringify({ id: 'accessible-finance' })])(
    'returns an empty list for unusable storage: %s',
    (storedValue) => {
      expect(parseSavedProjectIds(storedValue, projects)).toEqual([]);
    },
  );
});
