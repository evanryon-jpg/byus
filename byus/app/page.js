export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-24 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-[#1A1A1A]">
        Creator subscriptions, <span className="text-[#146359]">simplified</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-black/60">
        ByUs is a clean subscription platform where creators keep 90% of every payment,
        paid directly to their own Stripe account. Flat 10% fee. No hidden processing,
        payout, or currency stack on top.
      </p>
      <div className="mt-10 flex justify-center gap-4">
        <a
          href="/browse"
          className="rounded-full bg-[#146359] px-6 py-3 font-semibold text-white hover:bg-[#0f4d45]"
        >
          Browse creators
        </a>
        <a
          href="/signup?role=creator"
          className="rounded-full border border-[#146359] px-6 py-3 font-semibold text-[#146359] hover:bg-[#146359]/5"
        >
          Become a creator
        </a>
      </div>

      <div className="mt-24 grid gap-8 text-left sm:grid-cols-3">
        <Feature
          title="Direct payouts"
          body="Each creator connects their own Stripe Express account and receives 90% of every charge, automatically, on every renewal."
        />
        <Feature
          title="Tiered memberships"
          body="Build one or more monthly tiers with custom names, descriptions, and prices. Fans pick what fits."
        />
        <Feature
          title="Gated content"
          body="Post public or subscribers-only updates. Access turns off the moment a subscription lapses or is canceled."
        />
      </div>
    </div>
  );
}

function Feature({ title, body }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6">
      <h3 className="font-semibold text-[#146359]">{title}</h3>
      <p className="mt-2 text-sm text-black/60">{body}</p>
    </div>
  );
}
