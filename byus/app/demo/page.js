'use client';

// Interactive sales demo for prospective creators. Everything on this page is fake:
// a fictional creator, fake tiers, a fake checkout, and a fake dashboard. No account,
// no database row, and no Stripe call is ever touched -- every button here just flips
// local component state so a creator can click through the whole loop (join a tier,
// watch a locked post unlock, see the payout math) in about thirty seconds, with
// nothing to sign up for and nothing that could ever charge a real card.

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { STANDARD_FEE_PERCENT } from '@/lib/pricing';

const CREATOR = {
  name: 'Alex Rivers',
  handle: '@alexrivers',
  tagline: 'Fantasy Concept Artist & Illustrator',
  bio: "I paint the landscapes and characters for worlds that don't exist yet — moody environments, portrait studies, and the sketches that get me there. New piece every week, a full process breakdown every month.",
  stats: { members: '1,240', posts: '89', since: '2022' },
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

      <ViewToggle open={dashboardOpen} onChange={setDashboardOpen} />
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
    <div className="mx-auto max-w-4xl px-6 pb-20 pt-10">
      <ProfileHeader />

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_268px]">
        <div>
          <p className="mb-5 text-[11px] font-extrabold uppercase tracking-wide text-brand-ink/40">Recent work</p>
          <div className="flex flex-col gap-11">
            <HeroPiece />
            <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
              <FieldNote />
              <TallPiece />
            </div>
            <LockedHeroPiece unlocked={unlocked} onUnlock={() => onJoin(UNLOCK_TIER)} />
            <div className="grid grid-cols-2 gap-5">
              <SmallPiece
                src="/images/demo/castle-detail.jpg"
                alt="A close-up detail of a cliffside castle in warm afternoon light"
                title="Detail pass — the castle"
                meta="11 days ago"
              />
              <SmallPiece
                src="/images/demo/sketch-detail.jpg"
                alt="A pencil sketch detail of the same castle"
                title="World-building sketches"
                meta="13 days ago"
                locked
              />
            </div>
          </div>
        </div>

        <Sidebar subscribedPrice={subscribedPrice} onJoin={() => onJoin(UNLOCK_TIER)} />
      </div>
    </div>
  );
}

