// Validates a post-login "?next=" destination so it can only ever point back into ByUs.
// Shared by the login/signup pages and the Google/Apple OAuth start + callback routes.
//
// Checking for a leading "/" and rejecting "//" isn't enough on its own: browsers and the
// WHATWG URL parser treat "\" like "/" in http(s) URLs and silently strip tabs/newlines,
// so "/\evil.com" or "/\t/evil.com" both resolve to https://evil.com — an open redirect
// straight after a real sign-in, which is exactly what a phishing link wants. Safe for
// both server and client code (no Node-only imports).
export function safeNextPath(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return '';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '';
  if (raw.includes('\\')) return '';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(raw)) return '';
  return raw;
}
