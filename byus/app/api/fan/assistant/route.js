export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST /api/fan/assistant -> { messages: [{ role, content }] }
// The fan-facing help assistant on /fan/dashboard (app/components/FanAssistant.jsx).
// Answers account and billing questions from the fan's OWN data -- what they're
// subscribed to, what it costs, when the next charge is, what they've bought -- and
// points them at the self-serve tools that already exist (the Stripe billing portal
// for cards/cancellations/invoices, Settings for notifications). It is deliberately
// read-only: the one thing it can *do* is file a support_requests row for a human
// when a fan wants a refund or hits something it can't answer, so "I'd like a refund"
// becomes a tracked item in /admin/support instead of an email nobody's watching.
// The same JSON-reply shape and message handling as the creator Page Coach.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { askForJson, isAnthropicConfigured } from '@/lib/anthropic';

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 1500;
const REQUEST_KINDS = new Set(['refund', 'billing', 'account', 'other']);

const FALLBACK_REPLY =
  "I can't answer right now, but you can manage cards, invoices, and cancellations any time with the Manage billing button on your dashboard, or email support@byusapp.com.";

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'fan') {
    return NextResponse.json({ error: 'Only fans can use the help assistant.' }, { status: 403 });
  }
  if (!isAnthropicConfigured()) {
    return NextResponse.json({ error: 'The help assistant is not configured yet.' }, { status: 503 });
  }

  const rateCheck = await checkRateLimit('fan-assistant', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  let submitted;
  try { submitted = (await request.json()).messages; } catch { submitted = null; }
  if (!Array.isArray(submitted) || submitted.length === 0) {
    return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  }
  const messages = submitted.slice(-MAX_MESSAGES).map((m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: String(m?.content || '').trim().slice(0, MAX_MESSAGE_CHARS),
  })).filter((m) => m.content);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  }

  const [meResult, subsResult, purchasesResult, openRequestsResult] = await Promise.all([
    query(
      `SELECT display_name, email_verified, created_at, notify_new_posts FROM users WHERE id = $1`,
      [session.userId]
    ),
    query(
      `SELECT s.status, s.current_period_end, s.created_at,
              u.display_name AS creator_name, t.name AS tier_name, t.price_cents, t.trial_days
       FROM subscriptions s
       JOIN users u ON u.id = s.creator_id
       JOIN subscription_tiers t ON t.id = s.tier_id
       WHERE s.fan_id = $1
       ORDER BY s.created_at DESC LIMIT 20`,
      [session.userId]
    ),
    query(
      `SELECT p.title, dp.gross_amount_cents, dp.status, dp.created_at, u.display_name AS creator_name
       FROM digital_purchases dp
       JOIN digital_products p ON p.id = dp.product_id
       JOIN users u ON u.id = dp.creator_id
       WHERE dp.fan_id = $1
       ORDER BY dp.created_at DESC LIMIT 10`,
      [session.userId]
    ),
    query(
      `SELECT kind, summary, created_at FROM support_requests
       WHERE user_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 5`,
      [session.userId]
    ).catch(() => ({ rows: [] })),
  ]);

  const accountState = {
    displayName: meResult.rows[0]?.display_name,
    emailVerified: meResult.rows[0]?.email_verified,
    memberSince: meResult.rows[0]?.created_at,
    newPostEmailsOn: meResult.rows[0]?.notify_new_posts,
    subscriptions: subsResult.rows,
    digitalPurchases: purchasesResult.rows,
    openSupportRequests: openRequestsResult.rows,
    today: new Date().toISOString().slice(0, 10),
  };

  const system = `You are the ByUs help assistant for fans (subscribers). Warm, plain language, short replies (under 120 words). One question at a time.

You can see this fan's own account data below and should answer from it: which creators they support, tier names and prices, subscription status, the next billing date (current_period_end), trial days, and digital downloads they've bought. Prices are in cents; show them as dollars.

Self-serve tools you should point to (you cannot perform these yourself):
- "Manage billing" button on the dashboard opens the Stripe billing portal: update card, see invoices, cancel a subscription.
- Settings page: email/text notification preferences, password.
- A creator's page: to re-subscribe or change tiers.

You are read-only. You NEVER promise a refund, a cancellation, or any change. When the fan wants a refund, disputes a charge, reports a problem you can't resolve from the data, or explicitly asks for a human, file a support request: set "request" to {kind, summary} where kind is refund | billing | account | other and summary is 1-2 sentences for the ByUs team including any creator name, amount, and date the fan mentioned. Tell the fan it has been sent to the ByUs team and they'll hear back by email. Don't file duplicates of an open request listed in the data. Never ask for card numbers, passwords, or other secrets. If asked about something unrelated to ByUs, say you can only help with their ByUs account.

FAN ACCOUNT DATA:
${JSON.stringify(accountState)}

Reply with ONLY valid JSON in this exact shape:
{
  "reply": "your response",
  "quickReplies": ["up to 3 short optional follow-ups"],
  "request": null
}`;

  const parsed = await askForJson({ system, messages, maxTokens: 500, context: 'fan-assistant' });
  if (!parsed || typeof parsed.reply !== 'string') {
    return NextResponse.json({ reply: FALLBACK_REPLY, quickReplies: [], requestFiled: false });
  }

  let requestFiled = false;
  const req = parsed.request;
  if (req && typeof req === 'object' && REQUEST_KINDS.has(req.kind) && typeof req.summary === 'string' && req.summary.trim()) {
    try {
      await query(
        `INSERT INTO support_requests (user_id, kind, summary, transcript)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [session.userId, req.kind, req.summary.trim().slice(0, 1000), JSON.stringify(messages)]
      );
      requestFiled = true;
    } catch (err) {
      console.error('fan-assistant: could not file support request:', err);
    }
  }

  const quickReplies = Array.isArray(parsed.quickReplies)
    ? parsed.quickReplies.map((r) => String(r).trim().slice(0, 60)).filter(Boolean).slice(0, 3)
    : [];

  return NextResponse.json({ reply: parsed.reply.slice(0, 2000), quickReplies, requestFiled });
}
