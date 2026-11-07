import { useEffect, useState } from 'react';

/*
 * Pont React sur les breakpoints du kit (BREAKPOINT du theme : 640/768/1024/1280).
 * useBreakpoint('md') === true des que le viewport atteint >= 768px.
 * Sans window (SSR/preview) : false jusqu a la premiere mesure client.
 */
const QUERIES = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
} as const;

export type Breakpoint = keyof typeof QUERIES;

export function useBreakpoint(point: Breakpoint): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERIES[point]).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERIES[point]);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [point]);

  return matches;
}
