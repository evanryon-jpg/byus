// CSV builders for /api/admin/accounting/export. Money columns are plain decimal dollars
// (e.g. 12.34) so spreadsheets and bookkeeping tools read them as numbers.

import {
  getSummary,
  getMonthlyStatements,
  getCreatorBreakdown,
  getTransactions,
  getPayouts,
  getRefundsAndDisputes,
  getTaxYear,
  getReconciliation,
} from './reports';
import { BUCKET_LABELS, KIND_LABELS } from './categories';

const dollars = (cents) => (cents === null || cents === undefined ? '' : (Number(cents) / 100).toFixed(2));
const date = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const pct = (value) => (value === null || value === undefined ? '' : Number(value).toFixed(2));

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Stop spreadsheet apps from treating a cell as a formula.
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows) {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(','));
  return [header, ...lines].join('\r\n') + '\r\n';
}

const STATEMENT_COLUMNS = [
  { label: 'Fan payments (gross)', value: (r) => dollars(r.grossCents) },
  { label: 'Sales tax collected', value: (r) => dollars(r.taxCents) },
  { label: 'Refunds', value: (r) => dollars(r.refundsCents) },
  { label: 'Disputes', value: (r) => dollars(r.disputesCents) },
  { label: 'Net sales', value: (r) => dollars(r.netSalesCents) },
  { label: 'Paid to creators', value: (r) => dollars(r.paidToCreatorsCents) },
  { label: 'ByUs fees earned', value: (r) => dollars(r.byusFeesCents) },
  { label: 'Stripe processing fees', value: (r) => dollars(r.processingFeesCents) },
  { label: 'Stripe service fees', value: (r) => dollars(r.serviceFeesCents) },
  { label: 'Other adjustments', value: (r) => dollars(r.otherCents) },
  { label: 'ByUs net revenue', value: (r) => dollars(r.netRevenueCents) },
  { label: 'Payouts to ByUs bank', value: (r) => dollars(r.bankPayoutsCents) },
  { label: 'Payments', value: (r) => r.salesCount },
  { label: 'Refund count', value: (r) => r.refundCount },
  { label: 'Dispute count', value: (r) => r.disputeCount },
];

const TRANSACTION_COLUMNS = [
  { label: 'Date (UTC)', value: (r) => date(r.createdAt) },
  { label: 'Stripe balance transaction', value: (r) => r.id },
  { label: 'Category', value: (r) => BUCKET_LABELS[r.bucket] || r.bucket },
  { label: 'Stripe type', value: (r) => r.type },
  { label: 'Payment type', value: (r) => (r.kind ? KIND_LABELS[r.kind] || r.kind : '') },
  { label: 'Creator', value: (r) => r.creatorName },
  { label: 'Fan', value: (r) => r.fanName },
  { label: 'Amount', value: (r) => dollars(r.amountCents) },
  { label: 'Stripe fee', value: (r) => dollars(r.feeCents) },
  { label: 'Net', value: (r) => dollars(r.netCents) },
  { label: 'Sales tax included', value: (r) => dollars(r.taxCents) },
  { label: 'Currency', value: (r) => r.currency },
  { label: 'Status', value: (r) => r.status },
  { label: 'Available on', value: (r) => date(r.availableOn) },
  { label: 'Charge', value: (r) => r.chargeId },
  { label: 'Invoice', value: (r) => r.invoiceId },
  { label: 'Source', value: (r) => r.sourceId },
  { label: 'Description', value: (r) => r.description },
];

