// /admin/accounting -- ByUs's books, built from Stripe's own ledger (see
// lib/accounting/sync.js for how it's copied, lib/accounting/reports.js for the math).
// Server-rendered; every tab has a CSV download via /api/admin/accounting/export.

import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import {
  parsePeriod,
  periodOptions,
  getSummary,
  getSyncStatus,
  getMonthlyStatements,
  getCreatorBreakdown,
  getTransactions,
  getPayouts,
  getRefundsAndDisputes,
  getTaxYear,
  getReconciliation,
  PAGE_SIZE,
} from '@/lib/accounting/reports';
import { BUCKETS, BUCKET_LABELS, KIND_LABELS } from '@/lib/accounting/categories';
import { SyncButton, ParamSelect } from './AccountingControls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accounting · ByUs Admin' };

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'statements', label: 'Statements' },
  { key: 'creators', label: 'Creators' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'refunds', label: 'Refunds & disputes' },
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'tax', label: 'Tax & year-end' },
];

// ---- formatting ----------------------------------------------------------------------

function money(cents) {
  if (cents === null || cents === undefined) return '—';
  const value = Number(cents) / 100;
  const text = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value < 0 ? '−' : ''}$${text}`;
}
function day(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
function when(value) {
  if (!value) return 'never';
  return `${new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} UTC`;
}
function percent(value) {
  return value === null || value === undefined ? '—' : `${value.toFixed(1)}%`;
}
function href(params) {
  const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return `/admin/accounting?${new URLSearchParams(clean).toString()}`;
}
function exportHref(report, periodKey) {
  return `/api/admin/accounting/export?${new URLSearchParams({ report, period: periodKey }).toString()}`;
}

// ---- page ------------------------------------------------------------------------------

export default async function AccountingPage({ searchParams = {} }) {
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-semibold text-[#172033]">Not authorized</h1>
        <p className="mt-2 text-sm text-brand-ink/65">This page is only visible to the ByUs team.</p>
      </div>
    );
  }

  const tab = TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab : 'overview';
  const period = parsePeriod(searchParams.period);
  const nowYear = new Date().getUTCFullYear();

  let status = null;
  let content = null;
  let loadError = '';
  try {
    status = await getSyncStatus();
    content = await renderTab(tab, period, searchParams, nowYear);
  } catch (err) {
    console.error('admin accounting load failed:', err);
    loadError = /relation .* does not exist/.test(err.message || '')
      ? 'The accounting tables are not set up yet (database migration 20260921_accounting.sql has not been applied).'
      : 'Could not load accounting data.';
  }

  const showPeriod = !['reconciliation', 'tax'].includes(tab);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a href="/admin" className="text-sm font-semibold text-[#0F766E] hover:underline">← Platform overview</a>
          <h1 className="mt-2 text-2xl font-bold text-[#172033]">Accounting</h1>
          <p className="mt-1 text-sm text-brand-ink/65">
            Real money movement from Stripe: fees, refunds, disputes, tax and payouts.
          </p>
          {status && (
            <p className={`mt-1 text-xs ${status.lastError || status.stale ? 'text-amber-700' : 'text-brand-ink/55'}`}>
              Last synced {when(status.lastFinishedAt)} · {status.ledgerRows.toLocaleString()} Stripe transactions on file
              {status.lastError ? ' · last sync had problems — see Reconciliation' : ''}
              {!status.lastError && status.stale && status.lastFinishedAt ? ' · sync is overdue' : ''}
            </p>
          )}
        </div>
        <SyncButton />
      </div>

      <nav className="-mx-4 mt-6 overflow-x-auto px-4" aria-label="Accounting sections">
        <ul className="flex min-w-max gap-1 border-b border-brand-ink/10">
          {TABS.map((t) => (
            <li key={t.key}>
              <a
                href={href({ tab: t.key, period: searchParams.period, year: searchParams.year })}
                aria-current={t.key === tab ? 'page' : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
                  t.key === tab
                    ? 'border-[#0F766E] text-[#0F766E]'
                    : 'border-transparent text-brand-ink/60 hover:text-[#172033]'
                }`}
              >
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {showPeriod && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Suspense fallback={null}>
            <ParamSelect name="period" value={period.key} options={withCurrent(periodOptions(), period)} label="Period" />
          </Suspense>
          <p className="text-xs text-brand-ink/55">Dates are in UTC, matching Stripe.</p>
        </div>
      )}

      {status && status.ledgerRows === 0 && !loadError && (
        <Notice tone="info">
          {status.lastFinishedAt
            ? 'Stripe has no balance activity yet — numbers will appear here after the first real payment.'
            : 'No data has been synced from Stripe yet. Press "Sync now" to pull your full history; after that it syncs automatically every 6 hours.'}
        </Notice>
      )}

      <div className="mt-6">{loadError ? <Notice tone="error">{loadError}</Notice> : content}</div>
    </div>
  );
}

