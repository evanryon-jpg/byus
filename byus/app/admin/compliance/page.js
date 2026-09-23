'use client';

// A live, always-current snapshot of ByUs's enforcement posture — built so the next
// payment-processor compliance question is "here's a live page" instead of a fresh
// email drafted from scratch (see the Sept 2026 Stripe review that prompted this).
// Every number is a plain count over real records (lib/admin-data.js's
// loadComplianceSnapshot), not a self-reported claim.

import { useEffect, useState } from 'react';

export default function AdminCompliancePage() {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/admin/compliance')
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
    return <div className="p-12 text-center text-brand-ink/60">Loading compliance snapshot…</div>;
  }
  if (status === 'forbidden') {
    return <div className="p-12 text-center text-brand-ink/60">Not authorized.</div>;
  }
  if (status === 'error') {
    return <div className="p-12 text-center text-brand-ink/60">Could not load the compliance snapshot.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#0F766E]">Trust & safety</p>
          <h1 className="mt-1 text-2xl font-bold text-[#172033]">Compliance snapshot</h1>
          <p className="mt-1 text-sm text-brand-ink/65">
            Live as of this page load — safe to screenshot or link directly for a processor's compliance review.
          </p>
        </div>
        <a href="/admin" className="text-sm font-semibold text-[#0F766E] hover:underline">
          ← Platform overview
        </a>
      </div>

      <Group title="Moderation enforcement">
        <Tile label="Suspended, last 30 days" value={data.suspensionsLast30d} />
        <Tile label="Suspended, last 90 days" value={data.suspensionsLast90d} />
        <Tile label="Currently suspended" value={data.currentlySuspended} detail={`${data.currentlySuspendedCreators} creator(s)`} />
        <Tile label="Open content reports" value={data.openContentReports} flag={data.openContentReports > 0} />
        <Tile label="Pending video review" value={data.pendingVideoReviews} flag={data.pendingVideoReviews > 0} />
      </Group>

      <Group title="Suspension appeals">
        <Tile label="Open appeals" value={data.openAppeals} flag={data.openAppeals > 0} />
        <Tile label="Resolved appeals" value={data.resolvedAppeals} />
        <Tile
          label="Avg. resolution time"
          value={data.avgAppealResolutionHours != null ? `${Math.round(data.avgAppealResolutionHours)}h` : '—'}
        />
      </Group>

      <Group title="Legal acceptance records">
        <Tile label="Recorded, last 90 days" value={data.legalAcceptancesLast90d} />
        {data.legalAcceptancesBySource.map((row) => (
          <Tile key={row.source} label={formatLabel(row.source)} value={row.n} />
        ))}
      </Group>

      <Group title="Payments">
        <Tile label="Open payment disputes" value={data.openPaymentDisputes} flag={data.openPaymentDisputes > 0} />
      </Group>

      <p className="mt-8 text-xs text-brand-ink/50">
        Demonetization (payout + subscription-billing pause) fires automatically on every suspension —
        see app/api/admin/users/[id]/route.js. Legal-acceptance records capture the user, role, document
        versions, timestamp, IP, and user-agent for every signup and creator onboarding.
      </p>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="font-semibold text-[#172033]">{title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function Tile({ label, value, detail, flag = false }) {
  return (
    <div className={`rounded-2xl border p-4 ${flag ? 'border-amber-200 bg-amber-50' : 'border-brand-ink/5 bg-brand-paper'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-ink/60">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${flag ? 'text-amber-800' : 'text-[#172033]'}`}>{value}</p>
      {detail && <p className="mt-0.5 text-xs text-brand-ink/55">{detail}</p>}
    </div>
  );
}

function formatLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
