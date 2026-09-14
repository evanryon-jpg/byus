export const dynamic = 'force-dynamic';

// GET /api/creators/:creatorId
// Public creator profile: basic info, their tiers, their feed (subscribers-only posts
// hidden unless the requester has an active subscription), and their top supporters
// (opted-in fans only -- see the show_support_publicly query below).
//
// The actual query/gating logic lives in lib/creator-profile-data.js
// (loadCreatorProfile), shared with the creator profile page's server-side initial
// load (app/creator/[creatorId]/page.js). This route stays in place for the other
// client-side callers that still fetch it directly: app/support/page.js and
// app/creator/[creatorId]/tip/page.js.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { loadCreatorProfile } from '@/lib/creator-profile-data';

export async function GET(request, { params }) {
  const { creatorId } = params;
  const session = await getCurrentUser(); // may be null if the visitor isn't logged in — that's fine

  try {
    const profile = await loadCreatorProfile(creatorId, session);
    if (!profile) {
      return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (err) {
    console.error('creators/[creatorId] GET failed:', err);
    return NextResponse.json(
      { error: 'Could not load this creator. Try again.' },
      { status: 500 }
    );
  }
}
