'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Client component so it can check login state after the page loads.
// The rest of the site is server-rendered, but "am I logged in" can only be
// known by asking the API from the browser (the session cookie isn't read here).
export default function NavBar() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'in' | 'out'
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Re-check on every client-side navigation, not just the first mount. Login and
  // signup redirect into the app with router.push() rather than a full page load, so
  // without this the nav kept showing "Log in / Sign up" right after someone signed
  // in until they manually refreshed -- it never knew the session had changed.
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
  }, [pathname]);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      // Ignore — send them to the homepage either way.
    }
    window.location.href = '/';
  }

  const dashboardHref = user?.role === 'creator' ? '/creator/dashboard' : '/fan/dashboard';

  // Shared between the desktop inline nav and the mobile dropdown so the two
  // never drift out of sync.
  const links = (
    <>
      <a href="/browse" className="block hover:text-[#146359]" onClick={() => setMenuOpen(false)}>
        Browse creators
      </a>

      {status === 'in' && (
        <>
          <a href={dashboardHref} className="block hover:text-[#146359]" onClick={() => setMenuOpen(false)}>
            Dashboard
          </a>
          <a href="/settings" className="block hover:text-[#146359]" onClick={() => setMenuOpen(false)}>
            Settings
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-full border border-[#146359] px-4 py-2.5 text-left text-[#146359] hover:bg-[#146359]/5 sm:w-auto sm:text-center"
          >
            Log out
          </button>
        </>
      )}

      {status === 'out' && (
        <>
          <a href="/login" className="block hover:text-[#146359]" onClick={() => setMenuOpen(false)}>
            Log in
          </a>
          <a
            href="/signup"
            className="block rounded-full bg-[#146359] px-4 py-2.5 text-center text-white hover:bg-[#0f4d45] sm:inline-block"
            onClick={() => setMenuOpen(false)}
          >
            Sign up
          </a>
        </>
      )}

      {status === 'loading' && (
        <span className="text-[#1A1A1A]/30" aria-hidden="true">···</span>
      )}
    </>
  );

  return (
    <nav className="border-b border-black/5 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <a href="/" className="text-xl font-bold text-[#146359]" onClick={() => setMenuOpen(false)}>
          ByUs
        </a>

        {/* Full inline nav from the small-tablet breakpoint up. */}
        <div className="hidden items-center gap-6 text-sm font-medium sm:flex">{links}</div>

        {/* Hamburger toggle below that — 44px tap target, matches the site's other pill controls. */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#146359] hover:bg-[#146359]/5 sm:hidden"
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown panel. */}
      {menuOpen && (
        <div className="space-y-1 border-t border-black/5 px-6 py-4 text-sm font-medium sm:hidden">
          {links}
        </div>
      )}
    </nav>
  );
}