export async function buildExport(report, period) {
  const suffix = period.key;
  switch (report) {
    case 'summary': {
      const s = await getSummary(period);
      return {
        filename: `byus-summary-${suffix}.csv`,
        csv: toCsv([{ label: 'Period', value: () => period.label }, ...STATEMENT_COLUMNS,
          { label: 'Effective ByUs take %', value: (r) => pct(r.effectiveTakePercent) }], [s]),
      };
    }
    case 'statements': {
      const rows = await getMonthlyStatements(period);
      return {
        filename: `byus-monthly-statements-${suffix}.csv`,
        csv: toCsv([{ label: 'Month', value: (r) => r.month }, ...STATEMENT_COLUMNS], rows),
      };
    }
    case 'creators': {
      const rows = await getCreatorBreakdown(period);
      return {
        filename: `byus-creators-${suffix}.csv`,
        csv: toCsv(
          [
            { label: 'Creator', value: (r) => r.name },
            { label: 'Email', value: (r) => r.email },
            { label: 'Stripe account', value: (r) => r.connectedAccountId },
            { label: 'Fan payments (gross)', value: (r) => dollars(r.grossCents) },
            { label: 'Sales tax', value: (r) => dollars(r.taxCents) },
            { label: 'Refunds', value: (r) => dollars(r.refundsCents) },
            { label: 'Disputes', value: (r) => dollars(r.disputesCents) },
            { label: 'Paid to creator', value: (r) => dollars(r.paidToCreatorsCents) },
            { label: 'ByUs fees earned', value: (r) => dollars(r.byusFeesCents) },
            { label: 'Effective fee %', value: (r) => pct(r.effectiveTakePercent) },
            { label: 'Stripe fees on their payments', value: (r) => dollars(r.creatorStripeFeesCents) },
            { label: 'ByUs net from creator', value: (r) => dollars(r.netRevenueCents) },
            { label: 'Paid out to their bank', value: (r) => dollars(r.paidOutCents) },
            { label: 'Stripe balance available', value: (r) => dollars(r.balanceAvailableCents) },
            { label: 'Stripe balance pending', value: (r) => dollars(r.balancePendingCents) },
            { label: 'Payments', value: (r) => r.salesCount },
            { label: 'Current fee rate %', value: (r) => r.currentFeePercent },
          ],
          rows
        ),
      };
    }
    case 'transactions': {
      const { rows } = await getTransactions(period, { limit: 100000 });
      return { filename: `byus-transactions-${suffix}.csv`, csv: toCsv(TRANSACTION_COLUMNS, rows) };
    }
    case 'payouts': {
      const { bank, creators } = await getPayouts(period);
      const rows = [
        ...bank.map((p) => ({ ...p, party: 'ByUs bank' })),
        ...creators.map((p) => ({ ...p, party: p.creatorName })),
      ];
      return {
        filename: `byus-payouts-${suffix}.csv`,
        csv: toCsv(
          [
            { label: 'Created (UTC)', value: (r) => date(r.createdAt) },
            { label: 'Paid to', value: (r) => r.party },
            { label: 'Payout', value: (r) => r.id },
            { label: 'Amount', value: (r) => dollars(r.amountCents) },
            { label: 'Status', value: (r) => r.status },
            { label: 'Method', value: (r) => r.method || '' },
            { label: 'Arrival', value: (r) => date(r.arrivalDate) },
            { label: 'Failure', value: (r) => r.failureMessage || '' },
          ],
          rows
        ),
      };
    }
    case 'refunds': {
      const { movements } = await getRefundsAndDisputes(period);
      return { filename: `byus-refunds-disputes-${suffix}.csv`, csv: toCsv(TRANSACTION_COLUMNS, movements) };
    }
    case 'tax-creators': {
      const tax = await getTaxYear(period.year || new Date().getUTCFullYear());
      return {
        filename: `byus-creator-year-end-${tax.year}.csv`,
        csv: toCsv(
          [
            { label: 'Creator', value: (r) => r.name },
            { label: 'Email', value: (r) => r.email },
            { label: 'Stripe account', value: (r) => r.connectedAccountId },
            { label: 'Gross fan payments', value: (r) => dollars(r.grossCents) },
            { label: 'Payments', value: (r) => r.salesCount },
            { label: 'Refunds', value: (r) => dollars(r.refundsCents) },
            { label: 'Disputes', value: (r) => dollars(r.disputesCents) },
            { label: 'Sales tax', value: (r) => dollars(r.taxCents) },
            { label: 'Paid to creator', value: (r) => dollars(r.paidToCreatorsCents) },
            { label: 'ByUs fees', value: (r) => dollars(r.byusFeesCents) },
          ],
          tax.creators
        ),
      };
    }
    case 'tax-months': {
      const tax = await getTaxYear(period.year || new Date().getUTCFullYear());
      return {
        filename: `byus-year-end-${tax.year}.csv`,
        csv: toCsv([{ label: 'Month', value: (r) => r.month }, ...STATEMENT_COLUMNS], tax.months),
      };
    }
    case 'reconciliation': {
      const { checks } = await getReconciliation();
      const rows = checks.flatMap((c) =>
        c.items.length ? c.items.map((item) => ({ check: c, item })) : [{ check: c, item: null }]
      );
      return {
        filename: `byus-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`,
        csv: toCsv(
          [
            { label: 'Check', value: (r) => r.check.title },
            { label: 'Status', value: (r) => r.check.status },
            { label: 'Detail', value: (r) => r.check.detail },
            { label: 'Item', value: (r) => r.item?.label || '' },
            { label: 'Amount', value: (r) => (r.item ? dollars(r.item.amountCents) : '') },
            { label: 'Date', value: (r) => (r.item ? date(r.item.at) : '') },
          ],
          rows
        ),
      };
    }
    default:
      return null;
  }
}