function withCurrent(options, period) {
  return options.some((o) => o.key === period.key) ? options : [{ key: period.key, label: period.label }, ...options];
}

async function renderTab(tab, period, searchParams, nowYear) {
  switch (tab) {
    case 'statements':
      return <StatementsTab rows={await getMonthlyStatements(period)} period={period} />;
    case 'creators':
      return <CreatorsTab rows={await getCreatorBreakdown(period)} period={period} />;
    case 'transactions': {
      const page = Math.max(1, Number.parseInt(searchParams.page, 10) || 1);
      const bucket = BUCKETS.includes(searchParams.bucket) ? searchParams.bucket : '';
      const creatorId = /^[0-9a-f-]{36}$/i.test(searchParams.creator || '') ? searchParams.creator : '';
      const data = await getTransactions(period, { bucket, creatorId, page });
      return <TransactionsTab data={data} period={period} bucket={bucket} creatorId={creatorId} />;
    }
    case 'payouts':
      return <PayoutsTab data={await getPayouts(period)} period={period} />;
    case 'refunds':
      return <RefundsTab data={await getRefundsAndDisputes(period)} period={period} />;
    case 'reconciliation':
      return <ReconciliationTab data={await getReconciliation()} />;
    case 'tax': {
      const year = /^\d{4}$/.test(searchParams.year || '') ? Number(searchParams.year) : nowYear;
      return <TaxTab data={await getTaxYear(year)} nowYear={nowYear} />;
    }
    default: {
      const [summary, status] = await Promise.all([getSummary(period), getSyncStatus()]);
      return <OverviewTab s={summary} period={period} status={status} />;
    }
  }
}

// ---- shared bits -----------------------------------------------------------------------

