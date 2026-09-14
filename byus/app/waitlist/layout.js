// /waitlist itself is a pure redirect now (see app/waitlist/page.js) — creator signup
// is open, so this metadata only covers the brief moment before that redirect fires
// (e.g. for link previews / crawlers that don't follow it) and should read like a
// pointer to signup, not a still-open application form.
export const metadata = {
  title: 'Become a Founding Creator — ByUs',
  description: 'Creator signup is open now — lock in our lowest fee (10%, forever) as one of the first 100 founding creators.',
  alternates: { canonical: '/waitlist' },
};

export default function WaitlistLayout({ children }) {
  return children;
}
