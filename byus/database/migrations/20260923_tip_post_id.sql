-- Tips must now be tied to a specific post (Stripe compliance review, Sept 2026) --
-- see app/api/creators/[creatorId]/tip/route.js's own header comment. This column is
-- ByUs's own record of which post a tip was attached to, mirroring reports.post_id:
-- an audit trail proving the payment really was linked to identifiable content, not
-- just a name buried in Stripe's metadata that nothing in ByUs's own database points
-- back to. Nullable and ON DELETE SET NULL, same as reports.post_id -- a tip stays a
-- real transaction in the ledger even if the post it was for is later deleted.
BEGIN;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES posts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_post ON transactions (post_id) WHERE post_id IS NOT NULL;

COMMIT;
