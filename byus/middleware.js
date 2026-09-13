import { NextResponse } from 'next/server';

// Origin/Referer check for state-changing API requests, as defense-in-depth against CSRF.
// The session cookie already sets SameSite=lax (lib/auth.js), which stops browsers from
// attaching it to a cross-site POST/PATCH/DELETE in the first place -- but that protection
// depends entirely on browser support and correct enforcement. This is a second, independent
// layer: even if a cookie somehow rode along on a cross-site request, the mutation is
// rejected unless the request's own Origin (or Referer, as a fallback for user agents that
// omit Origin) matches the host it's arriving on.
//
// Stripe's webhook routes are exempt: those are legitimate server-to-server calls with no
// browser Origin header at all, and they're authenticated separately via the
// Stripe-Signature header instead.
//
// Apple's Sign in with Apple callback is exempt for a similar reason. Apple posts the
// authorization code back with response_mode=form_post (see the initiation route), which
// means the browser's cross-site POST genuinely comes from an appleid.apple.com origin --
// this is by design, not a forged request, and there's no way to have Apple honor a
// same-origin POST instead. The callback route already defends against forged/replayed
// callbacks on its own, independent of Origin/Referer, via a random `state` value minted
// at sign-in start and compared against an httpOnly state cookie -- so it doesn't need
// (and can't pass) this check too.
//
// (An earlier version of this file also generated a per-request CSP nonce for page
// requests, to run script-src without 'unsafe-inline'. That relied on Next.js
// auto-nonce'ing its own inline hydration scripts from the `x-nonce` request header --
// verified in production that this build doesn't do that, so every page rendered but
// nothing was ever interactive. Reverted: next.config.js now sets a static CSP with
// 'unsafe-inline' on script-src instead.)
export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/webhooks/') || pathname === '/api/auth/apple/callback') {
    return NextResponse.next();
  }

  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return NextResponse.next();
  }

  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  let sourceHost = null;
  try {
    if (origin) {
      sourceHost = new URL(origin).host;
    } else if (referer) {
      sourceHost = new URL(referer).host;
    }
  } catch {
    sourceHost = null;
  }

  if (!sourceHost || sourceHost !== host) {
    return NextResponse.json(
      { error: 'Request rejected: origin verification failed.' },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
