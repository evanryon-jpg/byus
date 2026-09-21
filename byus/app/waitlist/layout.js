// /waitlist itself is a pure redirect now (see app/waitlist/page.js) to /signup?role=creator,
// which currently renders a waitlist-capture form (creator signup is paused — see
// app/api/waitlist/route.js). This metadata only covers the brief moment before that
// redirect fires (e.g. for link previews / crawlers that don't follow it).
export const metadata = {
  title: 'Join the Founding Creator Waitlist — ByUs',
  description: 'Creator signup is temporarily paused. Join the waitlist to lock in our lowest fee (10%, forever) as one of the first 50 founding creators.',
  alternates: { canonical: '/waitlist' },
};

export default function WaitlistLayout({ children }) {
  return children;
}
