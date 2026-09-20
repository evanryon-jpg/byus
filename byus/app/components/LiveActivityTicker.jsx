'use client';

import { useEffect, useState } from 'react';

// Small "live activity" toast in the bottom-left corner of the homepage. Fetches
// app/api/activity/recent once per page load and plays each REAL event it gets back, one
// at a time, then goes quiet -- it does not loop forever and it never invents an event to
// fill a quiet moment. See that route for why: fabricated "someone just joined!" toasts are
// a well-documented dark pattern (the FTC names fake activity notifications specifically),
// and it cuts against how careful the rest of this app already is about never showing
// something as real that isn't (CreatorShowcase's demo-profile disclaimer, PlatformGoalGauge
// hiding itself rather than show a real "$0", etc). With ByUs this early, that mostly means
// this component simply won't render most of the time -- that's the honest tradeoff, not a
// bug to work around.
const DISPLAY_MS = 6000;
const GAP_MS = 2500;

function timeAgo(iso) {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function LiveActivityTicker() {
  const [events, setEvents] = useState([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/activity/recent')
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data) => {
        if (!cancelled) setEvents(Array.isArray(data.events) ? data.events : []);
      })
      .catch(() => {
        // A ticker that fails silently is correct here -- nothing about this is essential.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (dismissed || index >= events.length) return undefined;
    setVisible(true);
    const hideTimer = setTimeout(() => setVisible(false), DISPLAY_MS);
    const nextTimer = setTimeout(() => setIndex((i) => i + 1), DISPLAY_MS + GAP_MS);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(nextTimer);
    };
  }, [events, index, dismissed]);

  if (dismissed || index >= events.length) return null;
  const current = events[index];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-3 left-3 right-3 z-40 max-w-none transition-all duration-500 ease-out motion-reduce:transition-none print:hidden sm:bottom-5 sm:left-5 sm:right-auto sm:max-w-xs ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-brand-ink/10 bg-brand-paper px-4 py-3 shadow-lg shadow-brand-ink/5">
        <span className="text-xl leading-none" aria-hidden="true">
          {current.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-[#172033]">{current.message}</p>
          <p className="mt-0.5 text-xs text-brand-ink/50">{timeAgo(current.occurredAt)}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-brand-ink/40 transition hover:bg-brand-ink/5 hover:text-brand-ink/70"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
