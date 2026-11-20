'use client';

/**
 * ThemeToggle — global light/dark switch (next-themes, persisted in localStorage).
 * Colours come from the --m-* palette in globals.css, so every page that uses it follows.
 */
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export default function ThemeToggle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = !mounted || resolvedTheme !== 'light';
  const label = dark ? '切换到浅色模式' : '切换到深色模式';

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
    >
      {dark ? (
        // Sun: click for light
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon: click for dark
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
