import { query } from '@/lib/db';

const ALLOWED_EVENT_TYPES = new Set([
  'login_success',
  'subscription_started',
  'subscription_canceled',
  'subscriber_content_access',
  'subscriber_media_access',
]);

// Payment evidence should never block a customer's normal experience. If evidence logging
// fails (for example during a transient database hiccup), callers can use this helper in a
// best-effort path and continue serving the request. Keep metadata compact and factual — no
// passwords, card data, post bodies, or other unnecessary personal content belongs here.
export async function recordPaymentEvidence({
  fanId = null,
  creatorId = null,
  subscriptionId = null,
  postId = null,
  stripeChargeId = null,
  eventType,
  metadata = {},
}) {
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    throw new Error(`Unsupported payment evidence event type: ${eventType}`);
  }

  await query(
    `INSERT INTO payment_evidence_events
       (fan_id, creator_id, subscription_id, post_id, stripe_charge_id, event_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      fanId,
      creatorId,
      subscriptionId,
      postId,
      stripeChargeId,
      eventType,
      JSON.stringify(metadata || {}),
    ]
  );
}

export async function recordPaymentEvidenceBestEffort(event) {
  try {
    await recordPaymentEvidence(event);
  } catch (err) {
    console.error('payment evidence logging failed:', err);
  }
}
