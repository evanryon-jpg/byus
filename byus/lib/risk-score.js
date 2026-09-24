// Application-level fraud/risk scoring for checkouts, run right before a fan is handed
// off to Stripe Checkout (app/api/subscribe, app/api/creators/[creatorId]/tip,
// app/api/products/[productId]/checkout). Stripe Radar already scores every payment
// on card/network signals; what it can't see is what ByUs knows about the *account*
// doing the buying -- how old it is, whether it's on a throwaway email, whether the
// checkout IP matches the one it signed up from, how many times it has tried in the
// last hour, whether it has disputed a ByUs charge before. Writing custom Radar rules
// on those signals needs Stripe's paid Radar tier; computing them here and logging the
// result costs nothing and works on any Stripe plan.
//
// ADVISORY ONLY. scoreCheckout never blocks anything: a false positive on a
// blocking check turns a legitimate fan away silently, which is a worse outcome for a
// platform this size than letting Stripe's own fraud tooling take the occasional bad
// charge. Instead the score is (1) written to checkout_risk_events for the admin risk
// page (app/admin/risk) and the daily ops digest, and (2) passed along as Stripe
// metadata (byus_risk_score / byus_risk_level) so it's visible right on the payment
// in Stripe's dashboard when a dispute or review comes up. Blocking, if it's ever
// wanted, belongs in the callers as an explicit decision on top of this -- not in here.
//
// Every failure path here is swallowed: a risk-scoring hiccup must never be the reason
// a fan can't pay. Callers get a neutral { score: 0, level: 'low' } instead.

import { query } from '@/lib/db';
import { getClientIp } from '@/lib/rate-limit';

// Throwaway/temp-mail domains seen in the wild. Not exhaustive -- it doesn't have to
// be, since this is one weighted signal among several, not a gate. Add to it when a
// new one shows up in the risk page; the first entry is one that already signed up.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'ncleap.com',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'sharklasers.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'mohmal.com',
  'throwawaymail.com',
  'fakeinbox.com',
  'mailnesia.com',
  'tempr.email',
  'emailondeck.com',
  'mintemail.com',
]);

const HIGH_THRESHOLD = 60;
const MEDIUM_THRESHOLD = 30;

