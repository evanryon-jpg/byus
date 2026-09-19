import { BloggerCampaignLink, BloggerCampaignView } from './BloggerCampaignTracking';

export const metadata = {
  title: 'ByUs for bloggers',
  description:
    'Bring your blog to ByUs. Connect your RSS feed, sync with one click any time you publish, then add paid membership on top.',
};

export default function BloggersLandingPage() {
  return (
    <main className="bg-brand-cream">
      <BloggerCampaignView />
      <section className="relative overflow-hidden bg-gradient-to-b from-[#172554] via-[#134B61] to-brand-cream">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(15,118,110,0.18), transparent 65%)' }}
        />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-gold">For bloggers</p>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-extrabold leading-tight text-brand-paper sm:text-6xl">
            Your blog, with membership built in.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-paper/80">
            Point ByUs at your RSS feed, then sync any time you publish and your post shows up on
            your page too — no copy-pasting, no second place to publish. Add paid tiers whenever
            you're ready.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium text-brand-paper/65">
            Keep writing on WordPress, Ghost, Substack, or wherever your blog already lives. ByUs
            reads the feed — it doesn't replace it.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <BloggerCampaignLink
              href="/demo"
              event="demo_click"
              className="rounded-full bg-[#0F766E] px-7 py-3.5 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#115E59]"
            >
              See the live demo
            </BloggerCampaignLink>
            <BloggerCampaignLink
              href="/browse"
              event="browse_click"
              className="rounded-full border-2 border-brand-paper/30 bg-brand-paper/10 px-7 py-3.5 font-semibold text-brand-paper transition hover:border-brand-gold hover:bg-brand-paper/15"
            >
              Browse creators
            </BloggerCampaignLink>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-5 px-6 py-14 md:grid-cols-3">
        {[
          [
            'RSS does the work',
            "Add your feed URL once, then sync whenever you publish. Each post imports once — re-syncing never duplicates it.",
          ],
          [
            'Membership, optional',
            'Set up paid tiers whenever you want, or leave your page free while you decide. Nothing is forced.',
          ],
          [
            'Clear pricing',
            'ByUs shows its platform fee plainly, with standard payment processing covered in it — no surprise cuts.',
          ],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-brand-ink/10 bg-brand-paper p-6 shadow-sm">
            <h2 className="font-display text-lg font-bold text-[#172033]">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-ink/70">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-20 text-center">
        <div className="rounded-2xl border border-[#0F766E]/20 bg-brand-paper p-8 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-[#172033]">Bring your blog over</h2>
          <p className="mx-auto mt-3 max-w-lg text-brand-ink/70">
            Join the waitlist and we'll email you the moment creator signup opens. Once you're in,
            connecting your feed takes one paste and a click.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <BloggerCampaignLink
              href="/signup?role=creator&source=blogger"
              event="signup_click"
              className="rounded-full bg-[#0F766E] px-6 py-3 font-semibold text-white hover:bg-[#115E59]"
            >
              Join the creator waitlist
            </BloggerCampaignLink>
            <BloggerCampaignLink
              href="mailto:support@byusapp.com?subject=Bringing%20my%20blog%20to%20ByUs"
              event="feedback_click"
              className="rounded-full border border-[#0F766E] px-6 py-3 font-semibold text-[#0F766E] hover:bg-[#0F766E]/5"
            >
              Ask us a question
            </BloggerCampaignLink>
          </div>
          <p className="mt-4 text-xs text-brand-ink/55">
            Joining the waitlist is free. We'll only email you when there's real news.
          </p>
        </div>
      </section>
    </main>
  );
}
