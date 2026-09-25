-- Where each supporter came from (Sept 25, 2026) -- see lib/supporter-source.js.
-- One of: discover, browse, home, recommendation, byus_page (found through ByUs),
-- creator_link (the creator's own link / direct), search, ad. NULL = before tracking
-- began, or the visitor's cookie wasn't available.
ALTER TABLE creator_follows ADD COLUMN IF NOT EXISTS supporter_source text;
ALTER TABLE subscriptions   ADD COLUMN IF NOT EXISTS supporter_source text;
ALTER TABLE transactions    ADD COLUMN IF NOT EXISTS supporter_source text;
