'use client';

import { useEffect, useRef, useState } from 'react';
import {
  STANDARD_FEE_PERCENT,
  DISCOUNTED_FEE_PERCENT,
  FEE_DISCOUNT_THRESHOLD_CENTS,
  BIG_CREATOR_FEE_PERCENT,
  BIG_CREATOR_THRESHOLD_CENTS,
  FOUNDING_CREATOR_LIMIT,
  MIN_MEMBERSHIP_PRICE_CENTS,
} from '@/lib/pricing';

// Interactive "what would I actually keep" calculator for a prospective creator sizing
// up whether ByUs is worth it before they sign up. Fee numbers now come straight from
// lib/pricing.js -- that file was split out specifically so anything that only cares
// about these numbers (this component included) never has to depend on the payments
// layer that holds the actual Stripe secret key. No more hand-duplicated constants to
// keep in sync.
// "What do you pay now?" starts at the typical all-in cost on the big membership
// platforms (checked Sept 2026): a 10% platform fee plus card processing of 2.9% + 30c
// per payment. The 30c makes the real percentage depend on the price, so until the
// creator moves the slider it follows the price (about 14.4% at $20, 16.7% at $8).
// Once they set their own number, that number is used as their all-in rate.
const TYPICAL_PLATFORM_FEE_PERCENT = 10;
const MAX_CURRENT_FEE_PERCENT = 30;

function typicalAllInPercent(priceDollars) {
  const fixedPercent = priceDollars > 0 ? ESTIMATED_PROCESSING_FIXED_CENTS / priceDollars : 0;
  return TYPICAL_PLATFORM_FEE_PERCENT + ESTIMATED_PROCESSING_PERCENT + fixedPercent;
}

function pct(n) {
  const r = Math.round(n * 10) / 10;
  return `${r % 1 === 0 ? r : r.toFixed(1)}%`;
}
const ESTIMATED_PROCESSING_PERCENT = 2.9;
const ESTIMATED_PROCESSING_FIXED_CENTS = 30;

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

