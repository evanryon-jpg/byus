// Server Component: loads the signed-in user (plus their referral link/stats and
// suggestion-box history) on the server, before anything is sent to the browser,
// instead of shipping an empty shell that fetches everything client-side after
// hydration. That client-fetch pattern is what was tanking this route's Real
// Experience Score — the browser had to download/parse/execute the JS bundle,
// hydrate, *then* wait on a fetch round trip before any real content painted.
//
// All the interactive bits (forms, avatar upload, password change, etc.) still live
// in SettingsClient — a Server Component can't hold onClick handlers or useState —
// this file's only job is getting the initial data there without a client waterfall.

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/session';
import { loadEnrichedUser } from '@/lib/user-profile';
import { loadReferralSummary } from '@/lib/referrals';
import { query } from '@/lib/db';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

async function loadSuggestions(userId) {
  const result = await query(
    `SELECT id, message, status, admin_note, created_at
     FROM suggestions WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export default async function SettingsPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/login');
  }

  const host = headers().get('host');
  const origin = `https://${host}`;

  // The referral link/stats and suggestion history are secondary sections of this
  // page (same as they were fetched independently client-side before) — a failure
  // loading either shouldn't take down the whole settings page, so they degrade to
  // an empty/error state instead of throwing. The user load itself is the critical
  // path and is allowed to bubble to app/error.js on failure, same as any other
  // page that can't identify who's signed in.
  const [user, referral, suggestions] = await Promise.all([
    loadEnrichedUser(session),
    loadReferralSummary(session.userId, origin).catch((err) => {
      console.error('settings: referral summary failed:', err);
      return null;
    }),
    loadSuggestions(session.userId).catch((err) => {
      console.error('settings: suggestions load failed:', err);
      return [];
    }),
  ]);

  if (!user) {
    redirect('/login');
  }

  return <SettingsClient initialUser={user} initialReferral={referral} initialSuggestions={suggestions} />;
}
