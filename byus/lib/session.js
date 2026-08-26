// Helper for API routes: read the session cookie from an incoming request
// and return the logged-in user's info (or null if not logged in / invalid session).

import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE_NAME } from './auth';

export function getCurrentUser() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token); // returns { userId, email, role } or null if invalid/expired
}
