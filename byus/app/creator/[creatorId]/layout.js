// Server-only metadata for the public creator page. The page itself is a client
// component (subscribe button, poll voting, live player), and a 'use client'
// page can't export generateMetadata -- so this plain server layout sits next to
// it just to supply the <title> and Open Graph/Twitter text Next.js needs when
// a creator's link gets shared (a TikTok bio, an iMessage thread, a DM). The
// actual preview image comes from opengraph-image.js in this same folder --
// Next.js wires that in automatically, no reference to it needed here.

import { resolveCreator } from '@/lib/resolve-creator';

const BIO_MAX = 160;

export async function generateMetadata({ params }) {
  const creator = await resolveCreator(params.creatorId, 'display_name, bio');
  if (!creator) {
    return { title: 'Creator not found — ByUs' };
  }

  const title = `${creator.display_name} on ByUs`;
  const description = creator.bio
    ? creator.bio.length > BIO_MAX
      ? `${creator.bio.slice(0, BIO_MAX - 1)}…`
      : creator.bio
    : `Support ${creator.display_name} on ByUs — subscriber-only posts, live streams, and more.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function CreatorLayout({ children }) {
  return children;
}
