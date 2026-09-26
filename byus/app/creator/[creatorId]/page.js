// Server Component: loads the creator's public profile — their info, tiers, feed
// (with subscriber-only gating already applied), live status, top supporters, and
// goal — on the server before anything is sent to the browser, instead of shipping an
// empty shell that fetches it client-side after hydration. This is the page every fan
// or prospective subscriber lands on from a shared link, so its first paint matters
// most of the four routes that were flagged for a poor Real Experience Score.
//
// All the interactive bits (subscribing, tipping, voting on polls, reporting, the
// posts search/filter) still live in ProfileClient — a Server Component can't hold
// onClick handlers or useState — this file's only job is getting the initial data
// there without a client waterfall, plus resolving `creatorId` (UUID or slug) and the
// canonical-slug redirect that used to happen client-side after the fact.

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { loadCreatorProfile } from '@/lib/creator-profile-data';
import ProfileClient from './ProfileClient';
import SupporterSourceCapture from '@/app/components/SupporterSourceCapture';
import { loadSwitchOffer } from '@/lib/switch-links';

export const dynamic = 'force-dynamic';

export default async function CreatorProfilePage({ params, searchParams }) {
  const { creatorId } = params;
  const session = await getCurrentUser(); // may be null — logged-out visitors can view this page

  let data = null;
  let loadError = false;
  try {
    data = await loadCreatorProfile(creatorId, session);
  } catch (err) {
    console.error('creator profile: load failed:', err);
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        <p className="text-brand-ink/70">Couldn't load this page. Check your connection and try again.</p>
        <a
          href={`/creator/${creatorId}`}
          className="mt-4 inline-block rounded-full bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#115E59]"
        >
          Try again
        </a>
      </div>
    );
  }

  if (!data) {
    return <div className="p-12 text-center text-brand-ink/60">Creator not found.</div>;
  }

  // Old/already-shared links use the raw UUID. Once a creator claims a short slug,
  // steer the address bar over to it — the UUID link keeps working (loadCreatorProfile
  // above still resolves it), this just sends everyone toward the short one going
  // forward without breaking anything already out there. Doing this here (before
  // rendering, preserving whatever query string got us here) means the URL and the
  // content it produced are never out of sync, unlike the old client-side
  // router.replace that fired after the page had already rendered under the UUID.
  if (data.creator.slug && data.creator.slug !== creatorId) {
    const qs = new URLSearchParams(searchParams).toString();
    redirect(`/creator/${data.creator.slug}${qs ? `?${qs}` : ''}`);
  }

  // ?switch=CODE: a switching link from this creator (lib/switch-links.js). Shown as a
  // banner, and passed along to checkout, only while the link is still usable.
  const switchOffer = searchParams.switch
    ? await loadSwitchOffer({ code: String(searchParams.switch), creatorId: data.creator.id }).catch(() => null)
    : null;

  return (
    <>
      <SupporterSourceCapture creatorId={data.creator.id} />
      <ProfileClient
        data={data}
        justSubscribed={searchParams.subscribed === 'true'}
        subscribedTierId={searchParams.tier || null}
        justTipped={searchParams.tipped === 'true'}
        creatorId={creatorId}
        switchOffer={switchOffer}
      />
    </>
  );
}
