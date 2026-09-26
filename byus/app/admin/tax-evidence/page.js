'use client';

// Fan location evidence for UK/EU VAT (lib/tax-location-evidence.js). Every fan payment
// records three pieces of evidence -- billing country, card country, IP country -- and
// resolves to the country at least two agree on. This page lists the rare payments where
// they don't line up, with a ready-made email asking the fan to confirm, and a form to
// record the answer. Same shape as the support and appeals pages.

import { useEffect, useState } from 'react';

const COUNTRY = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();
const countryName = (code) => (code ? (COUNTRY?.of(code) || code) : '—');
const usd = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
const formatDate = (v) =>
  v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export default function AdminTaxEvidencePage() {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);

  function load() {
    fetch('/api/admin/tax-evidence')
      .then((res) => {
        if (res.status === 403) {
          setStatus('forbidden');
          return null;
        }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((d) => {
        if (!d) return;
        setData(d);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }

  useEffect(() => {
    load();
  }, []);

  if (status === 'loading') return <div className="p-12 text-center text-brand-ink/60">Loading location evidence…</div>;
  if (status === 'forbidden') return <div className="p-12 text-center text-brand-ink/60">Not authorized.</div>;
  if (status === 'error') return <div className="p-12 text-center text-brand-ink/60">Could not load location evidence.</div>;

  const { conflicts = [], recent = [], stats = {} } = data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#0F766E]">Taxes</p>
          <h1 className="mt-1 text-2xl font-bold text-[#172033]">Fan location evidence</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-ink/65">
            UK and EU VAT rules ask for two matching pieces of evidence of where each fan lives. Every payment records
            three: billing address, card country, and IP address. Payments only land here when they don&rsquo;t line up.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <a href="/admin" className="text-sm font-semibold text-[#0F766E] hover:underline">← Platform overview</a>
          <a href="/api/admin/tax-evidence?format=csv" className="text-sm font-semibold text-[#0F766E] hover:underline">
            Download all evidence (CSV)
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Needs confirming" value={stats.open_conflicts || 0} flag={(stats.open_conflicts || 0) > 0} />
        <SummaryCard label="Payments, last 30 days" value={stats.last30 || 0} />
        <SummaryCard label="UK/EU payments, all time" value={stats.uk_eu || 0} />
        <SummaryCard label="Confirmed by fans" value={stats.resolved || 0} />
      </div>

      <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold text-[#172033]">Needs confirming</h2>
        <p className="mt-1 text-sm text-brand-ink/65">
          The payment already went through. Email the fan, then record the country they confirm. If it differs from the
          country tax was charged for, pass it on to the VAT filing service.
        </p>
        <div className="mt-4 space-y-3">
          {conflicts.map((row) => <ConflictCard key={row.id} row={row} onResolved={load} />)}
          {conflicts.length === 0 && (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">Nothing to confirm. Every payment&rsquo;s evidence lines up.</p>
          )}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
          <h2 className="font-semibold text-[#172033]">Recent payments</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm tabular-nums">
              <thead className="text-xs uppercase tracking-wide text-brand-ink/60">
                <tr>
                  <th className="py-2 pr-3 font-medium">Paid</th>
                  <th className="py-2 pr-3 font-medium">Fan</th>
                  <th className="py-2 pr-3 font-medium">Billing</th>
                  <th className="py-2 pr-3 font-medium">Card</th>
                  <th className="py-2 pr-3 font-medium">IP</th>
                  <th className="py-2 pr-3 font-medium">Country used</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-brand-ink/5">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.paid_at)}</td>
                    <td className="py-2 pr-3">{r.fan_name || r.fan_email || '—'}</td>
                    <td className="py-2 pr-3">{r.billing_country || '—'}</td>
                    <td className="py-2 pr-3">{r.card_country || '—'}</td>
                    <td className="py-2 pr-3">{r.ip_country || '—'}</td>
                    <td className="py-2 pr-3 font-semibold text-[#172033]">
                      {countryName(r.confirmed_country || r.resolved_country)}
                      {r.status === 'resolved' && <span className="ml-2 rounded-full bg-[#0F766E]/10 px-2 py-0.5 text-xs font-semibold text-[#0F766E]">confirmed</span>}
                    </td>
                    <td className="py-2 text-right">{usd(r.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="mt-8 max-w-2xl text-xs text-brand-ink/55">
        Kept for 10 years (EU record-keeping rule; the UK asks for 6). IP addresses are personal data and only appear on
        this page and in the CSV.
      </p>
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

function confirmEmailHref(row) {
  const subject = 'Quick question about your ByUs payment';
  const body = [
    `Hi${row.fan_name ? ` ${row.fan_name}` : ''},`,
    '',
    `Thanks for supporting ${row.creator_name || 'a creator'} on ByUs. For tax records we need to know which country you live in, and the details on your ${usd(row.amount_cents)} payment on ${formatDate(row.paid_at).split(',').slice(0, 2).join(',')} pointed to more than one.`,
    '',
    'Could you reply with the country you live in? Nothing else is needed, and your membership isn’t affected.',
    '',
    'Thanks,',
    'ByUs',
  ].join('\n');
  return `mailto:${row.fan_email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function ConflictCard({ row, onResolved }) {
  const [country, setCountry] = useState(row.resolved_country || row.billing_country || '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function handleResolve(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/tax-evidence/${row.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedCountry: country, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save this.');
      setDone(
        data.taxedDiffers
          ? `Saved. Tax was charged for ${countryName(row.taxed_country)}, so let the VAT filing service know this fan lives in ${countryName(country.toUpperCase())}.`
          : 'Saved.'
      );
      setTimeout(() => onResolved?.(), data.taxedDiffers ? 6000 : 800);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  const piece = (label, code) => (
    <div className="rounded-lg bg-brand-paper px-3 py-2">
      <p className="text-xs text-brand-ink/60">{label}</p>
      <p className="font-semibold text-[#172033]">{countryName(code)}</p>
    </div>
  );

  return (
    <div className="rounded-xl border border-brand-ink/5 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold capitalize text-amber-800">{row.payment_kind}</span>
        <span className="font-semibold text-[#172033]">{row.fan_name || 'Unnamed fan'}</span>
        {row.fan_email && <span className="text-xs text-brand-ink/60">{row.fan_email}</span>}
        <span className="text-xs text-brand-ink/60">· {usd(row.amount_cents)}{row.tax_cents > 0 ? ` incl. ${usd(row.tax_cents)} tax` : ''} · {formatDate(row.paid_at)}</span>
      </div>
      <p className="mt-2 text-sm text-brand-ink/75">{row.conflict_reason}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {piece('Billing address (tax charged here)', row.billing_country)}
        {piece('Card issued in', row.card_country)}
        {piece(`IP address${row.ip_address ? ` (${row.ip_address})` : ''}`, row.ip_country)}
      </div>
      {done ? (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{done}</p>
      ) : (
        <form onSubmit={handleResolve} className="mt-3 flex flex-wrap items-end gap-3">
          <a href={confirmEmailHref(row)} className="rounded-full border border-[#0F766E]/30 px-4 py-2 text-sm font-semibold text-[#0F766E] hover:bg-[#0F766E]/5">
            Email the fan
          </a>
          <label className="text-sm" htmlFor={`country-${row.id}`}>
            <span className="block text-xs text-brand-ink/60">Country they confirmed</span>
            <input
              id={`country-${row.id}`}
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="GB"
              className="mt-1 w-20 rounded-lg border border-brand-ink/15 px-3 py-2 uppercase"
            />
          </label>
          <label className="min-w-[220px] flex-1 text-sm" htmlFor={`note-${row.id}`}>
            <span className="block text-xs text-brand-ink/60">How they confirmed</span>
            <input
              id={`note-${row.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Replied by email on Oct 2"
              className="mt-1 w-full rounded-lg border border-brand-ink/15 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
