'use client';

// Interactive sales demo for prospective creators. Everything on this page is fake:
// a fictional creator, fake tiers, a fake checkout, and a fake dashboard. No account,
// no database row, and no Stripe call is ever touched -- every button here just flips
// local component state so a creator can click through the whole loop (join a tier,
// watch a locked post unlock, see the payout math) in about thirty seconds, with
// nothing to sign up for and nothing that could ever charge a real card.

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

const CREATOR = {
  name: 'Alex Rivers',
  handle: '@alexrivers',
  tagline: 'Digital Artist & Animator',
  bio: "I make hand-drawn animation shorts and post the process behind them — for people who like watching a piece come together almost as much as seeing it finished. New sketch every week, a real deep-dive video every month.",
  socials: [
    { label: 'YouTube', href: '#' },
    { label: 'Instagram', href: '#' },
  ],
};

// Cumulative tiers -- joining a higher one is meant to read as "already includes the
// last one", same as the real tier cards elsewhere on the site.
const TIERS = [
  {
    id: 'sketchbook',
    name: 'The Sketchbook',
    price: 5,
    perks: ['Weekly digital sketches', 'Community polls'],
  },
  {
    id: 'bts',
    name: 'Behind the Scenes',
    price: 12,
    popular: true,
    perks: ['Monthly process videos', 'High-res wallpapers', 'Everything in The Sketchbook'],
  },
  {
    id: 'vip',
    name: 'VIP Studio',
    price: 35,
    perks: ['1-on-1 monthly critique stream', 'Physical sticker pack', 'Everything in Behind the Scenes'],
  },
];

// What Post 2 below is gated behind -- kept as one constant so the copy on the tier
// card, the lock overlay, and the unlock check can never quietly drift apart.
const UNLOCK_TIER = TIERS.find((t) => t.id === 'bts');

