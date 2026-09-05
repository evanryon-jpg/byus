import { getCurrentUser } from '@/lib/session';
import FAQSection from './components/FAQSection';
import CreatorSearch from './components/CreatorSearch';
import PlatformGoalGauge from './components/PlatformGoalGauge';
import FeaturedCreators from './components/FeaturedCreators';
import EarningsCalculator from './components/EarningsCalculator';

// Server component so the hero and closing CTAs can tell whether someone is already
// logged in -- an existing creator or fan should never be invited to sign up again,
// they should be pointed straight back to the page they actually want.
export default async function HomePage() {
  const session = await getCurrentUser();

  return (
    <div>
      <Hero user={session} />
      <FeaturedCreators />
      <StatsBand />
      <EarningsCalculator />
      <PlatformGoalGauge />
      <Features />
      <HowItWorks />
      <FAQSection />
      <ClosingCta user={session} />
    </div>
  );
}

function Hero({ user }) {
  const dashboardHref = user?.role === 'creator' ? '/creator/dashboard' : '/fan/dashboard';

  return (
    <section className="relative overflow-hidden">
      {/* Soft warm gradient blobs — decorative only, sit behind the copy */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/4 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-brand-gold/10 blur-3xl" />
        <div className="absolute -top-10 right-0 h-[28rem] w-[28rem] translate-x-1/3 rounded-full bg-brand-teal/[0.06] blur-3xl" />
      </div>

      {/* Asymmetric split — copy/search on the left, a live preview of what a
          creator's page actually looks like on the right, so the hero answers
          "what am I building/joining" instead of just describing it. */}
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex -rotate-2 items-center gap-2 rounded border border-dashed border-brand-clay bg-[#F5E9D8] px-4 py-1.5 font-display text-xs font-semibold italic tracking-wide text-[#B5613F]">
              Made for creators, built around fairness
            </span>

            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-[#2B2420] sm:text-5xl lg:text-[3.25rem]">
              Connect with your{' '}
              <span className="relative inline-block whitespace-nowrap">
                favorite
                <svg
                  className="absolute -bottom-1.5 left-0 w-full"
                  height="10"
                  viewBox="0 0 200 10"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M2 6 Q 50 1, 100 5 T 198 6" stroke="#C9A961" strokeWidth="4" fill="none" strokeLinecap="round" />
                </svg>
              </span>{' '}
              creators
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-brand-ink/72">
              Type a creator's name below, or set up your own page in a couple of minutes.
              Creators keep 90% of every payment to start — and 93% for good once they've
              grown with us. Nothing hidden.
            </p>

            <CreatorSearch />

            <div className="mt-5 flex flex-wrap gap-4">
              {user ? (
                <a
                  href={dashboardHref}
                  className="text-sm font-semibold text-brand-teal hover:underline"
                >
                  {user.role === 'creator' ? 'Go to your dashboard' : 'Your subscriptions'} →
                </a>
              ) : (
                <a href="/signup?role=creator" className="text-sm font-semibold text-brand-teal hover:underline">
                  Are you a creator? Start your own page →
                </a>
              )}
            </div>

            <p className="mt-8 text-sm text-brand-ink/62">
              90%+ direct payouts&nbsp;&nbsp;·&nbsp;&nbsp;fee drops as you grow&nbsp;&nbsp;·&nbsp;&nbsp;cancel anytime
            </p>
          </div>

          <ProfilePreview />
        </div>
      </div>
    </section>
  );
}

// A purely decorative stand-in for a real creator's page -- shows a fan what they're
// about to get (banner, tiers, pick of one "most popular" plan) instead of the old
// fanned-swatch motif that only gestured at "there's a tier for every kind of
// supporter." Not tied to any real creator or account.
function ProfilePreview() {
  const tiers = [
    { name: 'Supporter', price: '$5.00/mo' },
    { name: 'Fan club', price: '$10.00/mo', popular: true },
    { name: 'VIP', price: '$25.00/mo' },
  ];

  return (
    <div className="mx-auto w-full max-w-sm rotate-1 rounded-2xl border border-brand-ink/20 bg-brand-paper shadow-xl shadow-brand-ink/10">
      <div
        className="h-20 rounded-t-2xl"
        style={{
          background: 'repeating-linear-gradient(115deg, #C97C5D 0 60px, #C9A961 60px 120px, #146359 120px 180px)',
        }}
        aria-hidden="true"
      />
      <div className="-mt-8 px-6 pb-6">
        <div className="flex h-14 w-14 -rotate-3 items-center justify-center rounded-2xl border-4 border-brand-paper bg-[#0f4d45] font-display text-2xl font-bold text-[#F5E9D8]">
          M
        </div>
        <p className="mt-3 font-display text-lg font-bold text-[#2B2420]">Mara Lindqvist</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['TikTok', 'YouTube', 'Instagram'].map((s) => (
            <span
              key={s}
              className="rounded border border-brand-ink/20 bg-[#F5E9D8] px-2 py-1 text-[11px] font-bold text-brand-ink/65"
            >
              {s} ↗
            </span>
          ))}
        </div>
        <div className="mt-5 space-y-2">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm ${
                t.popular ? 'border-brand-gold bg-brand-gold/15' : 'border-brand-ink/15'
              }`}
            >
              {t.popular && (
                <span className="absolute -top-2.5 right-3 rotate-3 rounded bg-brand-clay px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-[#F5E9D8]">
                  Most popular
                </span>
              )}
              <span className="font-semibold text-[#2B2420]">{t.name}</span>
              <span className="font-semibold tabular-nums text-brand-teal">{t.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatsBand() {
  const stats = [
    { value: '90%', label: "kept by the creator, every renewal — 93% once they've grown with us" },
    {
      value: '10% → 7%',
      label: 'platform fee — drops to 7% for any month you earn $2,000+ on ByUs; Stripe’s own processing comes out of our cut, never billed to you separately',
    },
    { value: '$0', label: 'to start; no listing or setup cost' },
  ];
  const tilts = ['-rotate-[1.1deg]', 'rotate-[0.8deg]', '-rotate-[0.6deg]'];

  return (
    <section className="border-y border-brand-ink/10 bg-brand-paper">
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-14 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`rounded-xl border border-brand-ink/20 bg-[#F5E9D8] px-6 py-6 text-center ${tilts[i % tilts.length]}`}
          >
            <div className="font-display text-4xl font-bold tabular-nums text-brand-teal">{s.value}</div>
            <p className="mt-2 text-sm leading-relaxed text-brand-ink/68">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold text-[#2B2420]">
          Everything a membership needs, nothing it doesn&rsquo;t
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-ink/68">
          No churn dashboards to configure — just the parts that make a subscription work.
        </p>
      </div>

      {/* Asymmetric rhythm instead of three uniform boxes -- Direct payouts gets the
          big 2/3 slot since Stripe Express payouts are the actual differentiator,
          the other two stack beside it rather than competing for equal weight. */}
      <div className="mt-14 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Feature
          big
          icon={<PayoutIcon />}
          accent="teal"
          title="Direct payouts"
          body="Each creator connects their own Stripe Express account and receives 90% of every charge automatically — rising to 93% for good once they've grown with us. This is the whole model, so it gets the room to say it plainly."
        />
        <div className="flex flex-col gap-6">
          <Feature
            icon={<TiersIcon />}
            accent="gold"
            title="Tiered memberships"
            body="Build one or more monthly tiers with custom names, descriptions, and prices. Fans pick what fits."
          />
          <Feature
            icon={<LockIcon />}
            accent="clay"
            title="Gated content"
            body="Post public or subscribers-only updates. Access turns off the moment a subscription lapses or is canceled."
          />
        </div>
      </div>
    </section>
  );
}

const accentClasses = {
  teal: { bg: 'bg-brand-teal/10', text: 'text-brand-teal' },
  gold: { bg: 'bg-brand-gold/15', text: 'text-[#8a6b2f]' },
  clay: { bg: 'bg-brand-clay/15', text: 'text-brand-clay' },
};

function Feature({ icon, accent, title, body, big }) {
  const c = accentClasses[accent];
  return (
    <div
      className={`group rounded-2xl border bg-brand-paper text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        big ? 'flex h-full flex-col justify-center border-brand-teal/30 p-8' : 'border-brand-ink/15 p-6'
      }`}
    >
      <div
        className={`flex items-center justify-center rounded-xl ${c.bg} ${c.text} ${
          big ? 'h-14 w-14' : 'h-11 w-11'
        }`}
      >
        {icon}
      </div>
      <h3 className={`mt-4 font-semibold text-[#2B2420] ${big ? 'text-xl' : ''}`}>{title}</h3>
      <p className={`mt-2 leading-relaxed text-brand-ink/72 ${big ? 'max-w-md text-base' : 'text-sm'}`}>{body}</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Set up your page',
      body: 'Add a bio, a photo, and one or more monthly tiers with your own pricing.',
    },
    {
      n: '02',
      title: 'Connect Stripe',
      body: 'Link your own Stripe Express account once — payouts land there directly, every time.',
    },
    {
      n: '03',
      title: 'Share and post',
      body: 'Publish public updates to bring people in, and subscriber-only posts to reward them for joining.',
    },
  ];
  return (
    <section className="bg-brand-paper">
      <div className="mx-auto max-w-4xl px-6 py-24">
        <h2 className="text-center font-display text-3xl font-semibold text-[#2B2420]">
          Up and running in three steps
        </h2>

        <div className="mt-14 grid gap-10 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.n} className="relative text-left">
              <span className="font-display text-3xl font-semibold text-brand-gold/70">{s.n}</span>
              <h3 className="mt-3 font-semibold text-[#2B2420]">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-ink/72">{s.body}</p>
              {i < steps.length - 1 && (
                <span
                  className="absolute right-[-1.25rem] top-2 hidden text-brand-ink/35 sm:block"
                  aria-hidden="true"
                >
                  &rarr;
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta({ user }) {
  const dashboardHref = user?.role === 'creator' ? '/creator/dashboard' : '/fan/dashboard';

  return (
    <section className="relative overflow-hidden bg-brand-teal">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-gold/20 blur-3xl" />
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">
          {user ? 'Welcome back.' : 'Ready to get started?'}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-white/75">
          {user
            ? 'Pick up right where you left off.'
            : 'Whether you’re here to support someone or to build your own membership, it takes a couple of minutes to set up.'}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          {user ? (
            <a
              href={dashboardHref}
              className="rounded-full bg-brand-paper px-7 py-3 font-semibold text-brand-teal shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Go to your dashboard
            </a>
          ) : (
            <a
              href="/signup"
              className="rounded-full bg-brand-paper px-7 py-3 font-semibold text-brand-teal shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Create your account
            </a>
          )}
          <a
            href="/browse"
            className="rounded-full border border-white/40 px-7 py-3 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
          >
            Browse creators
          </a>
        </div>
        {!user && (
          <p className="mt-5 text-xs text-white/50">🔒 Payments secured by Stripe</p>
        )}
      </div>
    </section>
  );
}

function PayoutIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" strokeLinecap="round" />
      <path d="M12 3l3.5 3.5" strokeLinecap="round" />
      <path d="M12 3l-3.5 3.5" strokeLinecap="round" />
      <path d="M12 3v6" strokeLinecap="round" />
    </svg>
  );
}

function TiersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" strokeLinejoin="round" />
      <path d="M3 18l9 5 9-5" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
