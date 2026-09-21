// Read-side of the accounting ledger: every number on /admin/accounting and every CSV
// export comes from here. All amounts are integer cents. Periods are calendar months or
// years in UTC (matching how Stripe timestamps are stored).
//
// The core identity (see lib/accounting/categories.js): for any set of ledger rows,
//   fan payments + refunds + disputes + paid to creators + application fees
//     = what ByUs kept before Stripe's costs (sales tax included, so it's subtracted out)
// and subtracting Stripe's per-transaction fees and standalone service fees gives ByUs's
// real net revenue. Sum of net_cents over non-payout rows = net revenue + tax held.

import { query } from '@/lib/db';

// ---- Periods ---------------------------------------------------------------------------

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

export function parsePeriod(value, now = new Date()) {
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === 'all') {
    return { key: 'all', label: 'All time', from: null, to: null, kind: 'all' };
  }
  const month = /^(\d{4})-(\d{2})$/.exec(raw || current);
  if (month) {
    const y = Number(month[1]);
    const m = Number(month[2]);
    if (m >= 1 && m <= 12) {
      return {
        key: `${month[1]}-${month[2]}`,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
        from: new Date(Date.UTC(y, m - 1, 1)),
        to: new Date(Date.UTC(y, m, 1)),
        kind: 'month',
        year: y,
      };
    }
  }
  const year = /^(\d{4})$/.exec(raw);
  if (year) {
    const y = Number(year[1]);
    return { key: year[1], label: String(y), from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y + 1, 0, 1)), kind: 'year', year: y };
  }
  return parsePeriod(current, now);
}

