import { useState, useEffect } from "react";

export const BREAKPOINTS = {
  tablet:  768,
  desktop: 1024,
} as const;

function useMediaQuery(minWidth: number): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= minWidth
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [minWidth]);
  return matches;
}

export function useIsTablet():  boolean { return useMediaQuery(BREAKPOINTS.tablet);  }
export function useIsDesktop(): boolean { return useMediaQuery(BREAKPOINTS.desktop); }
