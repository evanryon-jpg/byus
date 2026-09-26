'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ByUsLogo from './ByUsLogo';

// Client component so it can check login state after the page loads.
// The rest of the site is server-rendered, but "am I logged in" can only be
// known by asking the API from the browser (the session cookie isn't read here).
export default function NavBar() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'in' | 'out'
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === '/';
  const linkTone = isHome
    ? 'hover:bg-white/10 hover:text-white'
    : 'hover:bg-[#0F766E]/5 hover:text-[#0F766E]';

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
      <a
        href="/browse"
        className={`block rounded-lg px-3 py-2 ${linkTone}`}
        onClick={() => setMenuOpen(false)}
      >
        Browse creators
      </a>

      {isHome && (
        <>
          <a href="#features" className={`block rounded-lg px-3 py-2 ${linkTone}`} onClick={() => setMenuOpen(false)}>
            Features
          </a>
          <a href="#creator-walkthrough" className={`block rounded-lg px-3 py-2 ${linkTone}`} onClick={() => setMenuOpen(false)}>
            How it works
          </a>
        </>
      )}

      {status === 'in' && (
        <>
          <a
            href={dashboardHref}
            className={`block rounded-lg px-3 py-2 ${linkTone}`}
            onClick={() => setMenuOpen(false)}
          >
            Dashboard
          </a>
          <a
            href="/settings"
            className={`block rounded-lg px-3 py-2 ${linkTone}`}
            onClick={() => setMenuOpen(false)}
          >
            Settings
          </a>
          {user?.is_admin && (
            <a
              href="/admin"
              className={`block rounded-lg px-3 py-2 ${linkTone}`}
              onClick={() => setMenuOpen(false)}
            >
              Admin
            </a>
          )}
          {user?.is_support && (
            <a
              href="/support-desk"
              className={`block rounded-lg px-3 py-2 ${linkTone}`}
              onClick={() => setMenuOpen(false)}
            >
              Support desk
            </a>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full rounded-full border px-4 py-2.5 text-left lg:ml-2 lg:w-auto lg:text-center ${
              isHome ? 'border-white/45 text-white hover:bg-white/10' : 'border-[#0F766E] text-[#0F766E] hover:bg-[#0F766E]/5'
            }`}
          >
            Log out
          </button>
        </>
      )}

      {status === 'out' && (
        <>
          <a
            href="/login"
            className={`block rounded-lg px-3 py-2 ${linkTone}`}
            onClick={() => setMenuOpen(false)}
          >
            Log in
          </a>
          <a
            href={isHome ? '/signup?role=creator' : '/signup'}
            className={`block rounded-full px-5 py-2.5 text-center text-white lg:ml-2 lg:inline-block ${
              isHome ? 'bg-[#b85138] hover:bg-[#a84631]' : 'bg-[#0F766E] hover:bg-[#115E59]'
            }`}
            onClick={() => setMenuOpen(false)}
          >
            {isHome ? 'Reserve a spot' : 'Sign up'}
          </a>
        </>
      )}

      {status === 'loading' && (
        <span className={isHome ? 'text-white/30' : 'text-[#172033]/30'} aria-hidden="true">···</span>
      )}
    </>
  );

  return (
    // Sticky so the logo and the primary Log in/Sign up CTA stay reachable while
    // scrolling a long page (the homepage, browse, a creator's post feed) instead
    // of scrolling away with the content. z-50 keeps it above the mobile dropdown
    // panel and anything else on the page.
    <nav className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
      isHome ? 'border-white/10 bg-[#08182d]/95 text-white' : 'border-brand-ink/5 bg-brand-paper text-brand-ink'
    }`}>
      <div className={`mx-auto flex items-center justify-between px-6 py-4 ${isHome ? 'max-w-[1280px] lg:px-10' : 'max-w-5xl'}`}>
        <a
          href="/"
          className="flex items-center"
          onClick={() => setMenuOpen(false)}
        >
          <ByUsLogo className="h-10 w-auto" light={isHome} />
        </a>

        {/* Full inline nav from the small-tablet breakpoint up. */}
        <div className="hidden items-center gap-1 text-sm font-medium lg:flex">{links}</div>

        {/* Hamburger toggle below that — 44px tap target, matches the site's other pill controls. */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className={`flex h-11 w-11 items-center justify-center rounded-lg border lg:hidden ${
            isHome ? 'border-white/20 text-white hover:bg-white/10' : 'border-brand-ink/15 text-[#0F766E] hover:bg-[#0F766E]/5'
          }`}
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

      {/* Mobile dropdown panel. Given real visual weight (its own warm background,
          a shadow, and padded rows) instead of blending into the nav bar above it --
          previously it opened as a few plain lines of text that were easy to miss
          tapping into on a small screen. */}
      {menuOpen && (
        <div className={`space-y-1 border-t px-4 py-4 text-sm font-semibold shadow-lg lg:hidden ${
          isHome ? 'border-white/10 bg-[#08182d] text-white' : 'border-brand-ink/15 bg-[#F8FAFC] text-brand-ink'
        }`}>
          {links}
        </div>
      )}
    </nav>
  );
}
