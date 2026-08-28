import type { ProjectOpening } from './projects';

export const SAVED_PROJECTS_STORAGE_KEY = 'branch-out-saved-projects';

/**
 * Converts unknown browser storage into a unique list of project IDs that still
 * exist in the current catalogue. Invalid, stale, and duplicated values are
 * ignored so saved-project recovery cannot break the discovery page.
 */
export function parseSavedProjectIds(
  storedValue: string | null,
  openings: ProjectOpening[],
): string[] {
  if (!storedValue) return [];

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    const availableIds = new Set(openings.map((opening) => opening.id));
    return [...new Set(
      parsedValue.filter(
        (projectId): projectId is string =>
          typeof projectId === 'string' && availableIds.has(projectId),
      ),
    )];
  } catch {
    return [];
  }
}
