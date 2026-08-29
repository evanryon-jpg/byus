import { NextResponse } from 'next/server';

// Combines two concerns in a single middleware pass:
//
// 1. CSRF defense-in-depth (state-changing API requests only). The session cookie
//    already sets SameSite=lax (lib/auth.js), which stops browsers from attaching
//    it to a cross-site POST/PATCH/DELETE in the first place -- but that protection
//    depends entirely on browser support and correct enforcement. This is a second,
//    independent layer: even if a cookie somehow rode along on a cross-site request,
//    the mutation is rejected unless the request's own Origin (or Referer, as a
//    fallback for user agents that omit Origin) matches the host it's arriving on.
//    Stripe's webhook routes are exempt: those are legitimate server-to-server
//    calls with no browser Origin header at all, authenticated separately via the
//    Stripe-Signature header instead.
//
// 2. A per-request CSP nonce for page requests. Next.js's App Router hydrates via
//    inline <script> tags it injects itself, so a CSP with `script-src 'self'` and
//    no nonce silently blocks hydration on every page -- the HTML renders but
//    nothing is ever interactive (search boxes, buttons, forms all dead, with no
//    visible error). This generates a fresh nonce per request, forwards it to
//    Next.js via the `x-nonce` request header (which Next reads automatically and
//    applies to its own inline scripts), and sets the real CSP response header
//    naming that nonce so only Next's own scripts -- not an injected one -- can run.
export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/webhooks/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    const method = request.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
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
    }
    return NextResponse.next();
  }

  // Page request: mint a per-request nonce. 'strict-dynamic' is the Next.js-recommended
  // pairing -- it lets scripts Next's own nonced bootstrap script injects (e.g. chunk
  // loading) run too, without falling back to a blanket 'unsafe-inline'.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