export default function EarningsCalculator({ foundingSpotsLeft = 0 }) {
  // Opens on the founding rate while founding spots are still open, since that's the
  // offer a creator signing up today can actually get; once every spot is reserved it
  // opens on standard pricing instead, so the first number anyone sees is always one
  // they can still get. 300 members at $20/mo is the opening example.
  const [subscribers, setSubscribers] = useState(300);
  const [price, setPrice] = useState(20);
  const [tier, setTier] = useState(foundingSpotsLeft > 0 ? 'founding' : 'standard'); // 'standard' | 'founding'
  const [customFee, setCustomFee] = useState(null); // null = follow the typical all-in rate
  const [revealRef, revealed] = useReveal();

  const grossCents = Math.round(subscribers * price * 100);
  // Monthly fee bands, same order the real billing uses (lib/fees.js): standard is 13%
  // up to $2K, 10% up to $10K, 9% after; founding is 10% up to $10K, 9% after.
  const bands = tier === 'founding'
    ? [[BIG_CREATOR_THRESHOLD_CENTS, DISCOUNTED_FEE_PERCENT], [Infinity, BIG_CREATOR_FEE_PERCENT]]
    : [
        [FEE_DISCOUNT_THRESHOLD_CENTS, STANDARD_FEE_PERCENT],
        [BIG_CREATOR_THRESHOLD_CENTS, DISCOUNTED_FEE_PERCENT],
        [Infinity, BIG_CREATOR_FEE_PERCENT],
      ];
  let feeExact = 0;
  let bandStart = 0;
  const ratesUsed = [];
  for (const [bandEnd, percent] of bands) {
    const inBand = Math.max(0, Math.min(grossCents, bandEnd) - bandStart);
    if (inBand > 0 || ratesUsed.length === 0) ratesUsed.push(percent);
    feeExact += (inBand * percent) / 100;
    bandStart = bandEnd;
  }
  const feeLabel = ratesUsed.map((r) => `${r}%`).join(' → ');
  const feeCents = Math.round(feeExact);

  const ladder = tier === 'founding'
    ? [
        { label: 'Up to $10,000 a month', fromCents: 0, percent: DISCOUNTED_FEE_PERCENT, exampleCents: 600000 },
        { label: 'Over $10,000', fromCents: BIG_CREATOR_THRESHOLD_CENTS, percent: BIG_CREATOR_FEE_PERCENT, exampleCents: 2000000 },
      ]
    : [
        { label: 'First $2,000 a month', fromCents: 0, percent: STANDARD_FEE_PERCENT, exampleCents: 150000 },
        { label: '$2,000 to $10,000', fromCents: FEE_DISCOUNT_THRESHOLD_CENTS, percent: DISCOUNTED_FEE_PERCENT, exampleCents: 600000 },
        { label: 'Over $10,000', fromCents: BIG_CREATOR_THRESHOLD_CENTS, percent: BIG_CREATOR_FEE_PERCENT, exampleCents: 2000000 },
      ];
  const currentRung = ladder.reduce((acc, row, i) => (i === 0 || grossCents > row.fromCents ? i : acc), 0);
  const netCents = grossCents - feeCents;

  const typicalFee = typicalAllInPercent(price);
  const currentFee = customFee ?? typicalFee;
  const competitorFeeCents = Math.round((grossCents * currentFee) / 100);
  const competitorNetCents = grossCents - competitorFeeCents;
  const extraKeptCents = netCents - competitorNetCents;

  const grossDisplay = useTweenedCents(grossCents);
  const feeDisplay = useTweenedCents(-feeCents);
  const netDisplay = useTweenedCents(netCents);
  const competitorNetDisplay = useTweenedCents(competitorNetCents);
  const extraKeptDisplay = useTweenedCents(extraKeptCents);

  return (
    <section className="mx-auto max-w-4xl px-6 py-2">
      <div
        ref={revealRef}
        className={`rounded-[28px] border border-brand-ink/15 bg-brand-paper p-6 shadow-[0_34px_60px_-38px_rgba(43,36,32,0.28)] transition-all duration-500 ease-out sm:p-10 ${
          revealed ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-[#172033] px-3.5 py-1.5 text-xs font-bold tracking-wide text-brand-cream">
          Earnings calculator
        </span>

        {/* Candy-stripe accent bar instead of a badge or icon -- a small, self-contained
            bit of color that ties back to the three brand hues without needing a photo
            or an emoji to do it. */}
        <div
          className="mt-4 h-1.5 w-[52px] rounded-full"
          style={{
            background: 'repeating-linear-gradient(115deg, #0F766E 0 8px, #0F766E 8px 16px, #0F766E 16px 24px)',
          }}
          aria-hidden="true"
        />

        <h2 className="mt-3.5 font-display text-2xl font-bold leading-tight text-[#172033] sm:text-3xl">
          See what you&rsquo;d actually keep
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-ink/70">
          Estimate your monthly earnings using ByUs’s current rates. Choose standard pricing
          or preview the founding creator rate.
        </p>

        <div className="mt-8 grid gap-8 sm:grid-cols-[0.95fr_1.05fr] sm:gap-10">
          {/* Inputs */}
          <div>
            <SliderField
              label="Subscribers"
              value={subscribers}
              min={0}
              max={150_000}
              step={1}
              scale="log"
              editable
              onChange={setSubscribers}
              display={subscribers.toLocaleString()}
            />
            <SliderField
              label="Monthly tier price"
              value={price}
              min={MIN_MEMBERSHIP_PRICE_CENTS / 100}
              max={50}
              step={0.5}
              onChange={setPrice}
              display={`$${price.toFixed(2)}`}
            />

            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink/60">
                Your fee tier
              </p>
              <div className="grid grid-cols-2 gap-1 rounded-full border border-brand-ink/15 bg-brand-cream p-1 text-xs font-bold">
                <TierButton active={tier === 'standard'} onClick={() => setTier('standard')}>
                  Standard
                </TierButton>
                <TierButton active={tier === 'founding'} onClick={() => setTier('founding')}>
                  Founding creator
                </TierButton>
              </div>
              {/* Rate ladder for the selected tier. Rows the monthly gross reaches are shown
                  in full; the highest one reached is highlighted. Each row is a button: tapping
                  it sets the member count to an example month in that range at the current
                  price ($1,500, $6,000 or $20,000), so the numbers on the right update. */}
              <ol className="mt-3 overflow-hidden rounded-xl border border-brand-ink/10 text-[13px]" aria-label="Fee by monthly earnings">
                {ladder.map((row, i) => {
                  const reached = i === 0 || grossCents > row.fromCents;
                  const current = i === currentRung;
                  return (
                    <li key={row.label} className={i > 0 ? 'border-t border-brand-ink/10' : ''}>
                      <button
                        type="button"
                        aria-current={current ? 'true' : undefined}
                        onClick={() => setSubscribers(Math.min(150000, Math.ceil(row.exampleCents / 100 / price)))}
                        className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors hover:bg-brand-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal ${
                          current ? 'bg-brand-teal/10 font-bold text-[#172033]' : reached ? 'text-brand-ink/75' : 'text-brand-ink/55'
                        }`}
                      >
                        <span>{row.label}</span>
                        <span className="tabular-nums">{row.percent}%</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-xs leading-relaxed text-brand-ink/60">
                {tier === 'founding'
                  ? `For the first ${FOUNDING_CREATOR_LIMIT} US creators, for good. `
                  : ''}
                Rates reset at the start of each month and include card processing. Tap a row to see an example month at that rate.
              </p>
            </div>

            <div className="mt-6 border-t border-brand-ink/10 pt-6">
              <SliderField
                label="What do you pay now? (all-in)"
                value={Math.round(currentFee * 10) / 10}
                min={0}
                max={MAX_CURRENT_FEE_PERCENT}
                step={0.1}
                onChange={setCustomFee}
                display={pct(currentFee)}
              />
              <p className="-mt-3 text-xs leading-relaxed text-brand-ink/75">
                {customFee == null ? (
                  <>
                    Starts at what most membership platforms cost today: a {TYPICAL_PLATFORM_FEE_PERCENT}% platform fee plus
                    card processing of {ESTIMATED_PROCESSING_PERCENT}% + {ESTIMATED_PROCESSING_FIXED_CENTS}&cent; per payment. At{' '}
                    ${price.toFixed(2)} that adds up to about {pct(typicalFee)}. Slide it to what you actually pay.
                  </>
                ) : (
                  <>
                    Your total cost per payment, including card processing.{' '}
                    <button
                      type="button"
                      onClick={() => setCustomFee(null)}
                      className="font-semibold text-brand-teal underline underline-offset-2"
                    >
                      Reset to the typical {pct(typicalFee)}
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Outcome -- a solid teal card carries the hero number instead of a bordered
              output list, so "what you keep" reads as the answer rather than one more
              line item next to the fee. The flat-competitor comparison is demoted to a
              single quiet strip below it, and the takeaway gets its own gold banner --
              always visible now rather than sitting behind a checkbox, since it's the
              platform's actual value proposition. */}
          <div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-teal to-[#0e4a42] p-5 text-brand-paper shadow-[0_22px_44px_-22px_rgba(14,74,66,0.6)] after:absolute after:-right-9 after:-top-12 after:h-[180px] after:w-[180px] after:rounded-full after:bg-[radial-gradient(circle,rgba(248,250,252,0.18),transparent_70%)] after:content-['']">
              <span className="relative text-[11px] font-bold uppercase tracking-wide text-brand-gold">
                With ByUs
              </span>
              <div className="relative mt-3 flex flex-col gap-1 text-[13px] text-brand-paper/70 min-[380px]:flex-row min-[380px]:items-baseline min-[380px]:justify-between min-[380px]:gap-2.5">
                <span>Monthly gross revenue</span>
                <span className="tabular-nums font-medium text-brand-paper/85">{fmt(grossDisplay)}</span>
              </div>
              <div className="relative mt-2 flex flex-col gap-1 text-[13px] text-brand-paper/70 min-[380px]:flex-row min-[380px]:items-baseline min-[380px]:justify-between min-[380px]:gap-2.5">
                <span>Platform fee ({feeLabel})</span>
                <span className="tabular-nums font-medium text-brand-paper/85">{fmt(feeDisplay)}</span>
              </div>
              <div className="relative mt-3.5 border-t border-brand-paper/20 pt-3">
                <span className="text-[13px] font-bold text-brand-paper/90">You keep, every month</span>
                <span className="mt-1 block font-display text-4xl font-black leading-tight tabular-nums text-brand-paper">
                  {fmt(netDisplay)}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-col items-start gap-1.5 rounded-xl border border-brand-ink/15 bg-brand-cream px-4 py-3 text-[12.5px] min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between min-[380px]:gap-2.5">
              <span className="text-brand-ink/70">
                Paying {pct(currentFee)} where you are now would leave you
              </span>
              <span className="self-end tabular-nums font-bold text-brand-ink/70 min-[380px]:self-auto">{fmt(competitorNetDisplay)}</span>
            </div>

            <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-brand-gold/50 bg-gradient-to-r from-brand-gold/15 to-brand-gold/5 px-4 py-3.5">
              <span
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-gold text-sm font-bold text-[#172033]"
                aria-hidden="true"
              >
                {extraKeptCents >= 0 ? '↑' : '↓'}
              </span>
              <p className="text-[13.5px] leading-snug text-[#6b5325]">
                You&rsquo;d keep{' '}
                <strong className="font-display text-[15px] text-[#5a4419]">{fmt(Math.abs(extraKeptDisplay))}</strong> {extraKeptCents >= 0 ? 'more' : 'less'}{' '}
                per month with ByUs.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-7 text-xs text-brand-ink/55">
          Estimate only. Set &ldquo;What do you pay now?&rdquo; to the fee your current platform charges; plans and processing costs differ from place to place. ByUs includes standard domestic payment processing
          in its fee. Other charges may apply for refunds, international payments, currency
          conversion, or optional instant payouts. For standard pricing, the estimate applies 13%
          through $2,000, 10% through $10,000, and 9% after that (founding: 10% through $10,000, then 9%);
          the exact total can vary with payment timing.
        </p>
      </div>
    </section>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  sliderStep = step,
  scale = 'linear',
  editable = false,
  onChange,
  display,
}) {
  const usesLogScale = scale === 'log';
  const sliderMin = usesLogScale ? 0 : min;
  const sliderMax = usesLogScale ? 1000 : max;
  // Rounded before it ever reaches the <input> -- the browser only snaps this to a whole
  // step (step is 1 on the log scale) once the page hydrates, so leaving it as a raw
  // float here means the exact unrounded decimal (e.g. 270.9985698253165) sits in the
  // server-rendered HTML's value="" attribute until then, visible in page source and to
  // anything reading the page before JS runs. Rounding up front matches what the browser
  // was already going to coerce it to, so this changes nothing about behavior or the
  // rendered slider position -- it just never exposes the unrounded number.
  const rawSliderValue = usesLogScale
    ? (Math.log(value + 1) / Math.log(max + 1)) * sliderMax
    : value;
  const sliderValue = usesLogScale ? Math.round(rawSliderValue) : rawSliderValue;
  const pct = ((sliderValue - sliderMin) / (sliderMax - sliderMin)) * 100;

  function handleTypedValue(e) {
    const next = Number(e.target.value);
    if (!Number.isFinite(next)) return;
    onChange(Math.min(max, Math.max(min, next)));
  }

  function handleSliderValue(e) {
    const position = Number(e.target.value);
    const next = usesLogScale
      ? Math.round(Math.pow(max + 1, position / sliderMax) - 1)
      : position;
    onChange(Math.min(max, Math.max(min, next)));
  }

  function adjustValue(direction) {
    onChange(Math.min(max, Math.max(min, value + direction * step)));
  }
  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <label className="text-[11px] font-bold uppercase tracking-wide text-brand-ink/60">{label}</label>
        {editable ? (
          <div className="self-end text-right sm:self-auto">
            <div className="flex items-stretch overflow-hidden rounded-lg border border-brand-ink/15 bg-brand-cream focus-within:border-brand-teal">
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleTypedValue}
                aria-label={`${label} (enter an exact number)`}
                className="w-32 bg-transparent px-3 py-1.5 text-right font-display text-lg font-bold tabular-nums text-[#172033] outline-none sm:w-36"
              />
              <div className="flex w-8 flex-col border-l border-brand-ink/15">
                <button
                  type="button"
                  onClick={() => adjustValue(1)}
                  disabled={value >= max}
                  aria-label={`Increase ${label.toLowerCase()} by ${step}`}
                  className="flex flex-1 items-center justify-center border-b border-brand-ink/15 text-[10px] leading-none text-brand-ink/65 hover:bg-brand-gold/15 hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => adjustValue(-1)}
                  disabled={value <= min}
                  aria-label={`Decrease ${label.toLowerCase()} by ${step}`}
                  className="flex flex-1 items-center justify-center text-[10px] leading-none text-brand-ink/65 hover:bg-brand-gold/15 hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
            </div>
            <span className="mt-1 block text-[10px] font-medium text-brand-ink/50">
              Up to {max.toLocaleString()}
            </span>
          </div>
        ) : (
          <span className="font-display text-lg font-bold tabular-nums text-[#172033]">{display}</span>
        )}
      </div>
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={usesLogScale ? 1 : sliderStep}
        value={sliderValue}
        onChange={handleSliderValue}
        style={{
          background: `linear-gradient(to right, #0F766E 0%, #0F766E ${pct}%, rgba(43,36,32,0.08) ${pct}%, rgba(43,36,32,0.08) 100%)`,
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
      className={`min-w-0 rounded-full px-3 py-2 transition ${
        active
          ? 'bg-brand-teal text-brand-paper shadow-[0_4px_10px_-4px_rgba(20,99,89,0.5)]'
          : 'text-brand-ink/70 hover:text-brand-ink/85'
      }`}
    >
      {children}
    </button>
  );
}
