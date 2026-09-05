'use client';

import { useState } from 'react';

// Interactive "what would I actually keep" calculator for a prospective creator sizing
// up whether ByUs is worth it before they sign up. Fee numbers below are marketing-safe
// duplicates of STANDARD_FEE_PERCENT / DISCOUNTED_FEE_PERCENT / FEE_DISCOUNT_THRESHOLD_CENTS
// in lib/stripe.js -- that file also holds the Stripe secret key, so it can't be imported
// into a client component. Keep both in sync if the real rates ever change (same
// duplication already exists in FAQSection.jsx and page.js's own stat band copy).
const STARTER_FEE_PERCENT = 10;
const GROWN_FEE_PERCENT = 7;
const COMPETITOR_FEE_PERCENT = 12;

export default function EarningsCalculator() {
  const [subscribers, setSubscribers] = useState(50);
  const [price, setPrice] = useState(8);
  const [tier, setTier] = useState('starter'); // 'starter' | 'grown'
  // Defaults to visible now -- this comparison is the platform's actual value
  // proposition (you keep more than a flat 12% competitor takes) and was easy to
  // miss tucked behind an unchecked box.
  const [showComparison, setShowComparison] = useState(true);

  const feePercent = tier === 'grown' ? GROWN_FEE_PERCENT : STARTER_FEE_PERCENT;
  const grossCents = Math.round(subscribers * price * 100);
  const feeCents = Math.round((grossCents * feePercent) / 100);
  const netCents = grossCents - feeCents;

  const competitorFeeCents = Math.round((grossCents * COMPETITOR_FEE_PERCENT) / 100);
  const competitorNetCents = grossCents - competitorFeeCents;
  const extraKeptCents = netCents - competitorNetCents;

  return (
    <section className="mx-auto max-w-4xl px-6 py-4">
      <div className="rounded-3xl border border-brand-ink/20 bg-brand-paper p-6 sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-md bg-brand-teal/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-teal">
          Earnings calculator
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold text-[#2B2420] sm:text-3xl">
          See what you&rsquo;d actually keep
        </h2>
        <p className="mt-2 max-w-xl text-sm text-brand-ink/68">
          Move the sliders to your numbers — this runs the same fee math ByUs applies to
          every charge, not a rough estimate.
        </p>

        {/* Dashboard-style split: inputs on the left, the payout outcome as its own
            bordered card on the right with the hero number given real size. */}
        <div className="mt-8 grid gap-10 sm:grid-cols-2">
          {/* Inputs */}
          <div className="space-y-6">
            <SliderField
              label="Subscribers"
              value={subscribers}
              min={0}
              max={500}
              step={1}
              onChange={setSubscribers}
              display={subscribers.toLocaleString()}
            />
            <SliderField
              label="Monthly tier price"
              value={price}
              min={1}
              max={50}
              step={0.5}
              onChange={setPrice}
              display={`$${price.toFixed(2)}`}
            />

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-ink/60">Your fee tier</p>
              <div className="mt-2 flex items-center gap-1 rounded-full border border-brand-ink/15 bg-[#F5E9D8] p-1 text-xs font-medium">
                <TierButton active={tier === 'starter'} onClick={() => setTier('starter')}>
                  Just starting — {STARTER_FEE_PERCENT}%
                </TierButton>
                <TierButton active={tier === 'grown'} onClick={() => setTier('grown')}>
                  $2k+ this month — {GROWN_FEE_PERCENT}%
                </TierButton>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-brand-ink/72">
              <input
                type="checkbox"
                checked={showComparison}
                onChange={(e) => setShowComparison(e.target.checked)}
                className="h-4 w-4 rounded border-brand-ink/20 text-brand-teal focus:ring-brand-teal/40"
              />
              Compare to a flat {COMPETITOR_FEE_PERCENT}% competitor fee
            </label>
          </div>

          {/* Outputs */}
          <div className="space-y-3 rounded-2xl border border-brand-ink/20 bg-[#F5E9D8] p-5 sm:p-6">
            <OutputRow label="Monthly gross revenue" value={grossCents} />
            <OutputRow label={`ByUs platform fee (${feePercent}%)`} value={-feeCents} muted />
            <div className="my-1 h-px bg-brand-ink/15" />
            <OutputRow label="You keep, every month" value={netCents} hero />

            {showComparison && (
              <div className="mt-4 rounded-xl border border-dashed border-brand-gold bg-brand-gold/10 p-4">
                <p className="text-sm text-[#8a6b2f]">
                  A flat {COMPETITOR_FEE_PERCENT}% competitor would take{' '}
                  <strong className="tabular-nums">{fmt(competitorFeeCents)}</strong>, leaving you{' '}
                  <span className="tabular-nums">{fmt(competitorNetCents)}</span>.
                </p>
                <p className="mt-1 text-sm font-semibold text-[#8a6b2f]">
                  You keep <span className="tabular-nums">{fmt(extraKeptCents)}</span> more per month with ByUs.
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-xs text-brand-ink/55">
          Estimate only — assumes every subscriber renews and doesn&rsquo;t account for the
          rare failed or refunded charge. Real payouts land in your own Stripe account on
          Stripe&rsquo;s standard schedule.
        </p>
      </div>
    </section>
  );
}

function fmt(cents) {
  const dollars = cents / 100;
  const sign = dollars < 0 ? '-' : '';
  return `${sign}$${Math.abs(dollars).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SliderField({ label, value, min, max, step, onChange, display }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium uppercase tracking-wide text-brand-ink/60">{label}</label>
        <span className="font-display text-lg font-semibold tabular-nums text-[#2B2420]">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-brand-teal"
      />
    </div>
  );
}

function TierButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-full px-3 py-1.5 transition ${
        active ? 'bg-brand-paper text-brand-teal shadow-sm' : 'text-brand-ink/65 hover:text-brand-ink/80'
      }`}
    >
      {children}
    </button>
  );
}

function OutputRow({ label, value, hero, muted }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${hero ? 'pt-2' : ''}`}>
      <span className={`text-sm ${hero ? 'font-bold text-[#2B2420]' : 'text-brand-ink/68'}`}>{label}</span>
      <span
        className={
          hero
            ? 'font-display text-3xl font-extrabold tabular-nums text-brand-teal sm:text-4xl'
            : muted
            ? 'text-sm tabular-nums text-brand-ink/62'
            : 'text-sm font-medium tabular-nums text-[#2B2420]'
        }
      >
        {fmt(value)}
      </span>
    </div>
  );
}
