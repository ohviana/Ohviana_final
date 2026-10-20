'use client';

import { useLayoutEffect, useState } from 'react';
import { Icon } from './Icon';

export const THEME_KEY = 'ohviana:theme';
type Theme = 'light' | 'dark';

/**
 * Runs in <head> before first paint (see layout): applies a saved choice so there is no flash.
 * With no saved choice the CSS follows the device setting.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

function currentTheme(): Theme {
  const set = document.documentElement.getAttribute('data-theme');
  if (set === 'light' || set === 'dark') return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Header button: switches between light and dark and remembers the choice on this device. */
export function ThemeToggle() {
  // Unknown on the server; the icon appears once the theme is read in the browser.
  const [theme, setTheme] = useState<Theme | null>(null);

  useLayoutEffect(() => {
    // Re-applies the saved choice after React's development remount clears it; no-op otherwise.
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-theme', saved);
      }
    } catch {
      // Storage unavailable: follow the device.
    }
    setTheme(currentTheme());
  }, []);

  function toggle() {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
    setTheme(next);
  }

  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {theme && <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />}
    </button>
  );
}
