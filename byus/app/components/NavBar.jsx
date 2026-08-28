'use client';

import { useEffect, useState } from 'react';

// Client component so it can check login state after the page loads.
// The rest of the site is server-rendered, but "am I logged in" can only be
// known by asking the API from the browser (the session cookie isn't read here).
export default function NavBar() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'in' | 'out'
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.user) {
          setUser(data.user);
          setStatus('in');
        } else {
          setStatus('out');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('out');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      // Ignore — send them to the homepage either way.
    }
    window.location.href = '/';
  }

  const dashboardHref = user?.role === 'creator' ? '/creator/dashboard' : '/fan/dashboard';

  return (
    <nav className="border-b border-black/5 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <a href="/" className="text-xl font-bold text-[#146359]">ByUs</a>
        <div className="flex items-center gap-6 text-sm font-medium">
          <a href="/browse" className="hover:text-[#146359]">Browse creators</a>

          {status === 'in' && (
            <>
              <a href={dashboardHref} className="hover:text-[#146359]">Dashboard</a>
              <a href="/settings" className="hover:text-[#146359]">Settings</a>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-[#146359] px-4 py-2 text-[#146359] hover:bg-[#146359]/5"
              >
                Log out
              </button>
            </>
          )}

          {status === 'out' && (
            <>
              <a href="/login" className="hover:text-[#146359]">Log in</a>
              <a
                href="/signup"
                className="rounded-full bg-[#146359] px-4 py-2 text-white hover:bg-[#0f4d45]"
              >
                Sign up
              </a>
            </>
          )}

          {status === 'loading' && (
            <span className="text-[#1A1A1A]/30" aria-hidden="true">···</span>
          )}
        </div>
      </div>
    </nav>
  );
}
