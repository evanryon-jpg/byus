import { InstagramCampaignLink, InstagramCampaignView } from './InstagramCampaignTracking';

export const metadata = {
  title: 'Creators, we want your opinion | ByUs',
  description:
    'Take a look at ByUs and tell us what creators need from a membership platform. No pressure to switch or sign up.',
};

export default function InstagramWelcomePage() {
  return (
    <main className="bg-brand-cream">
      <InstagramCampaignView />
      <section className="relative overflow-hidden bg-gradient-to-b from-[#172554] via-[#134B61] to-brand-cream">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(15,118,110,0.18), transparent 65%)' }}
        />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-gold">
            A note to creators
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-extrabold leading-tight text-brand-paper sm:text-6xl">
            We built ByUs. We&rsquo;d value your honest opinion.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-paper/80">
            You do not need to leave Patreon, Ko-fi, or any platform you already use. Take a look
            around, tell us what works, and tell us what creators need us to improve.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium text-brand-paper/65">
            No sales pressure. No obligation to sign up. We&rsquo;re listening.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <InstagramCampaignLink
              href="/demo"
              event="demo_click"
              className="rounded-full bg-[#0F766E] px-7 py-3.5 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#115E59]"
            >
              See the live demo
            </InstagramCampaignLink>
            <InstagramCampaignLink
              href="/browse"
              event="browse_click"
              className="rounded-full border-2 border-brand-paper/30 bg-brand-paper/10 px-7 py-3.5 font-semibold text-brand-paper transition hover:border-brand-gold hover:bg-brand-paper/15"
            >
              Browse creators
            </InstagramCampaignLink>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-5 px-6 py-14 md:grid-cols-3">
        {[
          ['Easy to start', 'Set up a creator page, membership tiers, posts, and downloads without a complicated dashboard.'],
          ['Clear pricing', 'Creators see the platform fee plainly, with standard domestic payment processing covered in it.'],
          ['No forced switch', 'ByUs can be tested alongside an existing platform. Creators decide what fits their audience.'],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-brand-ink/10 bg-brand-paper p-6 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#172033]">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-20 text-center">
        <div className="rounded-2xl border border-[#0F766E]/20 bg-brand-paper p-8 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-[#172033]">What would you change?</h2>
          <p className="mx-auto mt-3 max-w-lg text-brand-ink/70">
            Send the good, the bad, and the missing. Honest feedback is more helpful to us than a
            polite answer.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <InstagramCampaignLink
              href="mailto:support@byusapp.com?subject=My%20honest%20feedback%20on%20ByUs"
              event="feedback_click"
              className="rounded-full bg-[#0F766E] px-6 py-3 font-semibold text-white hover:bg-[#115E59]"
            >
              Send your opinion
            </InstagramCampaignLink>
            <InstagramCampaignLink
              href="/signup?role=creator&source=instagram"
              event="signup_click"
              className="rounded-full border border-[#0F766E] px-6 py-3 font-semibold text-[#0F766E] hover:bg-[#0F766E]/5"
            >
              Create a free creator account
            </InstagramCampaignLink>
          </div>
          <p className="mt-4 text-xs text-brand-ink/55">
            Creating an account is free. You are not charged and do not need to leave another
            platform.
          </p>
        </div>
      </section>
    </main>
  );
}
