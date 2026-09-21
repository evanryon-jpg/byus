// Copies ByUs's money records out of Stripe into local tables so /admin/accounting can
// report real numbers:
//
//   ledger_transactions  every balance transaction on the ByUs platform account
//   creator_payouts      payouts from each creator's connected account to their bank
//   creator_balances     each creator's current connected-account balance
//   accounting_sync_state.details.platformBalance   ByUs's own Stripe balance
//
// Runs daily from /api/cron/accounting-sync and on demand from the "Sync now" button.
// Safe to re-run: every write is an upsert keyed on Stripe's own IDs, and each run
// re-reads the last 7 days so pending -> available status changes are picked up.
// Nothing here writes to Stripe.

import { query, withTransaction } from '@/lib/db';
import { paymentProvider } from '@/lib/payments';
import { bucketFor } from './categories';

const OVERLAP_SECONDS = 7 * 24 * 60 * 60;
const PAYOUT_OVERLAP_SECONDS = 30 * 24 * 60 * 60;
const STALE_LOCK_MINUTES = 10;

const idOf = (value) => (typeof value === 'string' ? value : value?.id || null);
const toDate = (unix) => (unix ? new Date(unix * 1000) : null);

// Pull the IDs we care about out of an expanded balance-transaction source.
function describeSource(source) {
  if (!source || typeof source === 'string') return {};
  switch (source.object) {
    case 'charge':
      return { chargeId: source.id, charge: source };
    case 'refund':
      return { chargeId: idOf(source.charge) };
    case 'transfer':
      return { accountId: idOf(source.destination), chargeId: idOf(source.source_transaction) };
    case 'transfer_reversal':
      return { transferId: idOf(source.transfer) };
    case 'application_fee':
      return { accountId: idOf(source.account), chargeId: idOf(source.originating_transaction) };
    case 'fee_refund':
      return { applicationFeeId: idOf(source.fee) };
    case 'dispute':
      return { chargeId: idOf(source.charge) };
    default:
      return {};
  }
}

function kindFromCharge(charge) {
  if (charge.invoice) return 'subscription';
  const type = charge.payment_intent?.metadata?.type || charge.metadata?.type;
  if (type === 'tip') return 'tip';
  if (type === 'digital_product') return 'product';
  return 'other';
}

function invoiceTax(invoice) {
  if (!invoice || typeof invoice === 'string') return 0;
  if (typeof invoice.tax === 'number') return invoice.tax;
  return (invoice.total_tax_amounts || []).reduce((sum, t) => sum + (t.amount || 0), 0);
}

// Everything the ledger needs to know about one platform charge.
async function loadChargeInfo(chargeId, provider) {
  const charge = await provider.retrieveChargeForLedger({ id: chargeId });
  const invoice = typeof charge.invoice === 'object' ? charge.invoice : null;
  const paymentIntent = typeof charge.payment_intent === 'object' ? charge.payment_intent : null;
  let taxCents = invoiceTax(invoice);
  if (!invoice && paymentIntent) {
    try {
      taxCents = (await provider.findCheckoutSessionTaxByPaymentIntent({ paymentIntentId: paymentIntent.id })) || 0;
    } catch (err) {
      console.error(`accounting-sync: could not read tax for ${chargeId}:`, err.message);
    }
  }
  const meta = {
    ...(invoice?.subscription_details?.metadata || {}),
    ...(paymentIntent?.metadata || {}),
  };
  return {
    accountId: idOf(charge.transfer_data?.destination) || idOf(charge.destination),
    customerId: idOf(charge.customer),
    invoiceId: idOf(charge.invoice),
    paymentIntentId: idOf(charge.payment_intent),
    kind: kindFromCharge(charge),
    taxCents,
    creatorMeta: meta.creator_id || null,
    fanMeta: meta.fan_id || null,
  };
}

