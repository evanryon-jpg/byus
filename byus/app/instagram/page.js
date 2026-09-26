// Where the "link in bio" on @joinbyus lands. Rewritten Sept 26, 2026: this page used to
// ask creators for their opinion ("We'd value your honest opinion"); ByUs now shows
// creators what it offers instead, matching the page-setup Reel (same headline, same three
// promises). The campaign events (view / demo_click / browse_click / signup_click) still
// feed the "Instagram campaign funnel" card on /admin.

import { InstagramCampaignLink, InstagramCampaignView } from './InstagramCampaignTracking';
import { query } from '@/lib/db';
import { getFoundingPromoStats } from '@/lib/fees';
import { FOUNDING_CREATOR_LIMIT, STANDARD_FEE_PERCENT } from '@/lib/pricing';

export const revalidate = 300; // founding-spot count refreshes every 5 minutes

export const metadata = {
  title: 'Your fans. Your page. Your cut. | ByUs',
  description:
    'Set up a creator page in minutes, offer memberships from $8, and get paid every Monday. The first 50 US creators keep 90% for good.',
};

async function loadRemainingSpots() {
  try {
    const stats = await getFoundingPromoStats(query);
    return stats.remaining;
  } catch (err) {
    console.error('instagram page: founding stats failed:', err);
    return null; // page still renders, just without the live count
  }
}

const PROMISES = [
  {
    stat: '90%',
    title: 'Keep 90%, for good',
    body: `The first ${FOUNDING_CREATOR_LIMIT} US creators pay a 10% platform fee for as long as they're on ByUs, with standard domestic card processing included. After that, it's ${STANDARD_FEE_PERCENT}%, dropping to 10% for any month you earn $2,000.`,
  },
  {
    stat: 'Mon',
    title: 'Paid every Monday',
    body: 'Your earnings go to your bank every week. Stripe holds a brand-new account’s first payout for about 7–14 days, then it’s every Monday.',
  },
  {
    stat: '$8',
    title: 'Yearly built in',
    body: 'Memberships start at $8 a month. Fans can pay yearly and get two months free, which means fewer card fees and steadier income for you.',
  },
];

const STEPS = [
  ['Make your page', 'Add a photo, a cover image, and a short bio. Pin a welcome post so new visitors know where to start.'],
  ['Add a membership', 'Name a tier and set a monthly price. The yearly price fills in for you, and you see exactly what you keep.'],
  ['Fans join', 'Supporters join from your page, and you get paid every Monday. Posts, videos, and downloads all live in one place.'],
];

export default async function InstagramWelcomePage() {
  const remaining = await loadRemainingSpots();
  const spotsLine =
    remaining === null
      ? `${FOUNDING_CREATOR_LIMIT} founding creator spots`
      : remaining > 0
      ? `${remaining} of ${FOUNDING_CREATOR_LIMIT} founding spots left`
      : 'Founding spots are full';

  return (
    <main className="bg-brand-cream">
      <InstagramCampaignView />
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0B1B2E] via-[#10263A] to-[#0E3440]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(15,118,110,0.35), transparent 65%)' }}
        />
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-14 text-center sm:pb-20 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-gold">
            {spotsLine}
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance font-display text-4xl font-extrabold leading-[1.05] text-brand-paper sm:text-6xl">
            Your fans. Your page. <em className="font-semibold text-[#5EC8BA]">Your cut.</em>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-paper/80">
            Set up a creator page in minutes, offer memberships from $8, and get paid every Monday.
            The first {FOUNDING_CREATOR_LIMIT} US creators keep 90% of what they earn, for good.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <InstagramCampaignLink
              href="/signup?role=creator&source=instagram"
              event="signup_click"
              className="rounded-full bg-brand-gold px-7 py-3.5 font-bold text-[#2a1f05] shadow-lg transition hover:-translate-y-0.5 hover:brightness-105"
            >
              Reserve a founding spot
            </InstagramCampaignLink>
            <InstagramCampaignLink
              href="/demo"
              event="demo_click"
              className="rounded-full border-2 border-brand-paper/30 bg-brand-paper/10 px-7 py-3.5 font-semibold text-brand-paper transition hover:border-brand-gold hover:bg-brand-paper/15"
            >
              See an example page
            </InstagramCampaignLink>
          </div>
          <p className="mt-5 text-sm text-brand-paper/60">
            Free to reserve. You can keep using any platform you already have.
          </p>
          <p className="mt-1.5 text-xs text-brand-paper/50">
            Creator accounts open in the US first, with the UK, Europe and Canada next.
          </p>
        </div>
      </section>

      <section aria-label="What you get" className="mx-auto grid max-w-4xl gap-5 px-6 py-14 md:grid-cols-3">
        {PROMISES.map((p) => (
          <div key={p.title} className="rounded-2xl border border-brand-ink/10 bg-brand-paper p-6 shadow-sm">
            <p className="font-display text-3xl font-extrabold text-[#0F766E]">{p.stat}</p>
            <h2 className="mt-2 font-display text-lg font-bold text-[#172033]">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{p.body}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-[#0F766E]/25 bg-[#0F766E]/5 p-6 md:col-span-3">
          <h2 className="font-display text-lg font-bold text-[#172033]">Already on another platform? Bring your fans. Nobody pays twice.</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">
            Send your members a switching link. They join right away, and their first ByUs charge waits until
            what they already paid on the old platform runs out.
          </p>
        </div>
      </section>

      <section aria-labelledby="how-it-works" className="mx-auto max-w-4xl px-6 pb-14">
        <h2 id="how-it-works" className="text-center font-display text-2xl font-bold text-[#172033] sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4 md:flex-col md:gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0F766E] font-bold text-white"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-[#172033]">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-brand-ink/70">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-center text-sm text-brand-ink/60">
          Want to see a finished page first?{' '}
          <InstagramCampaignLink href="/demo" event="demo_click" className="font-semibold text-[#0F766E] underline">
            Try the example creator page
          </InstagramCampaignLink>{' '}
          or{' '}
          <InstagramCampaignLink href="/browse" event="browse_click" className="font-semibold text-[#0F766E] underline">
            browse creators
          </InstagramCampaignLink>
          .
        </p>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-20 text-center">
        <div className="rounded-2xl border border-[#0F766E]/20 bg-brand-paper p-8 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9C7C3E]">{spotsLine}</p>
          <h2 className="mt-3 text-balance font-display text-2xl font-bold text-[#172033] sm:text-3xl">
            Lock in 90% before the founding spots are gone
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-brand-ink/70">
            Reserve your spot now. We&rsquo;ll email you the moment creator accounts open, and your
            10% rate is locked in for as long as you&rsquo;re on ByUs.
          </p>
          <div className="mt-6">
            <InstagramCampaignLink
              href="/signup?role=creator&source=instagram"
              event="signup_click"
              className="inline-block rounded-full bg-[#0F766E] px-7 py-3.5 font-bold text-white shadow-sm transition hover:bg-[#115E59]"
            >
              Reserve a founding spot
            </InstagramCampaignLink>
          </div>
          <p className="mt-4 text-xs text-brand-ink/55">Reserving is free. No card needed.</p>
        </div>
      </section>
    </main>
  );
}
