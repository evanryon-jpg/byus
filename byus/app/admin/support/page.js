'use client';

// Support queue: requests the fan help assistant escalated to a human (refunds,
// billing problems, anything it couldn't answer from the fan's own data). The
// assistant's one-line summary is the headline; the full chat is one click away so
// nobody has to ask the fan to repeat themselves. Same shape as the appeals page.

import { useEffect, useState } from 'react';

export default function AdminSupportPage() {
  const [status, setStatus] = useState('loading');
  const [requests, setRequests] = useState([]);

  function load() {
    fetch('/api/admin/support')
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
        setRequests(data.requests || []);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }

  useEffect(() => {
    load();
  }, []);

  if (status === 'loading') {
    return <div className="p-12 text-center text-brand-ink/60">Loading support requests…</div>;
  }
  if (status === 'forbidden') {
    return <div className="p-12 text-center text-brand-ink/60">Not authorized.</div>;
  }
  if (status === 'error') {
    return <div className="p-12 text-center text-brand-ink/60">Could not load support requests.</div>;
  }

  const open = requests.filter((r) => r.status === 'open');
  const resolved = requests.filter((r) => r.status !== 'open');

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#0F766E]">Fans</p>
          <h1 className="mt-1 text-2xl font-bold text-[#172033]">Support requests</h1>
          <p className="mt-1 text-sm text-brand-ink/65">
            Filed by the help assistant on the fan dashboard when a fan needs a person — refunds, billing problems, anything it couldn't answer.
          </p>
        </div>
        <a href="/admin" className="text-sm font-semibold text-[#0F766E] hover:underline">
          ← Platform overview
        </a>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Open" value={open.length} flag={open.length > 0} />
        <SummaryCard label="Refund requests open" value={open.filter((r) => r.kind === 'refund').length} flag={open.some((r) => r.kind === 'refund')} />
        <SummaryCard label="Resolved (recent)" value={resolved.length} />
      </div>

      <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold text-[#172033]">Needs a reply</h2>
        <div className="mt-4 space-y-3">
          {open.map((r) => <RequestCard key={r.id} request={r} onResolved={load} />)}
          {open.length === 0 && (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">No open support requests.</p>
          )}
        </div>
      </section>

      {resolved.length > 0 && (
        <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
          <h2 className="font-semibold text-[#172033]">Recently resolved</h2>
          <div className="mt-4 space-y-3">
            {resolved.map((r) => <RequestCard key={r.id} request={r} compact />)}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value, flag = false }) {
  return (
    <div className={`rounded-2xl border p-4 ${flag ? 'border-amber-200 bg-amber-50' : 'border-brand-ink/5 bg-brand-paper'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-ink/60">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${flag ? 'text-amber-800' : 'text-[#172033]'}`}>{value}</p>
    </div>
  );
}

const KIND_STYLES = {
  refund: 'bg-red-100 text-red-700',
  billing: 'bg-amber-100 text-amber-800',
  account: 'bg-[#0F766E]/10 text-[#0F766E]',
  other: 'bg-brand-ink/5 text-brand-ink/70',
};

function RequestCard({ request, compact = false, onResolved }) {
  const [resolution, setResolution] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleResolve() {
    if (!resolution.trim()) {
      setError('Add a short note on what you did before resolving.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/support/${request.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not resolve this request.');
      }
      onResolved?.();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  const transcript = Array.isArray(request.transcript) ? request.transcript : [];

  return (
    <div className={`rounded-xl border p-4 ${request.status === 'open' ? 'border-brand-ink/5 bg-white' : 'border-brand-ink/5 bg-brand-paper/60'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${KIND_STYLES[request.kind] || KIND_STYLES.other}`}>
          {request.kind}
        </span>
        <span className="font-semibold text-[#172033]">{request.user_name || 'Unnamed fan'}</span>
        <a href={`mailto:${request.user_email}`} className="text-xs text-[#0F766E] hover:underline">{request.user_email}</a>
        <span className="text-xs text-brand-ink/60">· {formatDateTime(request.created_at)}</span>
      </div>
      <p className="mt-2 text-sm text-brand-ink/85">{request.summary}</p>

      {transcript.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowTranscript((v) => !v)} className="text-xs font-semibold text-[#0F766E] hover:underline">
            {showTranscript ? 'Hide conversation' : `Show conversation (${transcript.length} messages)`}
          </button>
          {showTranscript && (
            <ul className="mt-2 space-y-1.5 rounded-lg bg-brand-ink/5 p-3 text-xs">
              {transcript.map((m, i) => (
                <li key={i} className={m.role === 'user' ? 'text-[#172033]' : 'text-brand-ink/65'}>
                  <span className="font-semibold">{m.role === 'user' ? 'Fan' : 'Assistant'}:</span> {m.content}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {request.status === 'resolved' ? (
        <p className="mt-3 text-xs text-brand-ink/65">
          Resolved {formatDateTime(request.resolved_at)} — {request.resolution}
        </p>
      ) : !compact ? (
        <div className="mt-4 border-t border-brand-ink/5 pt-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-ink/70">What you did (kept on the record — reply to the fan by email separately)</span>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full rounded-lg border border-brand-ink/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
          </label>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <button
            onClick={handleResolve}
            disabled={submitting}
            className="mt-2 rounded-full bg-[#0F766E] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Mark resolved'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
