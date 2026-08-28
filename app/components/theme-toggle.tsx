'use client';

import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';
const THEME_STORAGE_KEY = 'branch-out-theme';

export function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  } catch {
    // Privacy settings may block storage; the system preference remains usable.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event('branch-out-theme-change'));
}

function getThemeSnapshot(): Theme {
  if (typeof document === 'undefined') return 'light';
  const activeTheme = document.documentElement.dataset.theme;
  return activeTheme === 'dark' || activeTheme === 'light'
    ? activeTheme
    : getPreferredTheme();
}

function subscribeToTheme(onThemeChange: () => void) {
  window.addEventListener('branch-out-theme-change', onThemeChange);
  window.addEventListener('storage', onThemeChange);
  return () => {
    window.removeEventListener('branch-out-theme-change', onThemeChange);
    window.removeEventListener('storage', onThemeChange);
  };
}

export function ThemeToggle() {
  // The theme is stored outside React so the pre-paint boot script and toggle stay aligned.
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => 'light');

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The active theme still changes even when this browser blocks persistence.
    }
  };

  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === 'dark'}
      className="theme-toggle"
      onClick={toggleTheme}
      title={`Switch to ${nextTheme} mode`}
      type="button"
    >
      <span aria-hidden="true" className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      <span className="theme-label">{theme === 'light' ? 'Light' : 'Dark'}</span>
    </button>
  );
}
