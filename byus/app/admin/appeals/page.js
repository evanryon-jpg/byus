'use client';

// Suspension appeal queue — the same treatment /admin/disputes gives Stripe chargebacks,
// applied to appeals of ByUs's own moderation decisions. Before this page existed, every
// appeal was just an email to support@byusapp.com with nothing tracking whether it had
// been answered; this makes them a real, timestamped queue instead.

import { useEffect, useState } from 'react';

export default function AdminAppealsPage() {
  const [status, setStatus] = useState('loading');
  const [appeals, setAppeals] = useState([]);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setStatus('loading');
    fetch('/api/admin/appeals')
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
        setAppeals(data.appeals || []);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }

  if (status === 'loading') {
    return <div className="p-12 text-center text-brand-ink/60">Loading appeals…</div>;
  }
  if (status === 'forbidden') {
    return <div className="p-12 text-center text-brand-ink/60">Not authorized.</div>;
  }
  if (status === 'error') {
    return <div className="p-12 text-center text-brand-ink/60">Could not load appeals.</div>;
  }

  const open = appeals.filter((a) => a.status === 'open');
  const resolved = appeals.filter((a) => a.status !== 'open');

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#0F766E]">Trust & safety</p>
          <h1 className="mt-1 text-2xl font-bold text-[#172033]">Suspension appeals</h1>
          <p className="mt-1 text-sm text-brand-ink/65">
            Open appeals are ordered oldest-first, so the longest-waiting case stays on top.
          </p>
        </div>
        <a href="/admin" className="text-sm font-semibold text-[#0F766E] hover:underline">
          ← Platform overview
        </a>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <SummaryCard label="Open appeals" value={open.length} flag={open.length > 0} />
        <SummaryCard label="Resolved" value={resolved.length} flag={false} />
      </div>

      <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold text-[#172033]">Needs a decision</h2>
        <div className="mt-4 space-y-3">
          {open.map((a) => <AppealCard key={a.id} appeal={a} onResolved={load} />)}
          {open.length === 0 && (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">No open appeals.</p>
          )}
        </div>
      </section>

      {resolved.length > 0 && (
        <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
          <h2 className="font-semibold text-[#172033]">Recently resolved</h2>
          <div className="mt-4 space-y-3">
            {resolved.map((a) => <AppealCard key={a.id} appeal={a} compact />)}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value, flag }) {
  return (
    <div className={`rounded-2xl border p-4 ${flag ? 'border-amber-200 bg-amber-50' : 'border-brand-ink/5 bg-brand-paper'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-ink/60">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${flag ? 'text-amber-800' : 'text-[#172033]'}`}>{value}</p>
    </div>
  );
}

function AppealCard({ appeal, compact = false, onResolved }) {
  const [resolution, setResolution] = useState('');
  const [submitting, setSubmitting] = useState(null); // null | 'reinstate' | 'deny'
  const [error, setError] = useState('');

  async function handleResolve(reinstate) {
    if (!resolution.trim()) {
      setError('Add a short note on the decision before resolving.');
      return;
    }
    setError('');
    setSubmitting(reinstate ? 'reinstate' : 'deny');
    try {
      if (reinstate) {
        const reinstateRes = await fetch(`/api/admin/users/${appeal.user_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_suspended: false }),
        });
        if (!reinstateRes.ok) {
          const data = await reinstateRes.json().catch(() => ({}));
          throw new Error(data.error || 'Could not reinstate this account.');
        }
      }
      const resolveRes = await fetch(`/api/admin/appeals/${appeal.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, reinstated: reinstate }),
      });
      if (!resolveRes.ok) {
        const data = await resolveRes.json().catch(() => ({}));
        throw new Error(data.error || 'Could not resolve this appeal.');
      }
      onResolved?.();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className={`rounded-xl border p-4 ${appeal.status === 'open' ? 'border-brand-ink/5 bg-white' : 'border-brand-ink/5 bg-brand-paper/60'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#172033]">{appeal.user_name || 'Unknown'}</span>
            <span className="text-xs text-brand-ink/60">{appeal.user_email}</span>
            <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-xs font-medium text-brand-ink/70">
              {appeal.user_role}
            </span>
            {!appeal.user_currently_suspended && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                Currently not suspended
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-brand-ink/60">
            Suspended {formatDate(appeal.suspended_at)} · Reason: {appeal.suspension_reason || 'Not recorded'}
          </p>
          <p className="mt-1 text-xs text-brand-ink/60">Appeal submitted {formatDate(appeal.created_at)}</p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-brand-ink/5 p-3 text-sm text-brand-ink/85">
        {appeal.message}
      </p>

      {appeal.ai_recommendation && (
        <AiTriagePanel
          appeal={appeal}
          showDraftButton={appeal.status === 'open' && !compact}
          onUseDraft={() => setResolution(appeal.ai_draft_resolution || '')}
        />
      )}

      {appeal.status === 'resolved' ? (
        <p className="mt-3 text-xs text-brand-ink/65">
          {appeal.reinstated ? 'Reinstated' : 'Denied'} {formatDate(appeal.resolved_at)} — {appeal.resolution}
        </p>
      ) : !compact ? (
        <div className="mt-4 border-t border-brand-ink/5 pt-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-ink/70">Resolution note (kept on the record)</span>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full rounded-lg border border-brand-ink/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
            />
          </label>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => handleResolve(true)}
              disabled={Boolean(submitting)}
              className="rounded-full bg-[#0F766E] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
            >
              {submitting === 'reinstate' ? 'Reinstating…' : 'Reinstate & resolve'}
            </button>
            <button
              onClick={() => handleResolve(false)}
              disabled={Boolean(submitting)}
              className="rounded-full border border-brand-ink/15 px-4 py-1.5 text-sm font-semibold text-brand-ink/75 hover:bg-brand-ink/5 disabled:opacity-50"
            >
              {submitting === 'deny' ? 'Saving…' : 'Deny & resolve'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// The model's read of the appeal (see lib/appeal-triage.js). Framed as a suggestion
// with its reasoning shown in full, so the admin can disagree with a specific point
// rather than a bare verdict; the draft note only ever fills the resolution textarea,
// where it can still be edited before anything is submitted.
const TRIAGE_STYLES = {
  reinstate: { label: 'Suggests reinstating', cls: 'bg-green-100 text-green-700' },
  uphold: { label: 'Suggests upholding', cls: 'bg-red-100 text-red-700' },
  needs_human: { label: 'Needs your judgment', cls: 'bg-amber-100 text-amber-800' },
};

function AiTriagePanel({ appeal, showDraftButton, onUseDraft }) {
  const style = TRIAGE_STYLES[appeal.ai_recommendation] || TRIAGE_STYLES.needs_human;
  return (
    <div className="mt-3 rounded-lg border border-[#0F766E]/20 bg-[#0F766E]/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#0F766E]">AI triage</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.cls}`}>{style.label}</span>
        {appeal.ai_confidence && (
          <span className="text-xs text-brand-ink/60">{appeal.ai_confidence} confidence</span>
        )}
      </div>
      {appeal.ai_reasoning && (
        <p className="mt-2 text-sm text-brand-ink/80">{appeal.ai_reasoning}</p>
      )}
      {appeal.ai_draft_resolution && (
        <div className="mt-2 rounded-md bg-white/70 p-2">
          <p className="text-xs font-medium text-brand-ink/60">Drafted note to the account holder</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-brand-ink/80">{appeal.ai_draft_resolution}</p>
          {showDraftButton && (
            <button
              type="button"
              onClick={onUseDraft}
              className="mt-2 text-xs font-semibold text-[#0F766E] hover:underline"
            >
              Use this draft (you can edit it below)
            </button>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-brand-ink/55">A suggestion, not a decision — nothing happens until you resolve it below.</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
