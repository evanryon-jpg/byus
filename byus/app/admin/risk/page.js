'use client';

// Checkout risk review: every medium/high-scoring checkout attempt from the last 30
// days, with the exact signals that produced the score. The score itself is advisory
// (see lib/risk-score.js) -- this page exists so a pattern (one throwaway-email
// account hammering tips, a fan with a prior dispute coming back) is visible in one
// place instead of only after Stripe opens a dispute. Same data-fetch shape as
// app/admin/disputes/page.js.

import { useEffect, useState } from 'react';
import { formatUSD } from '@/lib/format';

export default function AdminRiskPage() {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/admin/risk')
      .then((res) => {
        if (res.status === 403) {
          setStatus('forbidden');
          return null;
        }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json) => {
        if (!json) return;
        setData(json);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return <div className="p-12 text-center text-brand-ink/60">Loading risk events…</div>;
  }
  if (status === 'forbidden') {
    return <div className="p-12 text-center text-brand-ink/60">Not authorized.</div>;
  }
  if (status === 'error') {
    return <div className="p-12 text-center text-brand-ink/60">Could not load risk events.</div>;
  }

  const { events, last24h, last7d } = data;
  const high = events.filter((e) => e.level === 'high');
  const medium = events.filter((e) => e.level === 'medium');

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#0F766E]">Payments & risk</p>
          <h1 className="mt-1 text-2xl font-bold text-[#172033]">Checkout risk review</h1>
          <p className="mt-1 text-sm text-brand-ink/65">
            Every checkout is scored on account signals Stripe can't see before it's handed to Stripe.
            Scores are advisory — nothing here was blocked. Act through the usual tools if a pattern looks wrong.
          </p>
        </div>
        <a href="/admin" className="text-sm font-semibold text-[#0F766E] hover:underline">
          ← Platform overview
        </a>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Checkouts, 24h" value={last24h.total} />
        <SummaryCard label="High risk, 24h" value={last24h.high} flag={last24h.high > 0} />
        <SummaryCard label="High risk, 7d" value={last7d.high} flag={last7d.high > 0} />
        <SummaryCard label="Medium risk, 7d" value={last7d.medium} warn={last7d.medium > 0} />
      </div>

      <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold text-[#172033]">High risk (score 60+)</h2>
        <p className="mt-1 text-sm text-brand-ink/65">
          Worth a look: check the account on the platform overview and the payment in Stripe (the score is on the payment's metadata too).
        </p>
        <div className="mt-4 space-y-3">
          {high.map((e) => <RiskCard key={e.id} event={e} />)}
          {high.length === 0 && (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">No high-risk checkouts in the last 30 days.</p>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold text-[#172033]">Medium risk (score 30–59)</h2>
        <p className="mt-1 text-sm text-brand-ink/65">
          Usually just a brand-new fan buying quickly. Only worth attention if the same account keeps showing up.
        </p>
        <div className="mt-4 space-y-3">
          {medium.map((e) => <RiskCard key={e.id} event={e} compact />)}
          {medium.length === 0 && (
            <p className="text-sm text-brand-ink/60">None in the last 30 days.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, flag = false, warn = false }) {
  const cls = flag
    ? 'border-red-200 bg-red-50'
    : warn
      ? 'border-amber-200 bg-amber-50'
      : 'border-brand-ink/5 bg-brand-paper';
  const text = flag ? 'text-red-700' : warn ? 'text-amber-800' : 'text-[#172033]';
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-ink/60">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${text}`}>{value}</p>
    </div>
  );
}

const KIND_LABELS = { subscription: 'Subscription', tip: 'Tip', product: 'Download' };

function RiskCard({ event, compact = false }) {
  const isHigh = event.level === 'high';
  return (
    <div className={`rounded-xl border p-4 ${isHigh ? 'border-red-200 bg-red-50/40' : 'border-brand-ink/5 bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${isHigh ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
              Score {event.score}
            </span>
            <span className="font-semibold text-[#172033]">{KIND_LABELS[event.kind] || event.kind}</span>
            <span className="text-sm text-brand-ink/70">{formatUSD(event.amountCents)}</span>
          </div>
          <p className="mt-1 text-sm text-brand-ink/70">
            {event.fanName || 'Unnamed fan'} · {event.fanEmail}
            {event.creatorName ? ` → ${event.creatorName}` : ''}
          </p>
          <p className="mt-1 text-xs text-brand-ink/60">
            {formatDateTime(event.createdAt)} · IP {event.ipAddress || 'unknown'} · account created {formatDate(event.fanCreatedAt)}
          </p>
        </div>
      </div>
      {!compact && event.signals.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-brand-ink/5 pt-3 text-sm">
          {event.signals.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-brand-ink/70">+{s.points}</span>
              <span className="text-brand-ink/80">{s.detail}</span>
            </li>
          ))}
        </ul>
      )}
      {compact && event.signals.length > 0 && (
        <p className="mt-2 text-xs text-brand-ink/60">
          {event.signals.map((s) => s.detail).join(' · ')}
        </p>
      )}
    </div>
  );
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
