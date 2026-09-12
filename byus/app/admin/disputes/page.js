'use client';

import { useEffect, useState } from 'react';
import { formatUSD } from '@/lib/format';

const CLOSED_STATUSES = new Set(['won', 'lost']);

export default function AdminDisputesPage() {
  const [status, setStatus] = useState('loading');
  const [disputes, setDisputes] = useState([]);

  useEffect(() => {
    fetch('/api/admin/overview')
      .then((res) => {
        if (res.status === 403) {
          setStatus('forbidden');
          return null;
        }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setDisputes(data.disputes || []);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return <div className="p-12 text-center text-brand-ink/60">Loading disputes…</div>;
  }
  if (status === 'forbidden') {
    return <div className="p-12 text-center text-brand-ink/60">Not authorized.</div>;
  }
  if (status === 'error') {
    return <div className="p-12 text-center text-brand-ink/60">Could not load disputes.</div>;
  }

  const open = disputes.filter((d) => !CLOSED_STATUSES.has(d.status));
  const closed = disputes.filter((d) => CLOSED_STATUSES.has(d.status));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#146359]">Payments & risk</p>
          <h1 className="mt-1 text-2xl font-bold text-[#2B2420]">Dispute response queue</h1>
          <p className="mt-1 text-sm text-brand-ink/65">
            Open disputes are ordered by Stripe's response deadline so the most urgent case stays on top.
          </p>
        </div>
        <a href="/admin" className="text-sm font-semibold text-[#146359] hover:underline">
          ← Platform overview
        </a>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Open disputes" value={open.length} flag={open.length > 0} />
        <SummaryCard label="Urgent (≤72h)" value={open.filter((d) => d.responseUrgent).length} flag={open.some((d) => d.responseUrgent)} />
        <SummaryCard label="Overdue" value={open.filter((d) => d.responseOverdue).length} flag={open.some((d) => d.responseOverdue)} />
      </div>

      <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold text-[#2B2420]">Needs attention</h2>
        <p className="mt-1 text-sm text-brand-ink/65">
          Use the evidence package to review what ByUs can prove, then submit the actual response through Stripe.
        </p>
        <div className="mt-4 space-y-3">
          {open.map((d) => <DisputeCard key={d.id} dispute={d} />)}
          {open.length === 0 && (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">No open disputes.</p>
          )}
        </div>
      </section>

      {closed.length > 0 && (
        <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
          <h2 className="font-semibold text-[#2B2420]">Recently resolved</h2>
          <div className="mt-4 space-y-3">
            {closed.map((d) => <DisputeCard key={d.id} dispute={d} compact />)}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value, flag }) {
  return (
    <div className={`rounded-2xl border p-4 ${flag ? 'border-red-200 bg-red-50' : 'border-brand-ink/5 bg-brand-paper'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-ink/60">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${flag ? 'text-red-700' : 'text-[#2B2420]'}`}>{value}</p>
    </div>
  );
}

function DisputeCard({ dispute, compact = false }) {
  const deadline = getDeadlineState(dispute);

  return (
    <div className={`rounded-xl border p-4 ${deadline.containerClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#2B2420]">{formatUSD(dispute.amountCents)}</span>
            <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-xs font-medium text-brand-ink/70">
              {formatLabel(dispute.status)}
            </span>
            {!compact && deadline.badge && (
              <span className={deadline.badgeClass}>{deadline.badge}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-brand-ink/70">
            {dispute.fanName || 'Unknown fan'} → {dispute.creatorName || 'Unknown creator'}
          </p>
          <p className="mt-1 text-xs text-brand-ink/60">
            Reason: {dispute.reason ? formatLabel(dispute.reason) : 'Not provided'} · Opened {formatDate(dispute.openedAt)}
          </p>
        </div>

        {!compact && (
          <div className="text-right">
            <p className={`text-sm font-semibold ${deadline.textClass}`}>{deadline.primary}</p>
            {deadline.secondary && <p className="mt-0.5 text-xs text-brand-ink/60">{deadline.secondary}</p>}
          </div>
        )}
      </div>

      {!compact && (
        <div className="mt-4 flex flex-wrap gap-3 border-t border-brand-ink/5 pt-3 text-sm">
          <a
            href={`/api/admin/payments/disputes/${encodeURIComponent(dispute.stripeDisputeId || dispute.id)}/evidence`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#146359] hover:underline"
          >
            View evidence package ↗
          </a>
          <span className="text-brand-ink/50">•</span>
          <span className="text-brand-ink/60">
            Alert email {dispute.alertSentAt ? `sent ${formatDate(dispute.alertSentAt)}` : 'not confirmed sent'}
          </span>
        </div>
      )}
    </div>
  );
}

function getDeadlineState(dispute) {
  if (CLOSED_STATUSES.has(dispute.status)) {
    return {
      containerClass: 'border-brand-ink/5 bg-white',
      textClass: 'text-brand-ink/70',
      primary: 'Resolved',
      secondary: null,
      badge: null,
      badgeClass: '',
    };
  }

  if (!dispute.responseDueAt) {
    return {
      containerClass: 'border-amber-200 bg-amber-50/40',
      textClass: 'text-amber-800',
      primary: 'Check Stripe for deadline',
      secondary: 'No due date was supplied in the stored webhook event.',
      badge: 'Needs review',
      badgeClass: 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800',
    };
  }

  const due = new Date(dispute.responseDueAt);
  if (dispute.responseOverdue) {
    return {
      containerClass: 'border-red-300 bg-red-50',
      textClass: 'text-red-700',
      primary: 'Response overdue',
      secondary: `Due ${formatDateTime(due)}`,
      badge: 'Overdue',
      badgeClass: 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700',
    };
  }

  const hours = dispute.hoursRemaining;
  const remaining = hours <= 48
    ? `${Math.max(hours, 0)}h remaining`
    : `${Math.ceil(hours / 24)} days remaining`;

  return {
    containerClass: dispute.responseUrgent ? 'border-red-200 bg-red-50/40' : 'border-brand-ink/5 bg-white',
    textClass: dispute.responseUrgent ? 'text-red-700' : 'text-[#2B2420]',
    primary: remaining,
    secondary: `Due ${formatDateTime(due)}`,
    badge: dispute.responseUrgent ? 'Urgent' : 'Open',
    badgeClass: dispute.responseUrgent
      ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700'
      : 'rounded-full bg-[#146359]/10 px-2 py-0.5 text-xs font-semibold text-[#146359]',
  };
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

function formatLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