export default function DemoPage() {
  const [checkoutTier, setCheckoutTier] = useState(null);
  const [subscribedPrice, setSubscribedPrice] = useState(0);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const confettiRef = useRef(null);

  const unlocked = subscribedPrice >= UNLOCK_TIER.price;

  function handleSimulatePayment() {
    if (!checkoutTier) return;
    const tier = checkoutTier;
    setSubscribedPrice((p) => Math.max(p, tier.price));
    setCheckoutTier(null);
    confettiRef.current?.burst();
    setToast(`Payment simulated — you're now a "${tier.name}" member.`);
    window.clearTimeout(handleSimulatePayment._t);
    handleSimulatePayment._t = window.setTimeout(() => setToast(null), 4200);
  }

  return (
    <div className="bg-brand-cream">
      <ConfettiLayer ref={confettiRef} />
      <Toast message={toast} />

      {/* Keeps it unmistakable that this is a sandbox, however far someone scrolls,
          screenshots, or shares the link onward. */}
      <div className="bg-brand-ink px-6 py-2 text-center text-xs font-medium text-brand-paper/80">
        You’re viewing an interactive demo — “{CREATOR.name}” is a fictional creator and no real
        payment is ever processed here.
      </div>

      <DashboardToggle open={dashboardOpen} onToggle={() => setDashboardOpen((v) => !v)} />
      {dashboardOpen && <CreatorDashboardPanel />}

      <FanView unlocked={unlocked} subscribedPrice={subscribedPrice} onJoin={setCheckoutTier} />

      <ClosingCtaBar />

      {checkoutTier && (
        <CheckoutModal tier={checkoutTier} onClose={() => setCheckoutTier(null)} onSimulate={handleSimulatePayment} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fan-facing profile
// ---------------------------------------------------------------------------

function FanView({ unlocked, subscribedPrice, onJoin }) {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-20 pt-10">
      <ProfileHeader />

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-brand-ink">Membership tiers</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} subscribedPrice={subscribedPrice} onJoin={() => onJoin(tier)} />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-brand-ink">Posts</h2>
        <div className="mt-4 space-y-6">
          <PublicPost />
          <LockedPost unlocked={unlocked} onUnlock={() => onJoin(UNLOCK_TIER)} />
        </div>
      </section>
    </div>
  );
}

function ProfileHeader() {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-ink/15 bg-brand-paper shadow-sm">
      <div
        className="h-36 sm:h-44"
        style={{
          background: 'repeating-linear-gradient(115deg, #C97C5D 0 60px, #C9A961 60px 120px, #146359 120px 180px)',
        }}
        aria-hidden="true"
      />
      <div className="-mt-10 px-6 pb-6 sm:px-8">
        <div className="flex h-20 w-20 -rotate-3 items-center justify-center rounded-2xl border-4 border-brand-paper bg-[#0f4d45] font-display text-3xl font-bold text-[#F5E9D8]">
          AR
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-bold text-brand-ink">{CREATOR.name}</h1>
          <span className="text-sm text-brand-ink/50">{CREATOR.handle}</span>
        </div>
        <p className="text-sm font-semibold text-brand-teal">{CREATOR.tagline}</p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-ink/70">{CREATOR.bio}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CREATOR.socials.map((s) => (
            <span
              key={s.label}
              className="rounded border border-brand-ink/20 bg-[#F5E9D8] px-2 py-1 text-[11px] font-bold text-brand-ink/65"
            >
              {s.label} ↗
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TierCard({ tier, subscribedPrice, onJoin }) {
  const included = subscribedPrice >= tier.price;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-brand-paper p-5 shadow-sm ${
        tier.popular ? 'border-brand-gold' : 'border-brand-ink/15'
      }`}
    >
      {tier.popular && (
        <span className="absolute -top-3 left-5 rounded bg-brand-clay px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#F5E9D8]">
          Most popular
        </span>
      )}
      <p className="font-display text-lg font-bold text-brand-ink">{tier.name}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-brand-teal">
        ${tier.price}
        <span className="text-sm font-medium text-brand-ink/50">/mo</span>
      </p>
      <ul className="mt-3 flex-1 space-y-1.5 text-sm text-brand-ink/70">
        {tier.perks.map((perk) => (
          <li key={perk} className="flex gap-2">
            <span className="text-brand-teal">✓</span>
            {perk}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onJoin}
        disabled={included}
        className={`mt-4 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
          included
            ? 'cursor-default bg-brand-teal/10 text-brand-teal'
            : tier.popular
            ? 'bg-brand-teal text-brand-paper hover:bg-[#0f4d45]'
            : 'border border-brand-ink/20 text-brand-ink hover:bg-brand-ink/5'
        }`}
      >
        {included ? '✓ Included in your plan' : `Join · $${tier.price}/mo`}
      </button>
    </div>
  );
}

function PublicPost() {
  return (
    <article className="overflow-hidden rounded-2xl border border-brand-ink/15 bg-brand-paper shadow-sm">
      <div
        className="flex h-56 items-center justify-center text-6xl"
        style={{ background: 'linear-gradient(135deg, #C9A961 0%, #E8DCC4 100%)' }}
        aria-hidden="true"
      >
        🎨
      </div>
      <div className="p-5">
        <p className="text-sm leading-relaxed text-brand-ink/80">
          Thanks for checking out my page! Full process video is locked for Tier 2+ members below.
        </p>
      </div>
    </article>
  );
}

function LockedPost({ unlocked, onUnlock }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-brand-ink/15 bg-brand-paper shadow-sm">
      <div className="relative flex h-56 items-center justify-center overflow-hidden">
        <div
          className={`absolute inset-0 flex items-center justify-center text-6xl transition ${
            unlocked ? '' : 'scale-110 blur-md'
          }`}
          style={{ background: 'linear-gradient(135deg, #146359 0%, #0f4d45 100%)' }}
          aria-hidden="true"
        >
          🎬
        </div>
        {!unlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-brand-ink/50 px-6 text-center">
            <span className="text-3xl" aria-hidden="true">🔒</span>
            <p className="text-sm font-semibold text-brand-paper">Behind the Scenes members only</p>
            <button
              type="button"
              onClick={onUnlock}
              className="rounded-full bg-brand-gold px-4 py-2 text-sm font-semibold text-[#2B2420] shadow-sm transition hover:brightness-95"
            >
              Unlock this post by joining “{UNLOCK_TIER.name}” (${UNLOCK_TIER.price}/mo)
            </button>
          </div>
        )}
        {unlocked && (
          <span className="absolute right-3 top-3 rounded-full bg-brand-teal px-2.5 py-1 text-[11px] font-bold text-brand-paper">
            ✓ Unlocked
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="text-sm leading-relaxed text-brand-ink/80">
          {unlocked
            ? 'New process video: inking the flight scene, start to finish — thanks for joining!'
            : 'New process video: inking the flight scene, start to finish.'}
        </p>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Creator's-eye view
// ---------------------------------------------------------------------------

function DashboardToggle({ open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-center gap-2 border-b border-brand-teal/20 bg-brand-teal/10 px-6 py-3 text-center text-sm font-semibold text-brand-teal transition hover:bg-brand-teal/15"
    >
      {open ? (
        <>👀 Viewing the Creator’s Dashboard — click to return to the Fan View</>
      ) : (
        <>💡 You’re viewing the Fan View. Click here to see the Creator’s Dashboard for this page.</>
      )}
    </button>
  );
}

function CreatorDashboardPanel() {
  const gross = 840;
  const feeRate = 0.1;
  const fee = gross * feeRate;
  const payout = gross - fee;

  return (
    <div className="border-b border-brand-ink/10 bg-[#F5E9D8] px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink/50">Live revenue tracker</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-display text-4xl font-bold tabular-nums text-brand-teal">
              ${gross.toFixed(2)}
            </p>
            <p className="text-sm text-brand-ink/60">Earned this month</p>
          </div>
          <div className="rounded-xl border border-brand-ink/15 bg-brand-paper px-5 py-3 text-sm">
            <div className="flex justify-between gap-8 tabular-nums">
              <span className="text-brand-ink/60">ByUs fee (10%)</span>
              <span className="font-semibold text-brand-clay">-${fee.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-8 tabular-nums">
              <span className="text-brand-ink/60">Payout sent to Stripe</span>
              <span className="font-semibold text-brand-ink">${payout.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
          ✓ Payout automatically transferred to Stripe Express
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simulated checkout
// ---------------------------------------------------------------------------

function CheckoutModal({ tier, onClose, onSimulate }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-brand-paper p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Simulated checkout"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-ink/50">🔒 Simulated checkout</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-brand-ink/40 transition hover:text-brand-ink"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 font-display text-lg font-bold text-brand-ink">{tier.name}</p>
        <p className="text-2xl font-bold tabular-nums text-brand-teal">
          ${tier.price}
          <span className="text-sm font-medium text-brand-ink/50">/mo</span>
        </p>

        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-brand-ink/15 bg-brand-cream/60 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-ink/40">Card number</p>
            <p className="font-mono text-sm text-brand-ink/70">4242 4242 4242 4242</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-brand-ink/15 bg-brand-cream/60 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-ink/40">Expiry</p>
              <p className="font-mono text-sm text-brand-ink/70">12 / 34</p>
            </div>
            <div className="rounded-lg border border-brand-ink/15 bg-brand-cream/60 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-ink/40">CVC</p>
              <p className="font-mono text-sm text-brand-ink/70">123</p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-brand-ink/50">
          This is a demo — the card above is fake and no real payment is ever charged.
        </p>

        <button
          type="button"
          onClick={onSimulate}
          className="mt-4 w-full rounded-full bg-brand-teal px-5 py-3 text-sm font-semibold text-brand-paper shadow-sm transition hover:bg-[#0f4d45]"
        >
          Simulate Fan Payment
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom conversion bar
// ---------------------------------------------------------------------------

function ClosingCtaBar() {
  return (
    <section className="bg-brand-teal px-6 py-14 text-center">
      <div className="mx-auto max-w-xl">
        <h2 className="font-display text-2xl font-bold text-brand-paper sm:text-3xl">
          Like how clean this looks?
        </h2>
        <p className="mt-2 text-brand-paper/80">Launch your own identical page in less than 5 minutes.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/signup?role=creator"
            className="rounded-full bg-brand-paper px-7 py-3 font-semibold text-brand-teal shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Claim Your Username Now →
          </a>
          <a
            href="/"
            className="rounded-full border border-white/40 px-7 py-3 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
          >
            Back to Homepage
          </a>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Toast + confetti -- small, self-contained, no external dependency
// ---------------------------------------------------------------------------

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div className="pointer-events-auto rounded-full bg-brand-ink px-5 py-2.5 text-sm font-semibold text-brand-paper shadow-lg">
        🎉 {message}
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ['#146359', '#C9A961', '#C97C5D', '#F5E9D8', '#0f4d45'];

// Hand-rolled instead of pulling in a confetti package -- this only needs one
// one-shot burst, so a tiny canvas particle sim keeps the demo dependency-free.
const ConfettiLayer = forwardRef(function ConfettiLayer(_props, ref) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  useImperativeHandle(ref, () => ({
    burst() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      particlesRef.current = Array.from({ length: 140 }, () => ({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.25,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 10 - 4,
        size: Math.random() * 6 + 4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        life: 0,
      }));

      const ctx = canvas.getContext('2d');
      const start = performance.now();

      function tick(now) {
        const elapsed = now - start;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particlesRef.current.forEach((p) => {
          p.vy += 0.35; // gravity
          p.x += p.vx;
          p.y += p.vy;
          p.rotation += p.spin;
          p.life = elapsed;

          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - elapsed / 2600);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        });

        if (elapsed < 2600) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          stop();
        }
      }

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    },
  }));

  useEffect(() => stop, [stop]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70]"
    />
  );
});
