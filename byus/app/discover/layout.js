// Server-only metadata for the public discovery feed. app/discover/page.js is a
// 'use client' component (infinite-scroll feed, report modal), and a 'use client'
// page can't export `metadata` -- without this sibling layout, the page silently
// fell back to the root layout's generic homepage title/description for both search
// results and link previews (Slack, iMessage, Twitter). Same pattern as
// app/browse/layout.js and app/creator/[creatorId]/layout.js.
export const metadata = {
  title: 'Discover — ByUs',
  description: 'Every public post from every creator on ByUs, newest first — no account needed to browse.',
  alternates: { canonical: '/discover' },
  openGraph: {
    title: 'Discover — ByUs',
    description: 'Every public post from every creator on ByUs, newest first — no account needed to browse.',
    url: '/discover',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discover — ByUs',
    description: 'Every public post from every creator on ByUs, newest first — no account needed to browse.',
  },
};

export default function DiscoverLayout({ children }) {
  return children;
}
