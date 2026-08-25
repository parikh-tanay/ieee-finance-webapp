'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// How long the app tolerates zero activity before forcing a re-login.
// Change just this one number to adjust the timeout everywhere.
const IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000; // n * 60 * 60 * 1000 miliseconds where n is hours

// How often to check whether the idle limit has been crossed.
const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export default function IdleTimeoutGuard() {
  const router = useRouter();
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    function markActive() {
      lastActivityRef.current = Date.now();
    }

    async function checkIdle() {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
      }
    }

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, markActive, { passive: true }));

    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);

    // Browsers throttle timers in background tabs, so a long-backgrounded
    // tab might not have checked recently — re-check the instant the tab
    // becomes visible again, rather than waiting for the next tick.
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') checkIdle();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, markActive));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [router]);

  return null;
}
