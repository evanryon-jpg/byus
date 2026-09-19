-- Guardrail for lib/sms.js's automatic new-post text blast (see
-- notifySubscribersOfNewPostBySms in app/api/creator/posts/route.js). sent.dm bills
-- per contact per month plus per-text carrier cost, and until now nothing capped how
-- many phone numbers a single post could fan out to -- a creator with a large enough
-- opted-in SMS audience could trigger a real, unbounded bill on every post with zero
-- review. Anything over lib/sms-holds.js's SMS_HOLD_THRESHOLD is written here instead
-- of sent immediately, and only goes out once an admin approves it from /admin.
CREATE TABLE IF NOT EXISTS sms_broadcast_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  recipient_count integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The admin view only ever asks for pending holds, oldest first (so a hold doesn't
-- silently age past a creator's actual audience -- the fresher the approval, the
-- closer the recipient list re-fetched at send time matches what was originally seen).
CREATE INDEX IF NOT EXISTS idx_sms_broadcast_holds_status_created ON sms_broadcast_holds (status, created_at);
