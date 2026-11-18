import { useEffect, useLayoutEffect, useState } from 'react';
import type { Theme } from '../shared/types';

const storageKey = 'moat-theme';
const darkPreference = '(prefers-color-scheme: dark)';

function getSavedTheme(): Theme | null {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    return null;
  }
}

function getSystemTheme(): Theme {
  return window.matchMedia?.(darkPreference).matches ? 'dark' : 'light';
}

export function useTheme() {
  const [preference, setPreference] = useState(getSavedTheme);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const theme = preference ?? systemTheme;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const query = window.matchMedia?.(darkPreference);
    if (!query) return;

    function onChange(event: MediaQueryListEvent) {
      setSystemTheme(event.matches ? 'dark' : 'light');
    }

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setPreference(nextTheme);
    try {
      window.localStorage.setItem(storageKey, nextTheme);
    } catch {
      // A preferência continua ativa na sessão quando o armazenamento está indisponível.
    }
  }

  return { theme, toggleTheme };
}