function ProfileHeader() {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-ink/15 bg-brand-paper shadow-sm">
      <div className="relative h-32 overflow-hidden bg-brand-paper sm:h-36" aria-hidden="true">
        <div className="absolute -top-24 -left-10 h-64 w-64 rounded-full bg-brand-clay/50 blur-3xl" />
        <div className="absolute -top-20 right-[8%] h-56 w-56 rounded-full bg-brand-gold/45 blur-3xl" />
        <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-brand-teal/40 blur-3xl" />
      </div>
      <div className="-mt-10 px-6 pb-6 sm:px-8">
        <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-brand-paper shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/demo/avatar.jpg" alt={CREATOR.name} className="h-full w-full object-cover" />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-bold text-brand-ink">{CREATOR.name}</h1>
          <span className="text-sm text-brand-ink/50">{CREATOR.handle}</span>
        </div>
        <p className="text-sm font-semibold italic text-brand-teal">{CREATOR.tagline}</p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-ink/70">{CREATOR.bio}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-brand-ink/55">
          <span>
            <strong className="font-display font-bold text-brand-ink">{CREATOR.stats.members}</strong> members
          </span>
          <span className="text-brand-ink/20">·</span>
          <span>
            <strong className="font-display font-bold text-brand-ink">{CREATOR.stats.posts}</strong> posts
          </span>
          <span className="text-brand-ink/20">·</span>
          <span>Posting since {CREATOR.stats.since}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {CREATOR.socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              className="border-b border-brand-ink/15 pb-0.5 text-xs font-bold text-brand-ink/55 transition hover:border-brand-teal hover:text-brand-teal"
            >
              {s.label} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// The public hero -- one large, confident piece of finished work, title set right on
// the art rather than in a caption box underneath. This one lever does more against
// "looks like a pricing page" than anything else on this view.
function HeroPiece() {
  return (
    <div>
      <div className="relative aspect-[16/8.2] overflow-hidden rounded-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/demo/hero-landscape.jpg"
          alt="A painted fantasy vista of a river valley leading to a cliffside castle"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(0deg, rgba(15,26,22,0.78) 0%, rgba(15,26,22,0.15) 46%, transparent 68%)' }}
        />
        <div className="absolute inset-x-0 bottom-0 p-6 text-brand-paper sm:p-8">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-brand-gold">
            Environment painting · Process breakdown
          </span>
          <h2 className="mt-2 max-w-[22ch] font-display text-2xl font-bold leading-tight sm:text-3xl">
            The Long Road Ahead — sketch to final light
          </h2>
          <div className="mt-2.5 text-xs text-brand-paper/60">2 days ago · 9 comments</div>
        </div>
      </div>
      <p className="mt-4 border-l-2 border-brand-gold pl-4 font-display text-[15px] italic leading-relaxed text-brand-ink/70">
        "Watching the light change across three passes taught me more about atmosphere than any tutorial has."
        <span className="mt-1.5 block font-sans text-xs font-bold not-italic text-brand-ink/40">
          — from a member comment
        </span>
      </p>
    </div>
  );
}

// A text-only post -- no image at all. The strongest possible contrast to a grid of
// thumbnails, and it reads as a real update rather than filler.
function FieldNote() {
  return (
    <div className="flex flex-col justify-center rounded-sm bg-brand-paper p-6">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-brand-clay">A note</span>
      <p className="mt-3 text-[19px] leading-snug text-brand-ink font-display">
        Taking next week off to finish a client project — back to the regular Tuesday piece after that. Thank you for
        being patient with me.
      </p>
      <div className="mt-4 text-xs text-brand-ink/40">5 days ago · 3 comments</div>
    </div>
  );
}

function TallPiece() {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/demo/portrait-study.jpg"
        alt="A painterly close-up portrait study of a woman looking off to the side"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: '78% 42%' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(0deg, rgba(15,26,22,0.7) 0%, transparent 55%)' }}
      />
      <div className="absolute inset-x-0 bottom-0 p-5 text-brand-paper">
        <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-brand-gold">Portrait study</span>
        <h3 className="mt-1.5 font-display text-lg font-bold leading-tight">Getting the skin tones right</h3>
        <div className="mt-1.5 text-[11.5px] text-brand-paper/60">8 days ago · 17 comments</div>
      </div>
    </div>
  );
}

// The gated piece -- same large, confident treatment as the public hero, so what's
// behind the paywall reads as the best work on the page, not an afterthought. Before
// unlocking, the art is still visible underneath a partial veil (blurred, darkened at
// center for text contrast) instead of a fully opaque block, so a fan can tell what a
// piece actually is before joining.
function LockedHeroPiece({ unlocked, onUnlock }) {
  return (
    <div className="relative aspect-[16/7.5] overflow-hidden rounded-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/demo/storm-study.jpg"
        alt="A moody storm-sky color study"
        className={`absolute inset-0 h-full w-full object-cover transition ${unlocked ? '' : 'scale-105 blur-[3px]'}`}
      />
      {!unlocked && (
        <>
          <span className="absolute left-4 top-4 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-gold">
            🔒 Behind the Scenes only
          </span>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
            style={{
              background:
                'radial-gradient(ellipse 70% 65% at 50% 55%, rgba(10,20,18,0.72) 0%, rgba(10,20,18,0.38) 55%, rgba(10,20,18,0.12) 85%)',
            }}
          >
            <p className="max-w-[30ch] font-display text-lg font-semibold text-brand-paper sm:text-xl">
              Full color-study breakdown: choosing the storm-cloud palette
            </p>
            <button
              type="button"
              onClick={onUnlock}
              className="rounded-full bg-brand-gold px-5 py-2.5 text-[13.5px] font-bold text-[#2B2420] shadow-sm transition hover:brightness-95"
            >
              Unlock — join "{UNLOCK_TIER.name}" (${UNLOCK_TIER.price}/mo)
            </button>
          </div>
        </>
      )}
      {unlocked && (
        <>
          <span className="absolute right-4 top-4 rounded-full bg-brand-teal px-2.5 py-1 text-[11px] font-bold text-brand-paper">
            ✓ Unlocked
          </span>
          <div
            className="absolute inset-x-0 bottom-0 p-6 text-brand-paper sm:p-8"
            style={{ background: 'linear-gradient(0deg, rgba(15,26,22,0.75) 0%, transparent 60%)' }}
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-brand-gold">
              Environment color study
            </span>
            <h3 className="mt-1.5 max-w-[26ch] font-display text-lg font-bold leading-tight sm:text-xl">
              Choosing the storm-cloud palette — thanks for joining!
            </h3>
          </div>
        </>
      )}
    </div>
  );
}

function SmallPiece({ src, alt, title, meta, locked }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(0deg, rgba(15,26,22,0.65) 0%, transparent 55%)' }}
      />
      {locked && (
        <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-ink/55 text-[11px]">
          🔒
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-3.5 text-brand-paper">
        <h4 className="font-display text-sm font-bold leading-tight">{title}</h4>
        <div className="mt-1 text-[10.5px] text-brand-paper/60">{meta}</div>
      </div>
    </div>
  );
}

// Tiers demoted to a minimal, typographic list -- hairline-divided rows, not bordered
// cards -- so the sidebar reads as page furniture rather than the main event. One CTA
// at the bottom joins the tier that unlocks the gated piece above.
function Sidebar({ subscribedPrice, onJoin }) {
  const joined = subscribedPrice >= UNLOCK_TIER.price;
  return (
    <div className="lg:sticky lg:top-7 lg:self-start">
      <h3 className="font-display text-lg font-bold text-brand-ink">Support {CREATOR.name.split(' ')[0]}</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-brand-ink/55">Every tier includes everything below it.</p>

      <div className="mt-2">
        {TIERS.map((tier, i) => (
          <div
            key={tier.id}
            className={`py-4 border-t border-brand-ink/15 ${i === TIERS.length - 1 ? 'border-b' : ''}`}
          >
            {tier.popular && (
              <span className="mb-1.5 inline-block text-[9.5px] font-extrabold uppercase tracking-wide text-brand-clay">
                Most popular
              </span>
            )}
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-[15px] font-bold text-brand-ink">{tier.name}</span>
              <span className="text-sm font-bold tabular-nums text-brand-teal">${tier.price}/mo</span>
            </div>
            <p className="mt-1.5 max-w-[30ch] text-xs leading-relaxed text-brand-ink/55">{tier.perks[0]}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onJoin}
        disabled={joined}
        className={`mt-5 w-full rounded-full px-4 py-3 text-sm font-bold shadow-sm transition ${
          joined ? 'cursor-default bg-brand-teal/10 text-brand-teal' : 'bg-brand-teal text-brand-paper hover:bg-[#0f4d45]'
        }`}
      >
        {joined ? '✓ You\'re a member' : `Join ${UNLOCK_TIER.name} →`}
      </button>
      <p className="mt-2.5 text-center text-[11.5px] text-brand-ink/40">$0 to browse — join anytime</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Creator's-eye view
// ---------------------------------------------------------------------------

// A segmented pill control instead of a single banner-style button -- reads as a real
// product toggle (same convention as the fee-tier switch on the earnings calculator)
// rather than a marketing callout, and it's self-explanatory enough that the copy
// underneath only needs to add the one thing the toggle itself can't say.
function ViewToggle({ open, onChange }) {
  return (
    <div className="border-b border-brand-ink/10 bg-brand-paper px-6 py-4">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex gap-1 rounded-full border border-brand-ink/15 bg-brand-cream p-1 text-sm font-bold">
          <ViewToggleButton active={!open} onClick={() => onChange(false)}>
            <EyeIcon /> Fan view
          </ViewToggleButton>
          <ViewToggleButton active={open} onClick={() => onChange(true)}>
            <DashboardIcon /> Creator view
          </ViewToggleButton>
        </div>
        <p className="mt-2.5 text-xs text-brand-ink/50">
          {open
            ? 'The creator-only view — your live page below, plus real-time earnings.'
            : 'Exactly what a fan sees when they visit your page.'}
        </p>
      </div>
    </div>
  );
}

function ViewToggleButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 transition ${
        active ? 'bg-brand-teal text-brand-paper shadow-sm' : 'text-brand-ink/65 hover:text-brand-ink/80'
      }`}
    >
      {children}
    </button>
  );
}

function CreatorDashboardPanel() {
  const gross = 840;
  // Real fee logic, not a demo-only stand-in -- same constant the earnings calculator
  // and every other fee mention on the site pulls from.
  const fee = gross * (STANDARD_FEE_PERCENT / 100);
  const payout = gross - fee;

  return (
    <div className="border-b border-brand-ink/10 bg-[#F5E9D8] px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <div
          className="h-1.5 w-[52px] rounded-full"
          style={{
            background: 'repeating-linear-gradient(115deg, #C97C5D 0 8px, #C9A961 8px 16px, #146359 16px 24px)',
          }}
          aria-hidden="true"
        />
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-ink/50">Live revenue tracker</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-display text-4xl font-bold tabular-nums text-brand-teal">
              ${gross.toFixed(2)}
            </p>
            <p className="text-sm text-brand-ink/60">Earned this month</p>
          </div>
          <div className="rounded-xl border border-brand-ink/15 bg-brand-paper px-5 py-3 text-sm">
            <div className="flex justify-between gap-8 tabular-nums">
              <span className="text-brand-ink/60">ByUs fee ({STANDARD_FEE_PERCENT}%)</span>
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
// Icons -- small inline marks only now (24x24/stroke-1.8). The post thumbnails
// above are real imagery, not icons standing in for it.
// ---------------------------------------------------------------------------

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 19v-6" strokeLinecap="round" />
      <path d="M12 19V9" strokeLinecap="round" />
      <path d="M19 19V5" strokeLinecap="round" />
      <path d="M3 19h18" strokeLinecap="round" />
    </svg>
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
