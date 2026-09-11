'use client';

import { useEffect, useRef, useState } from 'react';
import { STANDARD_FEE_PERCENT, DISCOUNTED_FEE_PERCENT } from '@/lib/pricing';

// Interactive "what would I actually keep" calculator for a prospective creator sizing
// up whether ByUs is worth it before they sign up. Fee numbers now come straight from
// lib/pricing.js -- that file was split out specifically so anything that only cares
// about these numbers (this component included) never has to depend on the payments
// layer that holds the actual Stripe secret key. No more hand-duplicated constants to
// keep in sync.
const COMPETITOR_FEE_PERCENT = 12; // Comparison-only figure, not a ByUs business rule.

function fmt(cents) {
  const dollars = cents / 100;
  const sign = dollars < 0 ? '-' : '';
  return `${sign}$${Math.abs(dollars).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Numbers tween instead of snapping when a slider moves -- motion tied to a real change
// in the math, not decoration. Skipped for prefers-reduced-motion and on first mount
// (nothing to tween from yet).
function useTweenedCents(targetCents) {
  const [display, setDisplay] = useState(targetCents);
  const prevRef = useRef(targetCents);
  const frameRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current;
    const prefersMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

    if (!prefersMotion || from === targetCents) {
      setDisplay(targetCents);
      prevRef.current = targetCents;
      return;
    }

    const duration = 260;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (targetCents - from) * eased));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = targetCents;
      }
    }
    frameRef.current = requestAnimationFrame(step);
    return () => frameRef.current && cancelAnimationFrame(frameRef.current);
  }, [targetCents]);

  return display;
}

// Fades the card in once it's actually scrolled into view rather than on page load --
// motion that rewards scrolling instead of an ambient loop. Skipped for
// prefers-reduced-motion, where the card is simply visible from the start.
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prefersMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    if (!prefersMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [ref, visible];
}

export default function EarningsCalculator() {
  const [subscribers, setSubscribers] = useState(50);
  const [price, setPrice] = useState(8);
  const [tier, setTier] = useState('starter'); // 'starter' | 'grown'
  const [revealRef, revealed] = useReveal();

  const feePercent = tier === 'grown' ? DISCOUNTED_FEE_PERCENT : STANDARD_FEE_PERCENT;
  const grossCents = Math.round(subscribers * price * 100);
  const feeCents = Math.round((grossCents * feePercent) / 100);
  const netCents = grossCents - feeCents;

  const competitorFeeCents = Math.round((grossCents * COMPETITOR_FEE_PERCENT) / 100);
  const competitorNetCents = grossCents - competitorFeeCents;
  const extraKeptCents = netCents - competitorNetCents;

  const grossDisplay = useTweenedCents(grossCents);
  const feeDisplay = useTweenedCents(-feeCents);
  const netDisplay = useTweenedCents(netCents);
  const competitorNetDisplay = useTweenedCents(competitorNetCents);
  const extraKeptDisplay = useTweenedCents(extraKeptCents);

  return (
    <section className="mx-auto max-w-4xl px-6 py-4">
      <div
        ref={revealRef}
        className={`rounded-[28px] border border-brand-ink/15 bg-brand-paper p-6 shadow-[0_34px_60px_-38px_rgba(43,36,32,0.28)] transition-all duration-500 ease-out sm:p-10 ${
          revealed ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-[#2B2420] px-3.5 py-1.5 text-xs font-bold tracking-wide text-brand-cream">
          Earnings calculator
        </span>

        {/* Candy-stripe accent bar instead of a badge or icon -- a small, self-contained
            bit of color that ties back to the three brand hues without needing a photo
            or an emoji to do it. */}
        <div
          className="mt-4 h-1.5 w-[52px] rounded-full"
          style={{
            background: 'repeating-linear-gradient(115deg, #C97C5D 0 8px, #C9A961 8px 16px, #146359 16px 24px)',
          }}
          aria-hidden="true"
        />

        <h2 className="mt-3.5 font-display text-2xl font-bold leading-tight text-[#2B2420] sm:text-3xl">
          See what you&rsquo;d actually keep
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-ink/70">
          Move the sliders to your numbers — this runs the same fee math ByUs applies to
          every charge, not a rough estimate.
        </p>

        <div className="mt-8 grid gap-8 sm:grid-cols-[0.95fr_1.05fr] sm:gap-10">
          {/* Inputs */}
          <div>
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
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink/60">
                Your fee tier
              </p>
              <div className="flex gap-1 rounded-full border border-brand-ink/15 bg-brand-cream p-1 text-xs font-bold">
                <TierButton active={tier === 'starter'} onClick={() => setTier('starter')}>
                  Just starting — {STANDARD_FEE_PERCENT}%
                </TierButton>
                <TierButton active={tier === 'grown'} onClick={() => setTier('grown')}>
                  $2k+ this month — {DISCOUNTED_FEE_PERCENT}%
                </TierButton>
              </div>
            </div>
          </div>

          {/* Outcome -- a solid teal card carries the hero number instead of a bordered
              output list, so "what you keep" reads as the answer rather than one more
              line item next to the fee. The flat-competitor comparison is demoted to a
              single quiet strip below it, and the takeaway gets its own gold banner --
              always visible now rather than sitting behind a checkbox, since it's the
              platform's actual value proposition. */}
          <div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-teal to-[#0e4a42] p-5 text-brand-paper shadow-[0_22px_44px_-22px_rgba(14,74,66,0.6)] after:absolute after:-right-9 after:-top-12 after:h-[180px] after:w-[180px] after:rounded-full after:bg-[radial-gradient(circle,rgba(201,169,97,0.26),transparent_70%)] after:content-['']">
              <span className="relative text-[11px] font-bold uppercase tracking-wide text-brand-gold">
                With ByUs
              </span>
              <div className="relative mt-3 flex items-baseline justify-between gap-2.5 text-[13px] text-brand-paper/70">
                <span>Monthly gross revenue</span>
                <span className="tabular-nums font-medium text-brand-paper/85">{fmt(grossDisplay)}</span>
              </div>
              <div className="relative mt-2 flex items-baseline justify-between gap-2.5 text-[13px] text-brand-paper/70">
                <span>Platform fee ({feePercent}%)</span>
                <span className="tabular-nums font-medium text-brand-paper/85">{fmt(feeDisplay)}</span>
              </div>
              <div className="relative mt-3.5 border-t border-brand-paper/20 pt-3">
                <span className="text-[13px] font-bold text-brand-paper/90">You keep, every month</span>
                <span className="mt-1 block font-display text-4xl font-black leading-tight tabular-nums text-brand-paper">
                  {fmt(netDisplay)}
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2.5 rounded-xl border border-brand-ink/15 bg-brand-cream px-4 py-3 text-[12.5px]">
              <span className="text-brand-ink/70">
                Typical flat platform ({COMPETITOR_FEE_PERCENT}%) would leave you
              </span>
              <span className="tabular-nums font-bold text-brand-ink/70">{fmt(competitorNetDisplay)}</span>
            </div>

            <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-brand-gold/50 bg-gradient-to-r from-brand-gold/15 to-brand-gold/5 px-4 py-3.5">
              <span
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-gold text-sm font-bold text-brand-paper"
                aria-hidden="true"
              >
                ↑
              </span>
              <p className="text-[13.5px] leading-snug text-[#6b5325]">
                You&rsquo;d keep{' '}
                <strong className="font-display text-[15px] text-[#5a4419]">{fmt(extraKeptDisplay)}</strong> more
                per month with ByUs.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-7 text-xs text-brand-ink/55">
          Estimate only — assumes every subscriber renews and doesn&rsquo;t account for the
          rare failed or refunded charge. Real payouts land in your own Stripe account on
          Stripe&rsquo;s standard schedule.
        </p>
      </div>
    </section>
  );
}

function SliderField({ label, value, min, max, step, onChange, display }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-2.5 flex items-baseline justify-between">
        <label className="text-[11px] font-bold uppercase tracking-wide text-brand-ink/60">{label}</label>
        <span className="font-display text-lg font-bold tabular-nums text-[#2B2420]">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, #C97C5D 0%, #C9A961 ${pct}%, rgba(43,36,32,0.08) ${pct}%, rgba(43,36,32,0.08) 100%)`,
        }}
        className="h-[9px] w-full cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:h-[23px] [&::-moz-range-thumb]:w-[23px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-brand-clay [&::-moz-range-thumb]:bg-brand-paper [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(43,36,32,0.3)] [&::-webkit-slider-thumb]:h-[23px] [&::-webkit-slider-thumb]:w-[23px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-brand-clay [&::-webkit-slider-thumb]:bg-brand-paper [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(43,36,32,0.3)] [&::-webkit-slider-thumb]:transition active:[&::-webkit-slider-thumb]:scale-125"
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
      className={`flex-1 rounded-full px-2 py-2 transition ${
        active
          ? 'bg-brand-teal text-brand-paper shadow-[0_4px_10px_-4px_rgba(20,99,89,0.5)]'
          : 'text-brand-ink/70 hover:text-brand-ink/85'
      }`}
    >
      {children}
    </button>
  );
}
