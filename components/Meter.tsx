'use client';

import { useEffect, useRef, useState } from 'react';

export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    const duration = 600;
    const start = performance.now();

    let raf: number;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
      else prevValue.current = to;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className="tabular-nums">{format(display)}</span>;
}

export function StatusDot({ color, live }: { color: string; live?: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${live ? 'status-dot-live' : ''}`}
      style={{ background: color, color }}
    />
  );
}
