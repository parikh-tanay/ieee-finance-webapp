'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Two independent limits, whichever is hit first wins:
//
// 1. IDLE_TIMEOUT_MS — logs out after this much genuine inactivity (no
//    mouse/keyboard/click/scroll at all). Protects against a careless
//    person leaving a laptop open and unattended, without ever cutting off
//    someone who's actively working.
// 2. ABSOLUTE_SESSION_MS — a hard ceiling from the moment of login,
//    regardless of activity. Guarantees no session lives forever even if
//    someone stays gently active all day.
//
// Change these two numbers to adjust both limits everywhere.
const IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;        // 1 hour of no activity
const ABSOLUTE_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours from login, no matter what

const CHECK_INTERVAL_MS = 60 * 1000; // how often to check both limits
const LOGIN_TIME_KEY = 'ieee_login_time';
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export default function SessionTimeoutGuard() {
  const router = useRouter();
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    function markActive() {
      lastActivityRef.current = Date.now();
    }

    async function forceLogout() {
      localStorage.removeItem(LOGIN_TIME_KEY);
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    }

    async function checkLimits() {
      const now = Date.now();

      // Absolute cap from login time.
      const stored = localStorage.getItem(LOGIN_TIME_KEY);
      if (!stored) {
        // No recorded login time (cleared storage, or predates this
        // feature) — start the clock now rather than never expire.
        localStorage.setItem(LOGIN_TIME_KEY, String(now));
      } else if (now - Number(stored) >= ABSOLUTE_SESSION_MS) {
        await forceLogout();
        return;
      }

      // Idle cap from last real activity.
      if (now - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        await forceLogout();
      }
    }

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, markActive, { passive: true }));

    checkLimits(); // check immediately on mount — catches a tab reopened after either limit already passed
    const interval = setInterval(checkLimits, CHECK_INTERVAL_MS);

    // Browsers throttle timers in background tabs — re-check the instant
    // the tab regains focus, rather than waiting for the next tick.
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') checkLimits();
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

