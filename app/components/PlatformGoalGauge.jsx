'use client';

import { useEffect, useState } from 'react';
import { formatCompactUSD } from '@/lib/format';

// Public growth gauge for the homepage: tracks ByUs's own lifetime fee income (not
// creators' gross revenue -- what the platform itself has actually earned) against 4
// milestones. Crossing one permanently lowers EVERY creator's effective fee, for good --
// see lib/fees.js. Self-fetching and public (no session needed), same pattern as the
// other dashboard cards, just reading from /api/platform/milestones instead.
//
// A meter, per the dataviz skill's figure contract: the fill carries state, the unfilled
// track is a lighter step of the same hue so progress reads across the whole bar. Ticks
// at each milestone double as the "meter" and the story -- unlike a plain progress bar,
// each checkpoint is a real, named event (a fee cut for every creator), so it gets its
// own marker and label rather than being folded into a single continuous fill.
const TEAL = '#146359';
const TRACK = 'rgba(20,99,89,0.12)'; // a lighter step of the same teal, not a flat gray
const GOLD = '#C9A961';

export default function PlatformGoalGauge() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/platform/milestones')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error || !data) return null;

  const { platformFeeIncomeCents, milestones } = data;
  if (milestones.length === 0) return null;

  const maxThreshold = milestones[milestones.length - 1].thresholdCents;
  const crossedCount = milestones.filter((m) => m.crossedAt).length;
  const totalReductionPoints = milestones.reduce((sum, m) => sum + (m.crossedAt ? m.reductionPoints : 0), 0);
  const nextMilestone = milestones.find((m) => !m.crossedAt);
  const allCrossed = !nextMilestone;

  const progressPct = Math.min(100, (platformFeeIncomeCents / maxThreshold) * 100);

  // SVG geometry -- a single horizontal track with a tick + label per milestone,
  // positioned proportionally to its dollar threshold along the track.
  const width = 640;
  const trackY = 44;
  const trackHeight = 10;
  const padX = 12;
  const trackWidth = width - padX * 2;

  function xFor(cents) {
    return padX + (cents / maxThreshold) * trackWidth;
  }

  function formatMilestoneLabel(cents) {
    const dollars = cents / 100;
    if (dollars >= 1_000_000) return `$${Math.round(dollars / 1_000_000)}M`;
    if (dollars >= 1000) return `$${Math.round(dollars / 1000)}K`;
    return `$${dollars}`;
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-4">
      <div className="rounded-3xl border border-black/5 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#C9A961]/15 px-3 py-1 text-xs font-semibold tracking-wide text-[#8a6b2f]">
              ByUs growth goal
            </span>
            <h2 className="mt-3 font-display text-2xl font-semibold text-[#1A1A1A] sm:text-3xl">
              {allCrossed
                ? "We've hit every milestone — thank you."
                : 'Every milestone permanently lowers every creator’s fee'}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-black/55">
              {allCrossed
                ? `ByUs's own lifetime revenue has crossed all ${milestones.length} milestones — every creator's fee is now ${totalReductionPoints} points lower than it started, for good.`
                : "As ByUs's own lifetime revenue crosses each milestone below, every creator's platform fee drops another point — permanently, for every creator, on top of their own personal discount."}
            </p>
          </div>
          {totalReductionPoints > 0 && (
            <div className="shrink-0 rounded-2xl bg-[#146359]/10 px-4 py-3 text-center">
              <div className="font-display text-2xl font-semibold text-[#146359]">-{totalReductionPoints}pt</div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[#146359]/70">
                off every fee so far
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} 92`}
            width="100%"
            style={{ minWidth: 480 }}
            role="img"
            aria-label={`ByUs has earned ${formatCompactUSD(platformFeeIncomeCents)} lifetime, toward ${milestones.length} growth milestones`}
          >
            {/* Track */}
            <rect x={padX} y={trackY} width={trackWidth} height={trackHeight} rx={trackHeight / 2} fill={TRACK} />
            {/* Fill */}
            <rect
              x={padX}
              y={trackY}
              width={Math.max(trackHeight, (progressPct / 100) * trackWidth)}
              height={trackHeight}
              rx={trackHeight / 2}
              fill={TEAL}
            />

            {milestones.map((m) => {
              const x = xFor(m.thresholdCents);
              const crossed = Boolean(m.crossedAt);
              return (
                <g key={m.thresholdCents}>
                  {/* Surface ring around each checkpoint so it stays legible against the fill */}
                  <circle cx={x} cy={trackY + trackHeight / 2} r={9} fill="#fff" />
                  <circle
                    cx={x}
                    cy={trackY + trackHeight / 2}
                    r={7}
                    fill={crossed ? GOLD : '#fff'}
                    stroke={crossed ? GOLD : TRACK}
                    strokeWidth="2"
                  />
                  {crossed && (
                    <path
                      d={`M${x - 3},${trackY + trackHeight / 2} l2,2.5 l4,-5`}
                      stroke="#fff"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )}
                  <text
                    x={x}
                    y={trackY + trackHeight + 24}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight={crossed ? '600' : '500'}
                    fill={crossed ? '#1A1A1A' : '#898781'}
                  >
                    {formatMilestoneLabel(m.thresholdCents)}
                  </text>
                  <text
                    x={x}
                    y={trackY + trackHeight + 40}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#898781"
                  >
                    -{m.reductionPoints}pt
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="mt-2 text-sm text-black/55">
          {allCrossed ? (
            <>ByUs has earned {formatCompactUSD(platformFeeIncomeCents)} lifetime.</>
          ) : (
            <>
              {formatCompactUSD(platformFeeIncomeCents)} raised so far — {formatCompactUSD(
                nextMilestone.thresholdCents - platformFeeIncomeCents
              )}{' '}
              to go until the next milestone drops every creator's fee another point.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
