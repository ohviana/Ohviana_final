'use client';

import { useEffect, useRef } from 'react';

/**
 * Scrolls its parent's `[aria-current]` item into view sideways (a long date strip with the chosen
 * date off-screen). Renders nothing.
 */
export function ScrollToCurrent({ watch }: { watch: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const strip = marker.current?.parentElement;
    const current = strip?.querySelector<HTMLElement>('[aria-current]');
    if (!strip || !current) return;
    strip.scrollTo({
      left: current.offsetLeft - strip.clientWidth / 2 + current.clientWidth / 2,
      behavior: 'smooth',
    });
  }, [watch]);
  return <span ref={marker} hidden />;
}
