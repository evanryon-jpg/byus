// Server Component: loads the signed-in creator's profile, tiers, posts, and links on
// the server, before anything is sent to the browser, instead of shipping an empty
// shell that fetches all four client-side after hydration and gates the entire page
// behind a "Loading…" screen until they resolve. That client-fetch pattern is what was
// tanking this route's Real Experience Score — the biggest offender of the four flagged
// routes (29 fetch calls, 8 separate useEffect hooks across this file).
//
// All the interactive bits (creating tiers/posts, editing links, connecting Stripe,
// etc.) still live in DashboardClient — a Server Component can't hold onClick handlers
// or useState — this file's only job is getting the initial data there without a
// client waterfall. DashboardClient's own `load()` function still exists as a refresh
// path for after a mutation (e.g. creating a new tier), which is genuinely
// user-triggered and has nothing to do with first paint.

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { loadEnrichedUser } from '@/lib/user-profile';
import { loadCreatorTiers, loadCreatorPosts, loadCreatorLinks } from '@/lib/creator-dashboard-data';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function CreatorDashboardPage() {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/login');
  }

  let user = null;
  try {
    user = await loadEnrichedUser(session);
  } catch (err) {
    console.error('creator/dashboard: user load failed:', err);
  }

  if (!user) {
    // A real failure (missing row, DB hiccup) — distinct from "not logged in" above.
    // Booting a logged-in creator to /login over this would be worse than just
    // showing a retry option, same distinction the old client-side load() made
    // between a 401 (redirect) and any other non-ok response (retry UI).
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        <p className="text-brand-ink/70">Couldn't load your dashboard. Check your connection and try again.</p>
        <a
          href="/creator/dashboard"
          className="mt-4 inline-block rounded-full bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#115E59]"
        >
          Try again
        </a>
      </div>
    );
  }

  // Tiers/posts/links are secondary to the user profile itself — a failure loading
  // any one of them shouldn't take down the whole dashboard, so each degrades to an
  // empty list instead of throwing, same as the old client-side load() silently kept
  // whatever array was already there on a non-ok response.
  const [tiers, posts, links] = await Promise.all([
    loadCreatorTiers(session.userId).catch((err) => {
      console.error('creator/dashboard: tiers load failed:', err);
      return [];
    }),
    loadCreatorPosts(session.userId).catch((err) => {
      console.error('creator/dashboard: posts load failed:', err);
      return [];
    }),
    loadCreatorLinks(session.userId).catch((err) => {
      console.error('creator/dashboard: links load failed:', err);
      return [];
    }),
  ]);

  return <DashboardClient initialUser={user} initialTiers={tiers} initialPosts={posts} initialLinks={links} />;
}