// Recent months + years for the period picker.
export function periodOptions(now = new Date(), months = 12) {
  const options = [];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    options.push({ key, label: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}` });
  }
  const y = now.getUTCFullYear();
  options.push({ key: String(y), label: `${y} (year to date)` });
  options.push({ key: String(y - 1), label: String(y - 1) });
  options.push({ key: 'all', label: 'All time' });
  return options;
}

function rangeClause(period, column = 'l.created_at', startIndex = 1) {
  if (!period || period.kind === 'all') return { sql: 'TRUE', params: [] };
  return {
    sql: `${column} >= $${startIndex} AND ${column} < $${startIndex + 1}`,
    params: [period.from, period.to],
  };
}

// ---- Shared aggregation ----------------------------------------------------------------

const AGGREGATES = `
  COALESCE(SUM(l.amount_cents) FILTER (WHERE l.bucket = 'sales'), 0)::bigint AS sales,
  COUNT(*) FILTER (WHERE l.bucket = 'sales' AND l.amount_cents > 0)::int AS sales_count,
  COALESCE(SUM(l.tax_cents) FILTER (WHERE l.bucket = 'sales'), 0)::bigint AS tax,
  COALESCE(SUM(l.amount_cents) FILTER (WHERE l.bucket = 'refunds'), 0)::bigint AS refunds,
  COUNT(*) FILTER (WHERE l.bucket = 'refunds' AND l.amount_cents < 0)::int AS refund_count,
  COALESCE(SUM(l.amount_cents) FILTER (WHERE l.bucket = 'disputes'), 0)::bigint AS disputes,
  COUNT(*) FILTER (WHERE l.bucket = 'disputes' AND l.amount_cents < 0)::int AS dispute_count,
  COALESCE(SUM(l.amount_cents) FILTER (WHERE l.bucket = 'creator_transfers'), 0)::bigint AS creator_transfers,
  COALESCE(SUM(l.amount_cents) FILTER (WHERE l.bucket = 'platform_fees'), 0)::bigint AS app_fees,
  COALESCE(SUM(l.fee_cents) FILTER (WHERE l.bucket <> 'payouts'), 0)::bigint AS processing_fees,
  COALESCE(SUM(l.fee_cents) FILTER (WHERE l.bucket = 'disputes'), 0)::bigint AS dispute_fees,
  COALESCE(-SUM(l.amount_cents) FILTER (WHERE l.bucket = 'stripe_fees'), 0)::bigint AS service_fees,
  COALESCE(SUM(l.amount_cents) FILTER (WHERE l.bucket = 'other'), 0)::bigint AS other,
  COALESCE(SUM(l.net_cents) FILTER (WHERE l.bucket <> 'payouts'), 0)::bigint AS cash_kept,
  COALESCE(-SUM(l.amount_cents) FILTER (WHERE l.bucket = 'payouts'), 0)::bigint AS bank_payouts
`;

function shape(row) {
  const n = (key) => Number(row?.[key] || 0);
  const sales = n('sales');
  const tax = n('tax');
  const refunds = n('refunds');
  const disputes = n('disputes');
  const creatorTransfers = n('creator_transfers');
  const appFees = n('app_fees');
  const processingFees = n('processing_fees');
  const serviceFees = n('service_fees');
  const other = n('other');
  const byusFees = sales + refunds + disputes + creatorTransfers + appFees - tax;
  const stripeCosts = processingFees + serviceFees;
  const netRevenue = byusFees - stripeCosts + other;
  const netSales = sales - tax + refunds + disputes;
  return {
    grossCents: sales,
    salesCount: n('sales_count'),
    taxCents: tax,
    refundsCents: refunds,
    refundCount: n('refund_count'),
    disputesCents: disputes,
    disputeCount: n('dispute_count'),
    paidToCreatorsCents: -creatorTransfers,
    appFeeRowsCents: appFees,
    byusFeesCents: byusFees,
    processingFeesCents: processingFees,
    disputeFeesCents: n('dispute_fees'),
    serviceFeesCents: serviceFees,
    stripeCostsCents: stripeCosts,
    otherCents: other,
    netRevenueCents: netRevenue,
    netSalesCents: netSales,
    cashKeptCents: n('cash_kept'),
    bankPayoutsCents: n('bank_payouts'),
    effectiveTakePercent: netSales > 0 ? (byusFees / netSales) * 100 : null,
    marginPercent: byusFees > 0 ? (netRevenue / byusFees) * 100 : null,
  };
}

// ---- Overview --------------------------------------------------------------------------

export async function getSummary(period) {
  const range = rangeClause(period);
  const [totals, kinds] = await Promise.all([
    query(`SELECT ${AGGREGATES} FROM ledger_transactions l WHERE ${range.sql}`, range.params),
    query(
      `SELECT COALESCE(l.payment_kind, 'other') AS kind, COUNT(*)::int AS count,
              COALESCE(SUM(l.amount_cents), 0)::bigint AS gross
         FROM ledger_transactions l
        WHERE l.bucket = 'sales' AND ${range.sql}
        GROUP BY 1 ORDER BY 3 DESC`,
      range.params
    ),
  ]);
  return {
    ...shape(totals.rows[0]),
    byKind: kinds.rows.map((r) => ({ kind: r.kind, count: r.count, grossCents: Number(r.gross) })),
  };
}

export async function getSyncStatus() {
  const [state, counts] = await Promise.all([
    query(`SELECT * FROM accounting_sync_state WHERE key = 'stripe'`),
    query(`SELECT COUNT(*)::int AS rows, MIN(created_at) AS first_at, MAX(created_at) AS last_at FROM ledger_transactions`),
  ]);
  const s = state.rows[0] || {};
  const c = counts.rows[0] || {};
  const lastFinished = s.last_finished_at ? new Date(s.last_finished_at) : null;
  return {
    lastStartedAt: s.last_started_at || null,
    lastFinishedAt: lastFinished,
    lastError: s.last_error || null,
    historyComplete: Boolean(s.history_complete),
    running: Boolean(s.last_started_at && (!lastFinished || lastFinished < new Date(s.last_started_at))),
    stale: !lastFinished || Date.now() - lastFinished.getTime() > 36 * 60 * 60 * 1000,
    platformBalance: s.details?.platformBalance || null,
    lastResult: s.details?.lastResult || null,
    ledgerRows: c.rows || 0,
    firstTransactionAt: c.first_at || null,
    lastTransactionAt: c.last_at || null,
  };
}

// ---- Statements ------------------------------------------------------------------------

export async function getMonthlyStatements(period) {
  const range = rangeClause(period);
  const result = await query(
    `SELECT to_char(date_trunc('month', l.created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month, ${AGGREGATES}
       FROM ledger_transactions l
      WHERE ${range.sql}
      GROUP BY 1 ORDER BY 1 DESC`,
    range.params
  );
  return result.rows.map((row) => ({ month: row.month, ...shape(row) }));
}

// ---- Creators --------------------------------------------------------------------------

export async function getCreatorBreakdown(period) {
  const range = rangeClause(period);
  const payoutRange = rangeClause(period, 'p.created_at', range.params.length + 1);
  const result = await query(
    `WITH activity AS (
       SELECT l.creator_id, ${AGGREGATES}
         FROM ledger_transactions l
        WHERE l.creator_id IS NOT NULL AND ${range.sql}
        GROUP BY l.creator_id
     ),
     payouts AS (
       SELECT p.creator_id,
              COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'paid'), 0)::bigint AS paid_out,
              COUNT(*) FILTER (WHERE p.status IN ('failed', 'canceled'))::int AS failed_payouts
         FROM creator_payouts p
        WHERE ${payoutRange.sql}
        GROUP BY p.creator_id
     ),
     ids AS (
       SELECT creator_id FROM activity
       UNION SELECT creator_id FROM payouts WHERE creator_id IS NOT NULL
       UNION SELECT creator_id FROM creator_balances WHERE available_cents <> 0 OR pending_cents <> 0
     )
     SELECT u.id, u.display_name, u.email, u.platform_fee_percent, u.stripe_connect_account_id,
            a.*, COALESCE(po.paid_out, 0)::bigint AS paid_out, COALESCE(po.failed_payouts, 0)::int AS failed_payouts,
            b.available_cents, b.pending_cents, b.synced_at AS balance_synced_at
       FROM ids
       JOIN users u ON u.id = ids.creator_id
       LEFT JOIN activity a ON a.creator_id = u.id
       LEFT JOIN payouts po ON po.creator_id = u.id
       LEFT JOIN creator_balances b ON b.creator_id = u.id
      ORDER BY COALESCE(a.sales, 0) DESC, u.display_name`,
    [...range.params, ...payoutRange.params]
  );
  return result.rows.map((row) => ({
    creatorId: row.id,
    name: row.display_name || row.email,
    email: row.email,
    currentFeePercent: row.platform_fee_percent,
    connectedAccountId: row.stripe_connect_account_id,
    ...shape(row),
    creatorStripeFeesCents: Number(row.processing_fees || 0),
    paidOutCents: Number(row.paid_out || 0),
    failedPayouts: row.failed_payouts,
    balanceAvailableCents: row.available_cents === null ? null : Number(row.available_cents),
    balancePendingCents: row.pending_cents === null ? null : Number(row.pending_cents),
    balanceSyncedAt: row.balance_synced_at,
  }));
}

// ---- Transactions ----------------------------------------------------------------------

export const PAGE_SIZE = 100;

export async function getTransactions(period, { bucket, creatorId, page = 1, limit = PAGE_SIZE } = {}) {
  const range = rangeClause(period);
  const params = [...range.params];
  const where = [range.sql];
  if (bucket) {
    params.push(bucket);
    where.push(`l.bucket = $${params.length}`);
  }
  if (creatorId) {
    params.push(creatorId);
    where.push(`l.creator_id = $${params.length}`);
  }
  const whereSql = where.join(' AND ');
  const offset = Math.max(0, (page - 1) * limit);
  const [rows, total] = await Promise.all([
    query(
      `SELECT l.*, c.display_name AS creator_name, c.email AS creator_email,
              f.display_name AS fan_name, f.email AS fan_email
         FROM ledger_transactions l
         LEFT JOIN users c ON c.id = l.creator_id
         LEFT JOIN users f ON f.id = l.fan_id
        WHERE ${whereSql}
        ORDER BY l.created_at DESC, l.id
        LIMIT ${Number(limit)} OFFSET ${offset}`,
      params
    ),
    query(`SELECT COUNT(*)::int AS n FROM ledger_transactions l WHERE ${whereSql}`, params),
  ]);
  return { rows: rows.rows.map(transactionRow), total: total.rows[0].n, page, limit };
}

function transactionRow(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    availableOn: r.available_on,
    type: r.type,
    bucket: r.bucket,
    kind: r.payment_kind,
    status: r.status,
    description: r.description,
    amountCents: Number(r.amount_cents),
    feeCents: Number(r.fee_cents),
    netCents: Number(r.net_cents),
    taxCents: Number(r.tax_cents),
    currency: r.currency,
    chargeId: r.charge_id,
    sourceId: r.source_id,
    invoiceId: r.stripe_invoice_id,
    creatorId: r.creator_id,
    creatorName: r.creator_name || r.creator_email || null,
    fanName: r.fan_name || r.fan_email || null,
  };
}

// ---- Payouts ---------------------------------------------------------------------------

export async function getPayouts(period) {
  const range = rangeClause(period);
  const creatorRange = rangeClause(period, 'p.created_at');
  const [bank, creators] = await Promise.all([
    query(
      `SELECT l.id, l.type, l.amount_cents, l.status, l.created_at, l.available_on, l.source_id, l.description
         FROM ledger_transactions l
        WHERE l.bucket = 'payouts' AND ${range.sql}
        ORDER BY l.created_at DESC`,
      range.params
    ),
    query(
      `SELECT p.*, u.display_name, u.email
         FROM creator_payouts p
         LEFT JOIN users u ON u.id = p.creator_id
        WHERE ${creatorRange.sql}
        ORDER BY p.created_at DESC`,
      creatorRange.params
    ),
  ]);
  return {
    bank: bank.rows.map((r) => ({
      id: r.source_id || r.id,
      type: r.type,
      amountCents: -Number(r.amount_cents),
      status: r.status,
      createdAt: r.created_at,
      arrivalDate: r.available_on,
      description: r.description,
    })),
    creators: creators.rows.map((r) => ({
      id: r.id,
      creatorId: r.creator_id,
      creatorName: r.display_name || r.email || r.connected_account_id,
      amountCents: Number(r.amount_cents),
      status: r.status,
      method: r.method,
      createdAt: r.created_at,
      arrivalDate: r.arrival_date,
      failureMessage: r.failure_message,
    })),
  };
}

// ---- Refunds & disputes ----------------------------------------------------------------

export async function getRefundsAndDisputes(period) {
  const range = rangeClause(period);
  const disputeRange = rangeClause(period, 'd.opened_at');
  const [ledger, disputes] = await Promise.all([
    query(
      `SELECT l.*, c.display_name AS creator_name, c.email AS creator_email,
              f.display_name AS fan_name, f.email AS fan_email
         FROM ledger_transactions l
         LEFT JOIN users c ON c.id = l.creator_id
         LEFT JOIN users f ON f.id = l.fan_id
        WHERE l.bucket IN ('refunds', 'disputes') AND ${range.sql}
        ORDER BY l.created_at DESC`,
      range.params
    ),
    query(
      `SELECT d.*, c.display_name AS creator_name, f.display_name AS fan_name, f.email AS fan_email
         FROM stripe_disputes d
         LEFT JOIN users c ON c.id = d.creator_id
         LEFT JOIN users f ON f.id = d.fan_id
        WHERE ${disputeRange.sql}
        ORDER BY d.opened_at DESC NULLS LAST`,
      disputeRange.params
    ),
  ]);
  return {
    movements: ledger.rows.map(transactionRow),
    disputes: disputes.rows.map((d) => ({
      id: d.stripe_dispute_id,
      chargeId: d.stripe_charge_id,
      amountCents: Number(d.amount_cents || 0),
      currency: d.currency,
      reason: d.reason,
      status: d.status,
      openedAt: d.opened_at,
      closedAt: d.closed_at,
      responseDueAt: d.response_due_at,
      creatorName: d.creator_name,
      fanName: d.fan_name || d.fan_email,
    })),
  };
}

// ---- Tax / year-end ----------------------------------------------------------------------

export async function getTaxYear(year) {
  const period = parsePeriod(String(year));
  const range = rangeClause(period);
  const [months, creators, totals] = await Promise.all([
    getMonthlyStatements(period),
    query(
      `SELECT u.id, u.display_name, u.email, u.stripe_connect_account_id, ${AGGREGATES}
         FROM ledger_transactions l
         JOIN users u ON u.id = l.creator_id
        WHERE ${range.sql}
        GROUP BY u.id
        ORDER BY sales DESC`,
      range.params
    ),
    getSummary(period),
  ]);
  return {
    year: period.year,
    totals,
    months: months.sort((a, b) => a.month.localeCompare(b.month)),
    creators: creators.rows.map((r) => ({
      creatorId: r.id,
      name: r.display_name || r.email,
      email: r.email,
      connectedAccountId: r.stripe_connect_account_id,
      ...shape(r),
    })),
  };
}

// ---- Reconciliation ------------------------------------------------------------------------

export async function getReconciliation() {
  const status = await getSyncStatus();
  const checks = [];

  checks.push({
    key: 'sync',
    title: 'Stripe sync is current',
    status: status.lastError ? 'error' : status.stale ? 'warn' : 'ok',
    detail: status.lastFinishedAt
      ? `Last finished ${new Date(status.lastFinishedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC` +
        (status.lastError ? ` — ${status.lastError}` : '')
      : 'The sync has never run. Press "Sync now".',
    items: [],
  });

  const [missingInByUs, missingInStripe, fees, unattributed, failedPayouts, ledgerNet] = await Promise.all([
    query(
      `SELECT l.id, l.charge_id, l.stripe_invoice_id, l.payment_kind, l.amount_cents, l.created_at, u.display_name
         FROM ledger_transactions l
         LEFT JOIN users u ON u.id = l.creator_id
        WHERE l.bucket = 'sales' AND l.amount_cents > 0 AND (
              (l.payment_kind = 'subscription' AND NOT EXISTS
                 (SELECT 1 FROM creator_earnings ce WHERE ce.stripe_invoice_id = l.stripe_invoice_id))
           OR (l.payment_kind = 'tip' AND NOT EXISTS
                 (SELECT 1 FROM transactions t WHERE t.stripe_charge_id = l.charge_id))
           OR (l.payment_kind = 'product' AND NOT EXISTS
                 (SELECT 1 FROM digital_purchases dp WHERE dp.stripe_charge_id = l.charge_id))
           OR COALESCE(l.payment_kind, 'other') = 'other')
        ORDER BY l.created_at DESC LIMIT 50`
    ),
    status.lastFinishedAt
      ? query(
          `SELECT ce.id, ce.stripe_invoice_id, ce.amount_cents, ce.created_at, u.display_name
             FROM creator_earnings ce
             LEFT JOIN users u ON u.id = ce.creator_id
            WHERE ce.created_at >= COALESCE((SELECT MIN(created_at) FROM ledger_transactions), now())
              AND ce.created_at < $1::timestamptz - interval '1 hour'
              AND NOT EXISTS (
                SELECT 1 FROM ledger_transactions l
                 WHERE l.bucket = 'sales'
                   AND (l.stripe_invoice_id = ce.stripe_invoice_id
                        OR l.payment_intent_id = regexp_replace(ce.stripe_invoice_id, '^(tip|product)_', '')))
            ORDER BY ce.created_at DESC LIMIT 50`,
          [status.lastFinishedAt]
        )
      : Promise.resolve({ rows: [] }),
    query(
      `WITH per_charge AS (
         SELECT l.charge_id,
                MIN(l.created_at) AS created_at,
                MAX(l.creator_id::text) AS creator_id,
                MAX(l.stripe_invoice_id) AS invoice_id,
                MAX(l.payment_intent_id) AS payment_intent_id,
                SUM(l.amount_cents) FILTER (WHERE l.type IN ('charge', 'payment')) AS gross,
                SUM(l.amount_cents) FILTER (WHERE l.type IN ('charge', 'payment', 'transfer', 'application_fee')) AS kept,
                MAX(l.tax_cents) AS tax
           FROM ledger_transactions l
          WHERE l.charge_id IS NOT NULL
          GROUP BY l.charge_id
       )
       SELECT pc.*, ce.fee_percent_applied, u.display_name
         FROM per_charge pc
         JOIN creator_earnings ce
           ON ce.stripe_invoice_id = pc.invoice_id
           OR ce.stripe_invoice_id = 'tip_' || pc.payment_intent_id
           OR ce.stripe_invoice_id = 'product_' || pc.payment_intent_id
         LEFT JOIN users u ON u.id::text = pc.creator_id
        WHERE pc.gross > 0 AND ce.fee_percent_applied IS NOT NULL
        ORDER BY pc.created_at DESC
        LIMIT 500`
    ),
    query(
      `SELECT l.id, l.type, l.bucket, l.amount_cents, l.created_at, l.charge_id, l.connected_account_id
         FROM ledger_transactions l
        WHERE l.creator_id IS NULL AND l.bucket IN ('sales', 'refunds', 'disputes', 'creator_transfers')
        ORDER BY l.created_at DESC LIMIT 50`
    ),
    query(
      `SELECT p.id, p.amount_cents, p.status, p.failure_message, p.created_at, u.display_name
         FROM creator_payouts p LEFT JOIN users u ON u.id = p.creator_id
        WHERE p.status IN ('failed', 'canceled')
        ORDER BY p.created_at DESC LIMIT 50`
    ),
    query(`SELECT COALESCE(SUM(net_cents), 0)::bigint AS net FROM ledger_transactions`),
  ]);

  checks.push({
    key: 'missing_in_byus',
    title: 'Every Stripe payment is recorded in ByUs',
    status: missingInByUs.rows.length ? 'warn' : 'ok',
    detail: missingInByUs.rows.length
      ? `${missingInByUs.rows.length} payment(s) in Stripe have no matching ByUs earnings record (missed webhook, or a payment not made through ByUs checkout).`
      : 'All synced Stripe payments match a ByUs record.',
    items: missingInByUs.rows.map((r) => ({
      label: `${r.charge_id || r.id} · ${r.payment_kind || 'unknown'}${r.display_name ? ` · ${r.display_name}` : ''}`,
      amountCents: Number(r.amount_cents),
      at: r.created_at,
    })),
  });

  checks.push({
    key: 'missing_in_stripe',
    title: 'Every ByUs earnings record exists in Stripe',
    status: missingInStripe.rows.length ? 'warn' : 'ok',
    detail: missingInStripe.rows.length
      ? `${missingInStripe.rows.length} ByUs earnings record(s) have no matching Stripe payment.`
      : 'All ByUs earnings records since the ledger began match a Stripe payment.',
    items: missingInStripe.rows.map((r) => ({
      label: `${r.stripe_invoice_id}${r.display_name ? ` · ${r.display_name}` : ''}`,
      amountCents: Number(r.amount_cents),
      at: r.created_at,
    })),
  });

  const feeMismatches = fees.rows.filter((r) => {
    const gross = Number(r.gross);
    const tax = Number(r.tax || 0);
    const kept = Number(r.kept || 0);
    const pct = Number(r.fee_percent_applied);
    const candidates = [
      Math.round((gross * pct) / 100),
      Math.round(((gross - tax) * pct) / 100),
    ];
    const withTax = candidates.flatMap((c) => [c, c + tax]);
    return !withTax.some((c) => Math.abs(c - kept) <= 1);
  });
  checks.push({
    key: 'fee_rate',
    title: 'ByUs kept the right fee on each payment',
    status: feeMismatches.length ? 'warn' : 'ok',
    detail: feeMismatches.length
      ? `${feeMismatches.length} payment(s) where the amount ByUs kept doesn't match the fee rate recorded for it.`
      : `Checked ${fees.rows.length} payment(s) against their recorded fee rate.`,
    items: feeMismatches.slice(0, 50).map((r) => ({
      label: `${r.charge_id}${r.display_name ? ` · ${r.display_name}` : ''} · expected ${r.fee_percent_applied}% of ${(Number(r.gross) / 100).toFixed(2)}`,
      amountCents: Number(r.kept),
      at: r.created_at,
    })),
  });

  checks.push({
    key: 'unattributed',
    title: 'Every payment is linked to a creator',
    status: unattributed.rows.length ? 'warn' : 'ok',
    detail: unattributed.rows.length
      ? `${unattributed.rows.length} transaction(s) couldn't be matched to a ByUs creator account.`
      : 'All creator-related transactions are linked to a creator.',
    items: unattributed.rows.map((r) => ({
      label: `${r.id} · ${r.type}${r.connected_account_id ? ` · ${r.connected_account_id}` : ''}`,
      amountCents: Number(r.amount_cents),
      at: r.created_at,
    })),
  });

  checks.push({
    key: 'creator_payouts',
    title: 'Creator payouts are landing',
    status: failedPayouts.rows.length ? 'error' : 'ok',
    detail: failedPayouts.rows.length
      ? `${failedPayouts.rows.length} creator payout(s) failed or were canceled — the creator likely needs to fix their bank details in Stripe.`
      : 'No failed creator payouts.',
    items: failedPayouts.rows.map((r) => ({
      label: `${r.display_name || 'Unknown creator'} · ${r.status}${r.failure_message ? ` · ${r.failure_message}` : ''}`,
      amountCents: Number(r.amount_cents),
      at: r.created_at,
    })),
  });

  const balance = status.platformBalance;
  const ledgerBalance = Number(ledgerNet.rows[0].net);
  const stripeBalance = balance ? Number(balance.availableCents) + Number(balance.pendingCents) : null;
  const balanceDiff = stripeBalance === null ? null : stripeBalance - ledgerBalance;
  checks.push({
    key: 'balance',
    title: 'Ledger matches the Stripe balance',
    status: !status.historyComplete || stripeBalance === null ? 'warn' : Math.abs(balanceDiff) <= 1 ? 'ok' : 'error',
    detail: !status.historyComplete
      ? 'The full Stripe history has not been synced yet.'
      : stripeBalance === null
        ? 'Stripe balance not available yet — run a sync.'
        : Math.abs(balanceDiff) <= 1
          ? `Stripe balance and ledger both total ${(ledgerBalance / 100).toFixed(2)} USD.`
          : `Stripe balance is ${(stripeBalance / 100).toFixed(2)} USD but the ledger adds up to ${(ledgerBalance / 100).toFixed(2)} USD (difference ${(balanceDiff / 100).toFixed(2)}). Non-USD activity or a sync gap can cause this.`,
    items: [],
    ledgerBalanceCents: ledgerBalance,
    stripeBalanceCents: stripeBalance,
  });

  return { status, checks };
}
