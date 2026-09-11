'use client';

import { useEffect, useState } from 'react';
import MonthlyBarChart from '../components/charts/MonthlyBarChart';
import { formatUSD, formatCompactUSD } from '@/lib/format';

// Platform-wide view for the owner: what ByUs itself has earned, creator/fan growth, and
// a list of recent creators to spot problems (never connected Stripe, zero earnings after
// weeks signed up). The real gate is server-side in /api/admin/overview (lib/admin.js's
// email allowlist) -- this page just reflects whatever that endpoint decides, the same
// pattern the rest of the dashboard uses for role checks.
export default function AdminPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'forbidden' | 'error'
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/admin/overview')
      .then((res) => {
        if (res.status === 403) {
          setStatus('forbidden');
          return null;
        }
        if (!res.ok) {
          setStatus('error');
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json) {
          setData(json);
          setStatus('ok');
        }
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return <div className="p-12 text-center text-brand-ink/60">Loading…</div>;
  }
  if (status === 'forbidden') {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-semibold text-[#2B2420]">Not authorized</h1>
        <p className="mt-2 text-sm text-brand-ink/65">This page is only visible to the ByUs team.</p>
        <a href="/" className="mt-6 inline-block text-sm font-semibold text-[#146359] hover:underline">
          Back to ByUs →
        </a>
      </div>
    );
  }
  if (status === 'error' || !data) {
    return <div className="p-12 text-center text-brand-ink/60">Could not load the platform overview.</div>;
  }

  const {
    creatorCount,
    fanCount,
    activeSubscriberCount,
    lifetimeGrossCents,
    lifetimePlatformFeeCents,
    openDisputeCount,
    needsReviewCount,
    monthly,
    creators,
    disputes,
  } = data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">Platform overview</h1>
      <p className="text-brand-ink/65">What ByUs itself has earned, and how the platform is growing.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="ByUs revenue, lifetime" value={formatCompactUSD(lifetimePlatformFeeCents)} hero />
        <StatTile label="Gross processed, lifetime" value={formatCompactUSD(lifetimeGrossCents)} />
        <StatTile label="Creators" value={creatorCount.toLocaleString()} />
        <StatTile label="Fans" value={fanCount.toLocaleString()} />
        <StatTile label="Active subscriptions" value={activeSubscriberCount.toLocaleString()} />
        <StatTile
          label="Open disputes"
          value={openDisputeCount.toLocaleString()}
          flag={openDisputeCount > 0}
        />
        <StatTile
          label="Creators awaiting review"
          value={needsReviewCount.toLocaleString()}
          flag={needsReviewCount > 0}
        />
      </div>

      <div className="mt-6 space-y-4">
        <ChartCard title="ByUs revenue" subtitle="Platform fee income, by month">
          <MonthlyBarChart data={monthly} valueKey="platformFeeCents" formatValue={formatUSD} formatAxisTick={formatUSD} />
        </ChartCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChartCard title="New creators" subtitle="Signups, by month">
            <MonthlyBarChart
              data={monthly}
              valueKey="newCreators"
              formatValue={(n) => `${n.toLocaleString()} new`}
              formatAxisTick={(n) => n.toLocaleString()}
            />
          </ChartCard>
          <ChartCard title="New fans" subtitle="Signups, by month">
            <MonthlyBarChart
              data={monthly}
              valueKey="newFans"
              formatValue={(n) => `${n.toLocaleString()} new`}
              formatAxisTick={(n) => n.toLocaleString()}
              color="#8a6b2f"
              hoverColor="#a5854a"
            />
          </ChartCard>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold">Disputes</h2>
        <p className="mt-1 text-sm text-brand-ink/65">
          A fan's bank disputing a charge — most need a response through Stripe's own dispute
          flow before they're resolved one way or the other.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-left text-xs font-medium uppercase tracking-wide text-brand-ink/60">
                <th className="py-2 pr-4">Fan</th>
                <th className="py-2 pr-4">Creator</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2 pr-4">Reason</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Opened</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id} className="border-b border-brand-ink/5">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[#2B2420]">{d.fanName || 'Unknown fan'}</div>
                    <div className="text-xs text-brand-ink/60">{d.fanEmail || '—'}</div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[#2B2420]">{d.creatorName || 'Unknown creator'}</div>
                    <div className="text-xs text-brand-ink/60">{d.creatorEmail || '—'}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium text-[#2B2420]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatUSD(d.amountCents)}
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">{d.reason ? formatDisputeLabel(d.reason) : '—'}</td>
                  <td className="py-2.5 pr-4">
                    <DisputeStatusBadge status={d.status} />
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">
                    {new Date(d.openedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
              {disputes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-brand-ink/60">
                    No disputes — nothing to review.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold">Recent creators</h2>
        <p className="mt-1 text-sm text-brand-ink/65">
          Most recent signups first — worth a look if Stripe was never connected or earnings stayed at $0.
          A creator flagged &ldquo;Needs review&rdquo; has no posts live and can&rsquo;t accept a fan&rsquo;s
          first payment yet — see the Review column.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-left text-xs font-medium uppercase tracking-wide text-brand-ink/60">
                <th className="py-2 pr-4">Creator</th>
                <th className="py-2 pr-4">Joined</th>
                <th className="py-2 pr-4">Stripe</th>
                <th className="py-2 pr-4">Fee</th>
                <th className="py-2 pr-4 text-right">Lifetime gross</th>
                <th className="py-2 pr-4">Review</th>
                <th className="py-2 pr-4">Account</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c) => (
                <tr key={c.id} className="border-b border-brand-ink/5">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[#2B2420]">
                      {c.displayName || 'Unnamed creator'}
                      {c.bioFlagged && (
                        <span
                          className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                          title="This creator's bio contains something that looks like a link — worth a look."
                        >
                          Bio has a link
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-brand-ink/60">{c.email}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">
                    {new Date(c.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-2.5 pr-4">
                    {c.stripeConnectOnboarded ? (
                      <span className="rounded-full bg-[#146359]/10 px-2 py-0.5 text-xs font-medium text-[#146359]">Connected</span>
                    ) : (
                      <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-xs font-medium text-brand-ink/60">Not connected</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">{c.platformFeePercent}%</td>
                  <td className="py-2.5 pr-4 text-right font-medium text-[#2B2420]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatUSD(c.lifetimeGrossCents)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <ReviewControl userId={c.id} initialNeedsReview={c.needsReview} />
                  </td>
                  <td className="py-2.5 pr-4">
                    <SuspendControl userId={c.id} initialSuspended={c.isSuspended} initialReason={c.suspensionReason} />
                  </td>
                </tr>
              ))}
              {creators.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-brand-ink/60">
                    No creators have signed up yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReportsSection />
      <SuggestionsSection />
    </div>
  );
}

// Self-fetching, same shape as SuggestionsSection below -- but this is the trust & safety
// queue, not a feature-idea inbox, so it renders first: a flagged creator/post is
// something the team needs to act on, not just read when convenient. See
// app/api/admin/reports/route.js and app/api/admin/reports/[id]/route.js, and
// app/creator/[creatorId]/page.js's ReportButton for the submitter-facing side. This is
// the actual enforcement mechanism behind the no-adult-content policy in Section 5 of
// app/terms/page.js -- without a queue like this, that policy is just a sentence nobody
// can act on.
const REPORT_STATUSES = ['new', 'reviewed', 'resolved', 'dismissed'];
const REPORT_STATUS_STYLES = {
  new: 'bg-red-50 text-red-700',
  reviewed: 'bg-amber-50 text-amber-700',
  resolved: 'bg-green-50 text-green-700',
  dismissed: 'bg-brand-ink/5 text-brand-ink/60',
};
const REPORT_REASON_LABELS = {
  adult_content: 'Adult / sexual content',
  illegal_content: 'Illegal content',
  harassment: 'Harassment or endangerment',
  ip_infringement: 'Copyright / IP infringement',
  hate_violence: 'Hate speech or violent extremism',
  other: 'Something else',
};

function ReportsSection() {
  const [reports, setReports] = useState(null); // null = loading
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/reports')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setReports(data.reports))
      .catch(() => setError('Could not load reports.'));
  }, []);

  async function updateReport(id, patch) {
    // Optimistic, same trade-off as SuggestionsSection below — this is an admin-only
    // triage action, not worth a spinner per row; revert on failure instead.
    const previous = reports;
    setReports((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      setReports(previous);
      setError('Could not save that change — try again.');
    }
  }

  const openCount = reports?.filter((r) => r.status === 'new').length ?? 0;

  return (
    <div className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Reports</h2>
        {openCount > 0 && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            {openCount} new
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-brand-ink/65">
        Content flagged by creators or fans — a page or a specific post someone thinks
        breaks the content guidelines.
      </p>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {reports === null ? (
        <p className="mt-4 text-sm text-brand-ink/60">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="mt-4 text-sm text-brand-ink/60">No reports — nothing's been flagged.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} onUpdate={(patch) => updateReport(r.id, patch)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportRow({ report, onUpdate }) {
  const [note, setNote] = useState(report.admin_note || '');
  const [savingNote, setSavingNote] = useState(false);

  async function handleSaveNote() {
    setSavingNote(true);
    await onUpdate({ admin_note: note });
    setSavingNote(false);
  }

  return (
    <div className="rounded-lg border border-brand-ink/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-[#2B2420]">
            <a href={`/creator/${report.creator_slug || report.creator_id}`} target="_blank" className="hover:underline">
              {report.creator_name || 'Unnamed creator'}
            </a>
            {report.post_id && (
              <span className="font-normal text-brand-ink/50"> — post: {report.post_title || '(untitled)'}</span>
            )}
          </div>
          <div className="text-xs text-brand-ink/60">
            Reported by {report.reporter_name || 'someone'} ({report.reporter_email})
          </div>
          <div className="mt-2">
            <SuspendControl
              userId={report.creator_id}
              initialSuspended={report.creator_is_suspended}
              initialReason={report.creator_suspension_reason}
            />
          </div>
        </div>
        <select
          value={report.status}
          onChange={(e) => onUpdate({ status: e.target.value })}
          className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${REPORT_STATUS_STYLES[report.status]}`}
        >
          {REPORT_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st.charAt(0).toUpperCase() + st.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-sm font-medium text-[#2B2420]">
        {REPORT_REASON_LABELS[report.reason] || report.reason}
      </p>
      {report.details && <p className="mt-1 text-sm text-brand-ink/80">{report.details}</p>}
      <p className="mt-1 text-xs text-brand-ink/50">
        {new Date(report.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </p>

      <div className="mt-3 flex items-start gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Internal note — what you found, what you did"
          className="w-full rounded-lg border border-brand-ink/10 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={handleSaveNote}
          disabled={savingNote || note === (report.admin_note || '')}
          className="shrink-0 rounded-full border border-[#146359] px-3 py-1.5 text-xs font-medium text-[#146359] hover:bg-[#146359]/5 disabled:opacity-50"
        >
          {savingNote ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  );
}

// The actual enforcement action, embedded wherever an admin might decide to use it --
// the Recent creators table (spotting a problem account) and each report row (acting on
// what was just flagged). Each instance manages its own local state rather than syncing
// through the parent's data/reports state: this mirrors ReportsSection/SuggestionsSection
// being independent of each other on this same page, and a full reload always shows the
// current truth regardless. See app/api/admin/users/[id]/route.js for what this actually
// does -- notably, it does NOT touch Stripe subscriptions or payouts.
function SuspendControl({ userId, initialSuspended, initialReason }) {
  const [suspended, setSuspended] = useState(Boolean(initialSuspended));
  const [reason, setReason] = useState(initialReason || '');
  const [open, setOpen] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(nextSuspended, nextReason) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_suspended: nextSuspended, suspension_reason: nextReason || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save that change.');
      setSuspended(nextSuspended);
      setReason(nextReason || '');
      setOpen(false);
      setReasonInput('');
    } catch (err) {
      setError(err.message || 'Could not save that change.');
    } finally {
      setSaving(false);
    }
  }

  if (suspended) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
          title={reason || undefined}
        >
          Suspended
        </span>
        <button
          type="button"
          onClick={() => submit(false, '')}
          disabled={saving}
          className="text-xs font-medium text-[#146359] hover:underline disabled:opacity-50"
        >
          {saving ? 'Reinstating…' : 'Reinstate'}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-red-600 hover:underline">
        Suspend
      </button>
    );
  }

  return (
    <div className="w-64 rounded-lg border border-brand-ink/10 bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold text-[#2B2420]">Suspend this account?</p>
      <p className="mt-1 text-xs text-brand-ink/60">
        Blocks login immediately and hides their public page from Browse and search. Doesn&rsquo;t
        touch Stripe — cancel subscriptions or payouts there separately if that&rsquo;s warranted.
      </p>
      <textarea
        value={reasonInput}
        onChange={(e) => setReasonInput(e.target.value)}
        placeholder="Reason (required, internal only)"
        rows={2}
        className="mt-2 w-full rounded-lg border border-brand-ink/15 px-2 py-1.5 text-xs"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => submit(true, reasonInput)}
          disabled={saving || !reasonInput.trim()}
          className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? 'Suspending…' : 'Confirm suspend'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError('');
          }}
          className="text-xs text-brand-ink/50 hover:text-brand-ink/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ByUs's one-time initial review gate (Stripe compliance asked for a real hold on a new
// creator's first payout, not just a policy saying someone will eventually look --
// see lib/content-policy.js's header comment and app/api/admin/users/[id]/clear-review/route.js).
// Until an admin clears a creator, their posts stay unpublished and /api/subscribe + the
// tip route refuse to let any fan pay them. Clearing is one-way, same as SuspendControl's
// reinstate-only-in-that-direction pattern -- there's no "un-clear."
function ReviewControl({ userId, initialNeedsReview }) {
  const [needsReview, setNeedsReview] = useState(Boolean(initialNeedsReview));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function clearReview() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/clear-review`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not clear this creator for review.');
      setNeedsReview(false);
    } catch (err) {
      setError(err.message || 'Could not clear this creator for review.');
    } finally {
      setSaving(false);
    }
  }

  if (!needsReview) {
    return <span className="text-xs text-brand-ink/40">Cleared</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          Needs review
        </span>
        <button
          type="button"
          onClick={clearReview}
          disabled={saving}
          className="text-xs font-medium text-[#146359] hover:underline disabled:opacity-50"
        >
          {saving ? 'Clearing…' : 'Clear for review'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Self-fetching, separate from /api/admin/overview -- suggestions are unrelated to the
// platform-revenue numbers that route exists for, and this section needs its own
// optimistic per-row update logic (status change, admin reply) that has no business
// living in that route's response shape. See app/api/admin/suggestions/route.js and
// app/api/admin/suggestions/[id]/route.js, and app/settings/page.js's SuggestionBoxCard
// for the submitter-facing side of the same loop.
const SUGGESTION_STATUSES = ['new', 'reviewed', 'planned', 'shipped'];
const SUGGESTION_STATUS_STYLES = {
  new: 'bg-brand-ink/5 text-brand-ink/60',
  reviewed: 'bg-amber-50 text-amber-700',
  planned: 'bg-blue-50 text-blue-700',
  shipped: 'bg-green-50 text-green-700',
};

function SuggestionsSection() {
  const [suggestions, setSuggestions] = useState(null); // null = loading
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/suggestions')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setSuggestions(data.suggestions))
      .catch(() => setError('Could not load suggestions.'));
  }, []);

  async function updateSuggestion(id, patch) {
    // Optimistic -- this is a low-stakes admin-only triage action, not worth a spinner
    // per row; revert to the previous list on failure instead.
    const previous = suggestions;
    setSuggestions((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      const res = await fetch(`/api/admin/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSuggestions(previous);
      setError('Could not save that change — try again.');
    }
  }

  const openCount = suggestions?.filter((s) => s.status === 'new').length ?? 0;

  return (
    <div className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Suggestions</h2>
        {openCount > 0 && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            {openCount} new
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-brand-ink/65">
        What creators and fans have sent in from Settings — reply and it shows up right
        back on their end.
      </p>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {suggestions === null ? (
        <p className="mt-4 text-sm text-brand-ink/60">Loading…</p>
      ) : suggestions.length === 0 ? (
        <p className="mt-4 text-sm text-brand-ink/60">No suggestions yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {suggestions.map((s) => (
            <SuggestionRow key={s.id} suggestion={s} onUpdate={(patch) => updateSuggestion(s.id, patch)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionRow({ suggestion, onUpdate }) {
  const [note, setNote] = useState(suggestion.admin_note || '');
  const [savingNote, setSavingNote] = useState(false);

  async function handleSaveNote() {
    setSavingNote(true);
    await onUpdate({ admin_note: note });
    setSavingNote(false);
  }

  return (
    <div className="rounded-lg border border-brand-ink/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-[#2B2420]">
            {suggestion.display_name || 'Unnamed'}{' '}
            <span className="font-normal text-brand-ink/50">({suggestion.role})</span>
          </div>
          <div className="text-xs text-brand-ink/60">{suggestion.email}</div>
        </div>
        <select
          value={suggestion.status}
          onChange={(e) => onUpdate({ status: e.target.value })}
          className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${SUGGESTION_STATUS_STYLES[suggestion.status]}`}
        >
          {SUGGESTION_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st.charAt(0).toUpperCase() + st.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-sm text-brand-ink/85">{suggestion.message}</p>
      <p className="mt-1 text-xs text-brand-ink/50">
        {new Date(suggestion.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </p>

      <div className="mt-3 flex items-start gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reply — shows up on their Settings page"
          className="w-full rounded-lg border border-brand-ink/10 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={handleSaveNote}
          disabled={savingNote || note === (suggestion.admin_note || '')}
          className="shrink-0 rounded-full border border-[#146359] px-3 py-1.5 text-xs font-medium text-[#146359] hover:bg-[#146359]/5 disabled:opacity-50"
        >
          {savingNote ? 'Saving…' : 'Save reply'}
        </button>
      </div>
    </div>
  );
}

// `flag`: this number is something the owner should actually go look at (e.g. one or
// more open disputes) -- shifts the tile to a warm border/value color instead of the
// neutral default, the same "don't make them hunt for it" reasoning as the dashboard's
// other status pills.
function StatTile({ label, value, hero, flag, className = '' }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        flag ? 'border-amber-300/60 bg-amber-50' : 'border-brand-ink/5 bg-brand-paper'
      } ${className}`}
    >
      <p className="text-xs text-brand-ink/65">{label}</p>
      <p
        className={`mt-1 font-semibold ${flag ? 'text-amber-700' : 'text-[#2B2420]'} ${
          hero ? 'text-2xl' : 'text-xl'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// Stripe's raw dispute status strings ('needs_response', 'warning_under_review', etc.)
// aren't something to show a human as-is. Won/lost/refunded are the terminal states
// (color-coded so they read as resolved at a glance); everything else still needs
// action, so it stays amber rather than trying to enumerate every in-between status.
function DisputeStatusBadge({ status }) {
  const terminal = {
    won: { label: 'Won', className: 'bg-green-50 text-green-700' },
    lost: { label: 'Lost', className: 'bg-red-50 text-red-700' },
    charge_refunded: { label: 'Refunded', className: 'bg-brand-ink/5 text-brand-ink/65' },
  };
  const config = terminal[status] || { label: formatDisputeLabel(status), className: 'bg-amber-50 text-amber-700' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>{config.label}</span>;
}

function formatDisputeLabel(value) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-brand-ink/5 bg-brand-paper p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[#2B2420]">{title}</h3>
        <span className="text-xs text-brand-ink/60">{subtitle}</span>
      </div>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </div>
  );
}