function Notice({ tone = 'info', children }) {
  const styles = {
    info: 'border-[#2563EB]/15 bg-[#2563EB]/5 text-brand-ink/75',
    warn: 'border-amber-300/60 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-700',
  };
  return <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

function Tile({ label, value, detail, hero, flag }) {
  return (
    <div className={`rounded-xl border p-4 ${flag ? 'border-amber-300/60 bg-amber-50' : 'border-brand-ink/5 bg-brand-paper'}`}>
      <p className="text-xs text-brand-ink/65">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${flag ? 'text-amber-700' : 'text-[#172033]'} ${hero ? 'text-2xl' : 'text-xl'}`}>
        {value}
      </p>
      {detail && <p className="mt-1 text-[11px] text-brand-ink/55">{detail}</p>}
    </div>
  );
}

function Section({ title, subtitle, action, children }) {
  return (
    <section className="mt-8 first:mt-0">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold text-[#172033]">{title}</h2>
          {subtitle && <p className="text-xs text-brand-ink/60">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function CsvLink({ report, periodKey, label = 'Download CSV' }) {
  return (
    <a
      href={exportHref(report, periodKey)}
      className="rounded-full border border-[#0F766E]/30 px-3 py-1 text-xs font-semibold text-[#0F766E] hover:bg-[#0F766E]/5"
    >
      {label}
    </a>
  );
}

function Table({ columns, rows, empty = 'Nothing in this period.', footer }) {
  if (!rows.length) {
    return <p className="rounded-xl border border-brand-ink/5 bg-brand-paper px-4 py-6 text-center text-sm text-brand-ink/60">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-ink/5 bg-brand-paper">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-brand-ink/10 text-left text-xs text-brand-ink/60">
            {columns.map((c) => (
              <th key={c.label} className={`whitespace-nowrap px-3 py-2 font-medium ${c.num ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || row.creatorId || row.month || i} className="border-b border-brand-ink/5 last:border-0">
              {columns.map((c) => (
                <td key={c.label} className={`whitespace-nowrap px-3 py-2 ${c.num ? 'text-right tabular-nums' : ''}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-brand-ink/15 font-semibold">
              {columns.map((c, i) => (
                <td key={c.label} className={`whitespace-nowrap px-3 py-2 ${c.num ? 'text-right tabular-nums' : ''}`}>
                  {i === 0 ? 'Total' : c.total ? c.total(footer) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ---- Overview --------------------------------------------------------------------------

function StatementLine({ label, value, sign, strong, note, indent }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 px-4 py-2 ${strong ? 'bg-[#0F766E]/5 font-semibold text-[#172033]' : ''}`}>
      <span className={`text-sm ${indent ? 'pl-4 text-brand-ink/75' : ''}`}>
        {sign && <span className="mr-2 inline-block w-3 text-brand-ink/50">{sign}</span>}
        {label}
        {note && <span className="ml-2 text-xs font-normal text-brand-ink/55">{note}</span>}
      </span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  );
}

function OverviewTab({ s, period, status }) {
  const balance = status.platformBalance;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label="ByUs net revenue" value={money(s.netRevenueCents)} hero flag={s.netRevenueCents < 0}
          detail={s.marginPercent === null ? 'After real Stripe costs' : `${percent(s.marginPercent)} of fees kept after Stripe costs`} />
        <Tile label="ByUs fees earned" value={money(s.byusFeesCents)}
          detail={s.effectiveTakePercent === null ? undefined : `${percent(s.effectiveTakePercent)} effective rate on net sales`} />
        <Tile label="Fan payments (gross)" value={money(s.grossCents)} detail={`${s.salesCount.toLocaleString()} payment(s)`} />
        <Tile label="Stripe costs" value={money(s.stripeCostsCents)} detail="Processing + Billing, Tax & Connect fees" />
        <Tile label="Refunds & disputes" value={money(-(s.refundsCents + s.disputesCents))}
          flag={s.disputeCount > 0} detail={`${s.refundCount} refund(s), ${s.disputeCount} dispute(s)`} />
        <Tile label="Paid to creators" value={money(s.paidToCreatorsCents)} />
      </div>

      <Section
        title={`Income statement · ${period.label}`}
        subtitle="How each dollar fans paid was split between creators, Stripe and ByUs."
        action={<CsvLink report="summary" periodKey={period.key} />}
      >
        <div className="divide-y divide-brand-ink/5 overflow-hidden rounded-xl border border-brand-ink/5 bg-brand-paper">
          <StatementLine label="Fan payments (gross)" value={money(s.grossCents)} />
          <StatementLine sign="−" label="Sales tax collected" note="owed to tax authorities" value={money(s.taxCents)} indent />
          <StatementLine sign="−" label="Refunds" value={money(-s.refundsCents)} indent />
          <StatementLine sign="−" label="Disputes" value={money(-s.disputesCents)} indent />
          <StatementLine label="Net sales" value={money(s.netSalesCents)} strong />
          <StatementLine sign="−" label="Paid to creators" value={money(s.paidToCreatorsCents)} indent />
          {s.appFeeRowsCents !== 0 && (
            <StatementLine sign="+" label="Application fees returned by Stripe" value={money(s.appFeeRowsCents)} indent />
          )}
          <StatementLine label="ByUs fees earned" value={money(s.byusFeesCents)} strong
            note={s.effectiveTakePercent === null ? undefined : `${percent(s.effectiveTakePercent)} of net sales`} />
          <StatementLine sign="−" label="Stripe processing fees" value={money(s.processingFeesCents)} indent
            note={s.disputeFeesCents ? `incl. ${money(s.disputeFeesCents)} dispute fees` : undefined} />
          <StatementLine sign="−" label="Stripe service fees" note="Billing, Tax, Connect" value={money(s.serviceFeesCents)} indent />
          {s.otherCents !== 0 && <StatementLine sign="±" label="Other adjustments" value={money(s.otherCents)} indent />}
          <StatementLine label="ByUs net revenue" value={money(s.netRevenueCents)} strong />
        </div>
      </Section>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Section title="Payments by type">
          <Table
            columns={[
              { label: 'Type', render: (r) => KIND_LABELS[r.kind] || r.kind },
              { label: 'Payments', num: true, render: (r) => r.count.toLocaleString() },
              { label: 'Gross', num: true, render: (r) => money(r.grossCents) },
            ]}
            rows={s.byKind}
          />
        </Section>
        <Section title="Cash">
          <div className="divide-y divide-brand-ink/5 overflow-hidden rounded-xl border border-brand-ink/5 bg-brand-paper">
            <StatementLine label="Cash kept in Stripe this period" value={money(s.cashKeptCents)} note="net revenue + tax held" />
            <StatementLine label="Paid out to ByUs bank this period" value={money(s.bankPayoutsCents)} />
            <StatementLine label="Stripe balance now — available" value={balance ? money(balance.availableCents) : '—'} />
            <StatementLine label="Stripe balance now — pending" value={balance ? money(balance.pendingCents) : '—'} />
          </div>
        </Section>
      </div>
    </>
  );
}

// ---- Statements ------------------------------------------------------------------------

function StatementsTab({ rows, period }) {
  const totals = rows.reduce((acc, r) => {
    for (const [k, v] of Object.entries(r)) if (typeof v === 'number' && k.endsWith('Cents')) acc[k] = (acc[k] || 0) + v;
    return acc;
  }, {});
  const sum = (key) => (t) => money(t[key]);
  return (
    <Section title="Monthly statements" subtitle={period.label} action={<CsvLink report="statements" periodKey={period.key} />}>
      <Table
        rows={rows}
        empty="No Stripe activity in this period."
        footer={rows.length > 1 ? totals : null}
        columns={[
          { label: 'Month', render: (r) => <a className="font-semibold text-[#0F766E] hover:underline" href={href({ tab: 'overview', period: r.month })}>{r.month}</a> },
          { label: 'Gross', num: true, render: (r) => money(r.grossCents), total: sum('grossCents') },
          { label: 'Tax', num: true, render: (r) => money(r.taxCents), total: sum('taxCents') },
          { label: 'Refunds', num: true, render: (r) => money(r.refundsCents), total: sum('refundsCents') },
          { label: 'Disputes', num: true, render: (r) => money(r.disputesCents), total: sum('disputesCents') },
          { label: 'To creators', num: true, render: (r) => money(r.paidToCreatorsCents), total: sum('paidToCreatorsCents') },
          { label: 'ByUs fees', num: true, render: (r) => money(r.byusFeesCents), total: sum('byusFeesCents') },
          { label: 'Stripe costs', num: true, render: (r) => money(r.stripeCostsCents), total: sum('stripeCostsCents') },
          { label: 'Net revenue', num: true, render: (r) => <strong>{money(r.netRevenueCents)}</strong>, total: sum('netRevenueCents') },
          { label: 'Bank payouts', num: true, render: (r) => money(r.bankPayoutsCents), total: sum('bankPayoutsCents') },
        ]}
      />
    </Section>
  );
}

// ---- Creators --------------------------------------------------------------------------

function CreatorsTab({ rows, period }) {
  return (
    <Section
      title="By creator"
      subtitle={`${period.label} · what each creator's fans paid, what ByUs kept, and where their money is now`}
      action={<CsvLink report="creators" periodKey={period.key} />}
    >
      <Table
        rows={rows}
        empty="No creator activity in this period."
        columns={[
          { label: 'Creator', render: (r) => (
            <a className="font-semibold text-[#0F766E] hover:underline" href={href({ tab: 'transactions', period: period.key, creator: r.creatorId })}>{r.name}</a>
          ) },
          { label: 'Gross', num: true, render: (r) => money(r.grossCents) },
          { label: 'Refunds + disputes', num: true, render: (r) => money(r.refundsCents + r.disputesCents) },
          { label: 'Paid to creator', num: true, render: (r) => money(r.paidToCreatorsCents) },
          { label: 'ByUs fees', num: true, render: (r) => money(r.byusFeesCents) },
          { label: 'Rate', num: true, render: (r) => percent(r.effectiveTakePercent) },
          { label: 'Stripe fees', num: true, render: (r) => money(r.creatorStripeFeesCents) },
          { label: 'ByUs net', num: true, render: (r) => money(r.netRevenueCents) },
          { label: 'Paid out to bank', num: true, render: (r) => (
            <span className={r.failedPayouts ? 'text-red-700' : ''}>{money(r.paidOutCents)}{r.failedPayouts ? ` (${r.failedPayouts} failed)` : ''}</span>
          ) },
          { label: 'Stripe balance', num: true, render: (r) => (
            r.balanceAvailableCents === null ? '—' : `${money(r.balanceAvailableCents)} + ${money(r.balancePendingCents)} pending`
          ) },
        ]}
      />
      <p className="mt-2 text-xs text-brand-ink/55">Stripe balance is the creator&rsquo;s own connected account right now, not limited to the period.</p>
    </Section>
  );
}

// ---- Transactions ----------------------------------------------------------------------

function TransactionsTab({ data, period, bucket, creatorId }) {
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const creatorName = creatorId ? data.rows.find((r) => r.creatorId === creatorId)?.creatorName : null;
  const bucketOptions = [{ key: '', label: 'All categories' }, ...BUCKETS.map((b) => ({ key: b, label: BUCKET_LABELS[b] }))];
  return (
    <Section
      title="Ledger"
      subtitle={`${data.total.toLocaleString()} Stripe balance transaction(s) · ${period.label}`}
      action={<CsvLink report="transactions" periodKey={period.key} label="Download all as CSV" />}
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Suspense fallback={null}>
          <ParamSelect name="bucket" value={bucket} options={bucketOptions} label="Category" />
        </Suspense>
        {creatorId && (
          <a href={href({ tab: 'transactions', period: period.key, bucket })} className="rounded-full bg-[#0F766E]/10 px-3 py-1 text-xs font-semibold text-[#0F766E]">
            Creator: {creatorName || 'selected'} ✕
          </a>
        )}
      </div>
      <Table
        rows={data.rows}
        empty="No transactions match."
        columns={[
          { label: 'Date', render: (r) => day(r.createdAt) },
          { label: 'Category', render: (r) => BUCKET_LABELS[r.bucket] || r.bucket },
          { label: 'Type', render: (r) => (r.kind ? KIND_LABELS[r.kind] : r.type) },
          { label: 'Creator', render: (r) => r.creatorName || '—' },
          { label: 'Fan', render: (r) => r.fanName || '—' },
          { label: 'Amount', num: true, render: (r) => money(r.amountCents) },
          { label: 'Stripe fee', num: true, render: (r) => (r.feeCents ? money(r.feeCents) : '—') },
          { label: 'Net', num: true, render: (r) => money(r.netCents) },
          { label: 'Status', render: (r) => r.status || '—' },
          { label: 'Stripe ID', render: (r) => <span className="font-mono text-xs text-brand-ink/60">{r.sourceId || r.id}</span> },
        ]}
      />
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          {data.page > 1 ? (
            <a className="font-semibold text-[#0F766E]" href={href({ tab: 'transactions', period: period.key, bucket, creator: creatorId, page: data.page - 1 })}>← Newer</a>
          ) : <span />}
          <span className="text-brand-ink/60">Page {data.page} of {pages}</span>
          {data.page < pages ? (
            <a className="font-semibold text-[#0F766E]" href={href({ tab: 'transactions', period: period.key, bucket, creator: creatorId, page: data.page + 1 })}>Older →</a>
          ) : <span />}
        </div>
      )}
    </Section>
  );
}

// ---- Payouts ---------------------------------------------------------------------------

function PayoutsTab({ data, period }) {
  const statusCell = (r) => (
    <span className={['failed', 'canceled'].includes(r.status) ? 'font-semibold text-red-700' : ''}>{r.status}</span>
  );
  return (
    <>
      <Section title="To ByUs's bank" subtitle={period.label} action={<CsvLink report="payouts" periodKey={period.key} />}>
        <Table
          rows={data.bank}
          empty="No payouts to ByUs's bank in this period."
          columns={[
            { label: 'Created', render: (r) => day(r.createdAt) },
            { label: 'Amount', num: true, render: (r) => money(r.amountCents) },
            { label: 'Status', render: statusCell },
            { label: 'Expected arrival', render: (r) => day(r.arrivalDate) },
            { label: 'Stripe ID', render: (r) => <span className="font-mono text-xs text-brand-ink/60">{r.id}</span> },
          ]}
        />
      </Section>
      <Section title="To creators' banks" subtitle="From each creator's own Stripe account">
        <Table
          rows={data.creators}
          empty="No creator payouts in this period."
          columns={[
            { label: 'Created', render: (r) => day(r.createdAt) },
            { label: 'Creator', render: (r) => r.creatorName },
            { label: 'Amount', num: true, render: (r) => money(r.amountCents) },
            { label: 'Status', render: statusCell },
            { label: 'Method', render: (r) => r.method || '—' },
            { label: 'Arrival', render: (r) => day(r.arrivalDate) },
            { label: 'Problem', render: (r) => r.failureMessage || '' },
          ]}
        />
      </Section>
    </>
  );
}

// ---- Refunds & disputes ----------------------------------------------------------------

function RefundsTab({ data, period }) {
  return (
    <>
      <Section
        title="Refunds and dispute money movements"
        subtitle={period.label}
        action={<CsvLink report="refunds" periodKey={period.key} />}
      >
        <Table
          rows={data.movements}
          empty="No refunds or disputes in this period."
          columns={[
            { label: 'Date', render: (r) => day(r.createdAt) },
            { label: 'Kind', render: (r) => BUCKET_LABELS[r.bucket] },
            { label: 'Creator', render: (r) => r.creatorName || '—' },
            { label: 'Fan', render: (r) => r.fanName || '—' },
            { label: 'Amount', num: true, render: (r) => money(r.amountCents) },
            { label: 'Stripe fee', num: true, render: (r) => (r.feeCents ? money(r.feeCents) : '—') },
            { label: 'Charge', render: (r) => <span className="font-mono text-xs text-brand-ink/60">{r.chargeId || '—'}</span> },
          ]}
        />
      </Section>
      <Section
        title="Disputes opened"
        subtitle="Respond to open disputes from the dispute queue."
        action={<a href="/admin/disputes" className="text-xs font-semibold text-[#0F766E] hover:underline">Dispute queue →</a>}
      >
        <Table
          rows={data.disputes}
          empty="No disputes opened in this period."
          columns={[
            { label: 'Opened', render: (r) => day(r.openedAt) },
            { label: 'Creator', render: (r) => r.creatorName || '—' },
            { label: 'Fan', render: (r) => r.fanName || '—' },
            { label: 'Amount', num: true, render: (r) => money(r.amountCents) },
            { label: 'Reason', render: (r) => (r.reason || '—').replace(/_/g, ' ') },
            { label: 'Status', render: (r) => (r.status || '—').replace(/_/g, ' ') },
            { label: 'Respond by', render: (r) => day(r.responseDueAt) },
          ]}
        />
      </Section>
    </>
  );
}

// ---- Reconciliation --------------------------------------------------------------------

function ReconciliationTab({ data }) {
  const icon = { ok: '✓', warn: '!', error: '✕' };
  const tone = {
    ok: 'bg-green-50 text-green-700',
    warn: 'bg-amber-50 text-amber-700',
    error: 'bg-red-50 text-red-700',
  };
  const problems = data.checks.filter((c) => c.status !== 'ok').length;
  return (
    <Section
      title={problems ? `${problems} check(s) need attention` : 'Everything reconciles'}
      subtitle="Compares Stripe's records with ByUs's own records, across all time."
      action={<CsvLink report="reconciliation" periodKey="all" />}
    >
      <ul className="space-y-3">
        {data.checks.map((c) => (
          <li key={c.key} className="rounded-xl border border-brand-ink/5 bg-brand-paper p-4">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tone[c.status]}`} aria-label={c.status}>
                {icon[c.status]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#172033]">{c.title}</p>
                <p className="mt-0.5 text-sm text-brand-ink/70">{c.detail}</p>
                {c.items.length > 0 && (
                  <ul className="mt-2 divide-y divide-brand-ink/5 rounded-lg border border-brand-ink/5 text-xs">
                    {c.items.map((item, i) => (
                      <li key={i} className="flex flex-wrap justify-between gap-2 px-3 py-1.5">
                        <span className="break-all font-mono text-brand-ink/70">{item.label}</span>
                        <span className="tabular-nums text-brand-ink/70">{money(item.amountCents)} · {day(item.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ---- Tax & year-end --------------------------------------------------------------------

function TaxTab({ data, nowYear }) {
  const years = [];
  for (let y = nowYear; y >= 2026; y -= 1) years.push({ key: String(y), label: String(y) });
  const t = data.totals;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Suspense fallback={null}>
          <ParamSelect name="year" value={String(data.year)} options={years} label="Tax year" />
        </Suspense>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={`Sales tax collected · ${data.year}`} value={money(t.taxCents)} detail="Owed to tax authorities — not ByUs income" />
        <Tile label="ByUs fees earned" value={money(t.byusFeesCents)} />
        <Tile label="Stripe costs" value={money(t.stripeCostsCents)} detail="Deductible business expense" />
        <Tile label="ByUs net revenue" value={money(t.netRevenueCents)} hero />
      </div>

      <Section title="By month" subtitle={String(data.year)} action={<CsvLink report="tax-months" periodKey={String(data.year)} />}>
        <Table
          rows={data.months}
          empty="No activity this year."
          columns={[
            { label: 'Month', render: (r) => r.month },
            { label: 'Gross', num: true, render: (r) => money(r.grossCents) },
            { label: 'Sales tax', num: true, render: (r) => money(r.taxCents) },
            { label: 'Refunds + disputes', num: true, render: (r) => money(r.refundsCents + r.disputesCents) },
            { label: 'ByUs fees', num: true, render: (r) => money(r.byusFeesCents) },
            { label: 'Stripe costs', num: true, render: (r) => money(r.stripeCostsCents) },
            { label: 'Net revenue', num: true, render: (r) => money(r.netRevenueCents) },
          ]}
        />
      </Section>

      <Section
        title="Creator year-end summary"
        subtitle="What each creator received through ByUs — useful for 1099-K questions."
        action={<CsvLink report="tax-creators" periodKey={String(data.year)} />}
      >
        <Table
          rows={data.creators}
          empty="No creator activity this year."
          columns={[
            { label: 'Creator', render: (r) => r.name },
            { label: 'Stripe account', render: (r) => <span className="font-mono text-xs text-brand-ink/60">{r.connectedAccountId || '—'}</span> },
            { label: 'Gross fan payments', num: true, render: (r) => money(r.grossCents) },
            { label: 'Payments', num: true, render: (r) => r.salesCount.toLocaleString() },
            { label: 'Refunds + disputes', num: true, render: (r) => money(r.refundsCents + r.disputesCents) },
            { label: 'Paid to creator', num: true, render: (r) => money(r.paidToCreatorsCents) },
          ]}
        />
      </Section>

      <Notice tone="info">
        <p className="font-semibold">Before tax season</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Sales tax is only calculated where ByUs has registrations in Stripe Tax (Stripe Dashboard → Tax → Registrations). See TAX_SETUP.md in the repo.</li>
          <li>1099-K forms for creators are filed through Stripe Connect&rsquo;s tax reporting (Stripe Dashboard → Connect → Tax forms). Check it&rsquo;s turned on and that creators have given their tax details.</li>
          <li>Give your accountant the monthly and creator CSVs above. Stripe&rsquo;s own statements stay the official record.</li>
        </ul>
      </Notice>
    </>
  );
}
