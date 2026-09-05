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
        <div className="absolute -top-24 left-1/2 h-[36rem] w-[36rem] -translate-x-[60%] rounded-full bg-brand-gold/10 blur-3xl" />
        <div className="absolute -top-10 right-0 h-[28rem] w-[28rem] translate-x-1/3 rounded-full bg-brand-teal/[0.06] blur-3xl" />
        <div className="absolute top-40 left-1/2 h-72 w-72 -translate-x-1/4 rounded-full bg-brand-clay/[0.06] blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-gold/15 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#8a6b2f]">
          Made for creators, built around fairness
        </span>

        <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.1] tracking-tight text-[#2B2420] sm:text-6xl">
          Connect with your favorite creators
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-ink/60">
          Type a creator's name below, or set up your own page in a couple of minutes.
          Creators keep 90% of every payment to start — and 93% for good once they've
          grown with us. Nothing hidden.
        </p>

        <CreatorSearch />

        <div className="mt-6 flex flex-wrap justify-center gap-4">
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

        <p className="mt-8 text-sm text-brand-ink/45">
          90%+ direct payouts&nbsp;&nbsp;·&nbsp;&nbsp;fee drops as you grow&nbsp;&nbsp;·&nbsp;&nbsp;cancel anytime
        </p>

        <AvatarCluster />
      </div>
    </section>
  );
}

// Purely decorative cluster of warm, abstract circles standing in for a community of
// creators and fans — intentionally not photographic, so it never implies real people
// or real numbers we can't back up.
function AvatarCluster() {
  const swatches = [
    'bg-brand-teal',
    'bg-brand-gold',
    'bg-brand-clay',
    'bg-brand-teal/70',
    'bg-brand-gold/80',
    'bg-brand-clay/70',
  ];
  return (
    <div className="mt-12 flex flex-col items-center gap-3">
      <div className="flex -space-x-3">
        {swatches.map((c, i) => (
          <span
            key={i}
            className={`h-9 w-9 rounded-full border-2 border-[#FAF8F4] ${c} shadow-sm`}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-ink/40">
        Built for creators of every kind
      </p>
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
  return (
    <section className="border-y border-brand-ink/5 bg-brand-paper">
      <div className="mx-auto grid max-w-4xl gap-8 px-6 py-12 text-center sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="font-display text-4xl font-semibold text-brand-teal">{s.value}</div>
            <p className="mt-2 text-sm text-brand-ink/55">{s.label}</p>
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
        <p className="mx-auto mt-3 max-w-xl text-brand-ink/55">
          No churn dashboards to configure — just the parts that make a subscription work.
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        <Feature
          icon={<PayoutIcon />}
          accent="teal"
          title="Direct payouts"
          body="Each creator connects their own Stripe Express account and receives 90% of every charge automatically — rising to 93% for good once they've grown with us."
        />
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
    </section>
  );
}

const accentClasses = {
  teal: { bg: 'bg-brand-teal/10', text: 'text-brand-teal' },
  gold: { bg: 'bg-brand-gold/15', text: 'text-[#8a6b2f]' },
  clay: { bg: 'bg-brand-clay/15', text: 'text-brand-clay' },
};

function Feature({ icon, accent, title, body }) {
  const c = accentClasses[accent];
  return (
    <div className="group rounded-2xl border border-brand-ink/5 bg-brand-paper p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-[#2B2420]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-brand-ink/60">{body}</p>
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
              <p className="mt-2 text-sm leading-relaxed text-brand-ink/60">{s.body}</p>
              {i < steps.length - 1 && (
                <span
                  className="absolute right-[-1.25rem] top-2 hidden text-brand-ink/15 sm:block"
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