// Claim the sync "lock" (a row flag, since pooled connections can't hold session locks).
async function claimRun() {
  const result = await query(
    `UPDATE accounting_sync_state
        SET last_started_at = now()
      WHERE key = 'stripe'
        AND (last_started_at IS NULL
             OR (last_finished_at IS NOT NULL AND last_finished_at >= last_started_at)
             OR last_started_at < now() - ($1 || ' minutes')::interval)
      RETURNING cursor_created, history_complete, details`,
    [String(STALE_LOCK_MINUTES)]
  );
  return result.rows[0] || null;
}

export async function runAccountingSync({ provider = paymentProvider } = {}) {
  const state = await claimRun();
  if (!state) return { ok: false, skipped: true, reason: 'A sync is already running.' };

  const errors = [];
  const summary = { transactions: 0, payouts: 0, creatorsChecked: 0 };
  let newCursor = state.cursor_created ? Number(state.cursor_created) : null;
  const details = { ...(state.details || {}) };
  let historyComplete = state.history_complete;

  try {
    // ---- 1. Platform balance transactions --------------------------------------------
    const createdGte = newCursor ? newCursor - OVERLAP_SECONDS : undefined;
    const bts = await provider.listBalanceTransactions({ createdGte });

    const rows = bts.map((bt) => ({
      bt,
      link: describeSource(bt.source),
    }));

    // Resolve reversals and fee refunds back to their transfer / application fee.
    const transferCache = new Map();
    const feeCache = new Map();
    for (const row of rows) {
      if (row.link.transferId) {
        if (!transferCache.has(row.link.transferId)) {
          transferCache.set(row.link.transferId, await provider.retrieveTransfer({ id: row.link.transferId }));
        }
        const transfer = transferCache.get(row.link.transferId);
        row.link.accountId = idOf(transfer.destination);
        row.link.chargeId = idOf(transfer.source_transaction);
      }
      if (row.link.applicationFeeId) {
        if (!feeCache.has(row.link.applicationFeeId)) {
          feeCache.set(row.link.applicationFeeId, await provider.retrieveApplicationFee({ id: row.link.applicationFeeId }));
        }
        const fee = feeCache.get(row.link.applicationFeeId);
        row.link.accountId = idOf(fee.account);
        row.link.chargeId = idOf(fee.originating_transaction);
      }
    }

    // Charge details: reuse what's already in the ledger, fetch the rest from Stripe.
    const chargeIds = [...new Set(rows.map((r) => r.link.chargeId).filter((id) => id && id.startsWith('ch_')))];
    const chargeInfo = new Map();
    if (chargeIds.length) {
      const known = await query(
        `SELECT DISTINCT ON (charge_id) charge_id, connected_account_id, stripe_invoice_id, payment_intent_id,
                payment_kind, tax_cents, creator_id, fan_id
           FROM ledger_transactions
          WHERE charge_id = ANY($1) AND bucket = 'sales'
          ORDER BY charge_id, created_at`,
        [chargeIds]
      );
      for (const k of known.rows) {
        chargeInfo.set(k.charge_id, {
          accountId: k.connected_account_id,
          invoiceId: k.stripe_invoice_id,
          paymentIntentId: k.payment_intent_id,
          kind: k.payment_kind,
          taxCents: Number(k.tax_cents),
          creatorId: k.creator_id,
          fanId: k.fan_id,
        });
      }
    }
    for (const id of chargeIds) {
      if (chargeInfo.has(id)) continue;
      try {
        chargeInfo.set(id, await loadChargeInfo(id, provider));
      } catch (err) {
        errors.push(`charge ${id}: ${err.message}`);
      }
    }

    // Map Stripe accounts/customers (and metadata user ids) to ByUs users.
    const accountIds = new Set();
    const customerIds = new Set();
    const metaIds = new Set();
    for (const row of rows) if (row.link.accountId) accountIds.add(row.link.accountId);
    for (const info of chargeInfo.values()) {
      if (info.accountId) accountIds.add(info.accountId);
      if (info.customerId) customerIds.add(info.customerId);
      if (info.creatorMeta) metaIds.add(info.creatorMeta);
      if (info.fanMeta) metaIds.add(info.fanMeta);
    }
    const users = await query(
      `SELECT id, stripe_connect_account_id, stripe_customer_id FROM users
        WHERE stripe_connect_account_id = ANY($1) OR stripe_customer_id = ANY($2) OR id::text = ANY($3)`,
      [[...accountIds], [...customerIds], [...metaIds]]
    );
    const byAccount = new Map();
    const byCustomer = new Map();
    const knownIds = new Set();
    for (const u of users.rows) {
      if (u.stripe_connect_account_id) byAccount.set(u.stripe_connect_account_id, u.id);
      if (u.stripe_customer_id) byCustomer.set(u.stripe_customer_id, u.id);
      knownIds.add(u.id);
    }

    const records = rows.map(({ bt, link }) => {
      const bucket = bucketFor(bt.type, bt.reporting_category);
      const info = link.chargeId ? chargeInfo.get(link.chargeId) : null;
      const accountId = link.accountId || info?.accountId || null;
      const creatorId =
        (accountId && byAccount.get(accountId)) ||
        info?.creatorId ||
        (info?.creatorMeta && knownIds.has(info.creatorMeta) ? info.creatorMeta : null);
      const fanId =
        info?.fanId ||
        (info?.customerId && byCustomer.get(info.customerId)) ||
        (info?.fanMeta && knownIds.has(info.fanMeta) ? info.fanMeta : null);
      return {
        id: bt.id,
        type: bt.type,
        reportingCategory: bt.reporting_category || null,
        bucket,
        amount: bt.amount,
        fee: bt.fee || 0,
        net: bt.net,
        currency: bt.currency || 'usd',
        status: bt.status || null,
        createdAt: toDate(bt.created),
        availableOn: toDate(bt.available_on),
        sourceId: idOf(bt.source),
        description: bt.description || null,
        feeDetails: JSON.stringify(bt.fee_details || []),
        chargeId: link.chargeId || null,
        invoiceId: info?.invoiceId || null,
        paymentIntentId: info?.paymentIntentId || null,
        accountId,
        creatorId: creatorId || null,
        fanId: fanId || null,
        kind: info?.kind || null,
        taxCents: bucket === 'sales' ? info?.taxCents || 0 : 0,
      };
    });

    await withTransaction(async (client) => {
      for (const r of records) {
        await client.query(
          `INSERT INTO ledger_transactions
             (id, type, reporting_category, bucket, amount_cents, fee_cents, net_cents, currency, status,
              created_at, available_on, source_id, description, fee_details, charge_id, stripe_invoice_id,
              payment_intent_id, connected_account_id, creator_id, fan_id, payment_kind, tax_cents, synced_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,$22, now())
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             available_on = EXCLUDED.available_on,
             bucket = EXCLUDED.bucket,
             charge_id = COALESCE(EXCLUDED.charge_id, ledger_transactions.charge_id),
             stripe_invoice_id = COALESCE(EXCLUDED.stripe_invoice_id, ledger_transactions.stripe_invoice_id),
             payment_intent_id = COALESCE(EXCLUDED.payment_intent_id, ledger_transactions.payment_intent_id),
             connected_account_id = COALESCE(EXCLUDED.connected_account_id, ledger_transactions.connected_account_id),
             creator_id = COALESCE(EXCLUDED.creator_id, ledger_transactions.creator_id),
             fan_id = COALESCE(EXCLUDED.fan_id, ledger_transactions.fan_id),
             payment_kind = COALESCE(EXCLUDED.payment_kind, ledger_transactions.payment_kind),
             tax_cents = GREATEST(EXCLUDED.tax_cents, ledger_transactions.tax_cents),
             synced_at = now()`,
          [
            r.id, r.type, r.reportingCategory, r.bucket, r.amount, r.fee, r.net, r.currency, r.status,
            r.createdAt, r.availableOn, r.sourceId, r.description, r.feeDetails, r.chargeId, r.invoiceId,
            r.paymentIntentId, r.accountId, r.creatorId, r.fanId, r.kind, r.taxCents,
          ]
        );
      }
    });
    summary.transactions = records.length;
    for (const bt of bts) if (!newCursor || bt.created > newCursor) newCursor = bt.created;
    if (!state.cursor_created) historyComplete = true;

    // ---- 2. Creator payouts and balances ----------------------------------------------
    const creators = await query(
      `SELECT id, stripe_connect_account_id FROM users
        WHERE stripe_connect_account_id IS NOT NULL AND stripe_connect_onboarded = true`
    );
    const payoutCursor = details.payoutCursor ? Number(details.payoutCursor) : null;
    let newPayoutCursor = payoutCursor;
    for (const creator of creators.rows) {
      summary.creatorsChecked += 1;
      try {
        const payouts = await provider.listConnectedAccountPayouts({
          accountId: creator.stripe_connect_account_id,
          createdGte: payoutCursor ? payoutCursor - PAYOUT_OVERLAP_SECONDS : undefined,
        });
        for (const p of payouts) {
          await query(
            `INSERT INTO creator_payouts
               (id, creator_id, connected_account_id, amount_cents, currency, status, method,
                arrival_date, created_at, failure_message, synced_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
             ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, arrival_date = EXCLUDED.arrival_date,
               failure_message = EXCLUDED.failure_message, synced_at = now()`,
            [
              p.id, creator.id, creator.stripe_connect_account_id, p.amount, p.currency || 'usd', p.status,
              p.method || null, toDate(p.arrival_date), toDate(p.created), p.failure_message || null,
            ]
          );
          summary.payouts += 1;
          if (!newPayoutCursor || p.created > newPayoutCursor) newPayoutCursor = p.created;
        }
        const balance = await provider.retrieveBalanceSummary({ accountId: creator.stripe_connect_account_id });
        await query(
          `INSERT INTO creator_balances (creator_id, connected_account_id, available_cents, pending_cents, synced_at)
           VALUES ($1,$2,$3,$4, now())
           ON CONFLICT (creator_id) DO UPDATE SET connected_account_id = EXCLUDED.connected_account_id,
             available_cents = EXCLUDED.available_cents, pending_cents = EXCLUDED.pending_cents, synced_at = now()`,
          [creator.id, creator.stripe_connect_account_id, balance.availableCents, balance.pendingCents]
        );
      } catch (err) {
        errors.push(`creator ${creator.id}: ${err.message}`);
      }
    }
    if (newPayoutCursor) details.payoutCursor = newPayoutCursor;

    // ---- 3. ByUs's own balance ----------------------------------------------------------
    try {
      details.platformBalance = { ...(await provider.retrieveBalanceSummary()), at: new Date().toISOString() };
    } catch (err) {
      errors.push(`platform balance: ${err.message}`);
    }

    details.lastResult = { ...summary, errors: errors.slice(0, 20), finishedAt: new Date().toISOString() };
    await query(
      `UPDATE accounting_sync_state
          SET cursor_created = $1, history_complete = $2, last_finished_at = now(), last_error = $3, details = $4::jsonb
        WHERE key = 'stripe'`,
      [newCursor, historyComplete, errors.length ? errors.slice(0, 5).join(' | ') : null, JSON.stringify(details)]
    );
    return { ok: errors.length === 0, ...summary, errors };
  } catch (err) {
    await query(
      `UPDATE accounting_sync_state SET last_finished_at = now(), last_error = $1 WHERE key = 'stripe'`,
      [String(err.message || err).slice(0, 1000)]
    );
    throw err;
  }
}