function levelFor(score) {
  if (score >= HIGH_THRESHOLD) return 'high';
  if (score >= MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}

function emailDomain(email) {
  const at = String(email || '').lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}

// Computes and records a risk score for one checkout attempt. Returns
// { score, level, signals } -- signals is a list of { code, points, detail } explaining
// every point added, so the admin page (and anyone reading the row later) can see *why*
// a score is what it is rather than just a number.
export async function scoreCheckout({ request, userId, email, creatorId, kind, amountCents }) {
  try {
    const ip = getClientIp(request);
    const [userRow, signupRow, disputeRow, velocityRow] = await Promise.all([
      query('SELECT created_at FROM users WHERE id = $1', [userId]),
      // The signup-time acceptance row carries the IP the account was created from.
      query(
        `SELECT ip_address FROM legal_acceptances
         WHERE user_id = $1 AND source IN ('email_signup', 'google_signup', 'apple_signup')
         ORDER BY accepted_at ASC LIMIT 1`,
        [userId]
      ).catch(() => ({ rows: [] })), // table is self-created on first use -- tolerate absence
      query('SELECT COUNT(*)::int AS n FROM stripe_disputes WHERE fan_id = $1', [userId]),
      query(
        `SELECT COUNT(*)::int AS n FROM checkout_risk_events
         WHERE user_id = $1 AND created_at >= now() - interval '1 hour'`,
        [userId]
      ).catch(() => ({ rows: [{ n: 0 }] })),
    ]);

    const signals = [];
    let score = 0;
    const add = (code, points, detail) => {
      signals.push({ code, points, detail });
      score += points;
    };

    // 1. Account age. Card testers create an account and try to charge within minutes;
    //    a fan who has been around a while is a far weaker signal.
    const createdAt = userRow.rows[0]?.created_at ? new Date(userRow.rows[0].created_at) : null;
    const ageMinutes = createdAt ? (Date.now() - createdAt.getTime()) / 60000 : null;
    if (ageMinutes !== null) {
      if (ageMinutes < 10) add('account_under_10m', 30, `Account created ${Math.round(ageMinutes)} min ago`);
      else if (ageMinutes < 60) add('account_under_1h', 20, `Account created ${Math.round(ageMinutes)} min ago`);
      else if (ageMinutes < 24 * 60) add('account_under_24h', 10, `Account created ${Math.round(ageMinutes / 60)}h ago`);
    }

    // 2. Checkout IP differs from signup IP, but only while the account is young --
    //    a month-old account paying from a different network is just someone on their
    //    phone, whereas a brand-new one that has already moved IPs is more unusual.
    const signupIp = signupRow.rows[0]?.ip_address || null;
    if (signupIp && ip !== 'unknown' && signupIp !== ip && ageMinutes !== null && ageMinutes < 24 * 60) {
      add('ip_changed_since_signup', 15, `Signed up from ${signupIp}, checking out from ${ip}`);
    }

    // 3. Disposable email domain.
    const domain = emailDomain(email);
    if (domain && DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      add('disposable_email', 25, `Email domain ${domain} is a known throwaway provider`);
    }

    // 4. Prior disputes on this account -- the strongest single signal there is.
    const priorDisputes = disputeRow.rows[0]?.n || 0;
    if (priorDisputes > 0) {
      add('prior_dispute', 40, `${priorDisputes} prior dispute${priorDisputes === 1 ? '' : 's'} on this account`);
    }

    // 5. Velocity: attempts by this fan in the last hour, before this one.
    const recentAttempts = velocityRow.rows[0]?.n || 0;
    if (recentAttempts >= 6) add('velocity_6_per_hour', 40, `${recentAttempts} checkout attempts in the last hour`);
    else if (recentAttempts >= 3) add('velocity_3_per_hour', 20, `${recentAttempts} checkout attempts in the last hour`);

    const level = levelFor(score);

    await query(
      `INSERT INTO checkout_risk_events
         (user_id, creator_id, kind, amount_cents, ip_address, score, level, signals)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [userId, creatorId || null, kind, amountCents, ip, score, level, JSON.stringify(signals)]
    ).catch((err) => {
      // Table missing (migration not yet applied) or a transient DB error -- the score
      // is still useful to the caller for Stripe metadata even if it didn't persist.
      console.error('risk-score: could not record checkout_risk_event:', err);
    });

    return { score, level, signals };
  } catch (err) {
    console.error('risk-score: scoring failed, treating as low risk:', err);
    return { score: 0, level: 'low', signals: [] };
  }
}

// Stripe metadata values must be strings; this is the shape the three checkout
// routes spread into their existing metadata objects.
export function riskMetadata(risk) {
  return {
    byus_risk_score: String(risk?.score ?? 0),
    byus_risk_level: risk?.level || 'low',
  };
}

// For the admin risk page and the ops digest.
export async function loadRecentRiskEvents({ days = 30, limit = 100 } = {}) {
  const { rows } = await query(
    `SELECT e.id, e.kind, e.amount_cents, e.ip_address, e.score, e.level, e.signals, e.created_at,
            f.email AS fan_email, f.display_name AS fan_name, f.created_at AS fan_created_at,
            c.display_name AS creator_name
     FROM checkout_risk_events e
     JOIN users f ON f.id = e.user_id
     LEFT JOIN users c ON c.id = e.creator_id
     WHERE e.created_at >= now() - ($1::int * interval '1 day')
       AND e.level IN ('medium', 'high')
     ORDER BY e.created_at DESC
     LIMIT $2`,
    [days, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    amountCents: r.amount_cents,
    ipAddress: r.ip_address,
    score: r.score,
    level: r.level,
    signals: r.signals || [],
    createdAt: r.created_at,
    fanEmail: r.fan_email,
    fanName: r.fan_name,
    fanCreatedAt: r.fan_created_at,
    creatorName: r.creator_name,
  }));
}

export async function countRiskEvents({ hours = 24 } = {}) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE level = 'high')::int AS high,
            COUNT(*) FILTER (WHERE level = 'medium')::int AS medium
     FROM checkout_risk_events
     WHERE created_at >= now() - ($1::int * interval '1 hour')`,
    [hours]
  );
  return rows[0] || { total: 0, high: 0, medium: 0 };
}
