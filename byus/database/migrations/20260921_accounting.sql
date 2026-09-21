-- Accounting ledger. Stripe is the source of truth for money; these tables are a local,
-- queryable copy of it (filled by lib/accounting/sync.js), so /admin/accounting can show
-- real fees, refunds, disputes, tax and payouts instead of estimates.
BEGIN;

-- One row per Stripe balance transaction on the ByUs platform account. Balance
-- transactions are Stripe's own ledger: every charge, refund, dispute, transfer to a
-- creator, application fee, Stripe fee and payout moves the balance through one of these.
CREATE TABLE IF NOT EXISTS ledger_transactions (
  id text PRIMARY KEY,                       -- txn_...
  type text NOT NULL,                        -- Stripe balance transaction type
  reporting_category text,
  bucket text NOT NULL,                      -- sales/refunds/disputes/creator_transfers/platform_fees/stripe_fees/payouts/other
  amount_cents bigint NOT NULL,
  fee_cents bigint NOT NULL DEFAULT 0,       -- Stripe fee taken on this transaction
  net_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text,                               -- pending / available
  created_at timestamptz NOT NULL,
  available_on timestamptz,
  source_id text,
  description text,
  fee_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  charge_id text,                            -- the platform charge this row belongs to, when any
  stripe_invoice_id text,
  payment_intent_id text,
  connected_account_id text,
  creator_id uuid REFERENCES users(id) ON DELETE SET NULL,
  fan_id uuid REFERENCES users(id) ON DELETE SET NULL,
  payment_kind text,                         -- subscription / tip / product / other
  tax_cents bigint NOT NULL DEFAULT 0,       -- sales tax included in a charge's amount
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_transactions_created_idx ON ledger_transactions (created_at);
CREATE INDEX IF NOT EXISTS ledger_transactions_creator_idx ON ledger_transactions (creator_id, created_at);
CREATE INDEX IF NOT EXISTS ledger_transactions_charge_idx ON ledger_transactions (charge_id);
CREATE INDEX IF NOT EXISTS ledger_transactions_bucket_idx ON ledger_transactions (bucket, created_at);

-- Payouts from each creator's Stripe Express account to their own bank.
CREATE TABLE IF NOT EXISTS creator_payouts (
  id text PRIMARY KEY,                       -- po_...
  creator_id uuid REFERENCES users(id) ON DELETE SET NULL,
  connected_account_id text NOT NULL,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL,
  method text,
  arrival_date timestamptz,
  created_at timestamptz NOT NULL,
  failure_message text,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_payouts_creator_idx ON creator_payouts (creator_id, created_at);

-- Latest known Stripe balance of each creator's connected account.
CREATE TABLE IF NOT EXISTS creator_balances (
  creator_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  connected_account_id text NOT NULL,
  available_cents bigint NOT NULL DEFAULT 0,
  pending_cents bigint NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now()
);

-- Sync bookkeeping: cursor, last run, errors, platform balance snapshot.
CREATE TABLE IF NOT EXISTS accounting_sync_state (
  key text PRIMARY KEY,
  cursor_created bigint,
  history_complete boolean NOT NULL DEFAULT false,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_error text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
INSERT INTO accounting_sync_state (key) VALUES ('stripe') ON CONFLICT (key) DO NOTHING;

COMMIT;
