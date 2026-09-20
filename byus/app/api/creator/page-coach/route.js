export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const MODEL = process.env.ANTHROPIC_COACH_MODEL || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const MAX_MESSAGES = 14;
const MAX_MESSAGE_CHARS = 2000;

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function cleanAction(action) {
  if (!action || typeof action !== 'object') return null;
  if (action.type === 'update_profile') {
    const payload = {};
    if (typeof action.payload?.display_name === 'string') payload.display_name = action.payload.display_name.trim().slice(0, 100);
    if (typeof action.payload?.bio === 'string') payload.bio = action.payload.bio.trim().slice(0, 1000);
    if (Array.isArray(action.payload?.tags)) {
      payload.tags = action.payload.tags.map((tag) => String(tag).trim().toLowerCase())
        .filter((tag) => /^[a-z0-9][a-z0-9 -]{0,29}$/.test(tag)).slice(0, 8);
    }
    return Object.keys(payload).length ? { type: 'update_profile', label: 'Apply profile changes', payload } : null;
  }
  if (action.type === 'create_tier') {
    const name = String(action.payload?.name || '').trim().slice(0, 60);
    const description = String(action.payload?.description || '').trim().slice(0, 200);
    const priceCents = Math.round(Number(action.payload?.priceCents));
    if (!name || !Number.isInteger(priceCents) || priceCents < 100 || priceCents > 200000) return null;
    return {
      type: 'create_tier',
      label: `Create ${name} tier`,
      payload: { name, description, priceCents, trialDays: 0 },
    };
  }
  if (action.type === 'navigate') {
    const allowed = ['/settings', '/creator/dashboard', '/creator/onboarding'];
    const href = allowed.includes(action.payload?.href) ? action.payload.href : null;
    return href ? { type: 'navigate', label: String(action.label || 'Take me there').slice(0, 50), payload: { href } } : null;
  }
  return null;
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can use the Page Coach.' }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'The Page Coach is not configured yet.' }, { status: 503 });
  }

  const rateCheck = await checkRateLimit('page-coach', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  let submitted;
  try { submitted = (await request.json()).messages; } catch { submitted = null; }
  if (!Array.isArray(submitted) || submitted.length === 0) {
    return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  }

  const messages = submitted.slice(-MAX_MESSAGES).map((message) => ({
    role: message?.role === 'assistant' ? 'assistant' : 'user',
    content: String(message?.content || '').trim().slice(0, MAX_MESSAGE_CHARS),
  })).filter((message) => message.content);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  }

  const [creatorResult, tiersResult, postsResult, productsResult] = await Promise.all([
    query(`SELECT display_name, bio, tags, profile_image_url, stripe_connect_onboarded,
                  email_verified, review_cleared_at
           FROM users WHERE id = $1`, [session.userId]),
    query(`SELECT name, description, price_cents, active FROM subscription_tiers
           WHERE creator_id = $1 ORDER BY price_cents`, [session.userId]),
    query(`SELECT title, visibility, created_at FROM posts
           WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 8`, [session.userId]),
    query(`SELECT title, price_cents, access_type, active FROM digital_products
           WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 8`, [session.userId]),
  ]);

  const pageState = {
    profile: creatorResult.rows[0],
    tiers: tiersResult.rows,
    recentPosts: postsResult.rows,
    digitalProducts: productsResult.rows,
  };

  const system = `You are the ByUs Page Coach, a patient guide for creators who may not be comfortable with computers.
Speak in warm, simple language. Ask only one clear question at a time. Never shame the creator or use technical jargon.
You can explain ByUs, help plan a page, write a bio, recommend tiers, suggest posts and digital downloads, and tell the creator where to go.
Use the creator's actual page state below. Do not claim something is saved or published unless the creator applies an action.
Never request passwords, payment card information, API keys, tax IDs, or other secrets.
For profile edits and tier creation, offer a reviewable action. Never create more than one tier action in a single reply.
Keep replies below 170 words unless the creator asks for detail.

CURRENT PAGE STATE:
${JSON.stringify(pageState)}

Reply with ONLY valid JSON in this exact shape:
{
  "reply": "your conversational response",
  "quickReplies": ["up to 3 short optional replies"],
  "actions": [
    {
      "type": "update_profile | create_tier | navigate",
      "label": "short button label",
      "payload": {}
    }
  ]
}
update_profile payload may contain display_name, bio, and tags.
create_tier payload must contain name, description, and integer priceCents.
navigate payload may only use href /settings, /creator/dashboard, or /creator/onboarding.
When the creator is merely exploring, actions should be an empty array.`;

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages }),
    });
  } catch (err) {
    console.error('page-coach provider request failed:', err);
    return NextResponse.json({ error: 'Could not reach the Page Coach. Try again.' }, { status: 502 });
  }

  if (!response.ok) {
    console.error('page-coach provider returned', response.status, await response.text().catch(() => ''));
    return NextResponse.json({ error: 'The Page Coach is unavailable right now. Try again.' }, { status: 502 });
  }

  const data = await response.json();
  const parsed = extractJson(data?.content?.[0]?.text || '');
  if (!parsed || typeof parsed.reply !== 'string') {
    return NextResponse.json({ error: 'The Page Coach had trouble answering. Try again.' }, { status: 502 });
  }

  return NextResponse.json({
    reply: parsed.reply.trim().slice(0, 2000),
    quickReplies: Array.isArray(parsed.quickReplies)
      ? parsed.quickReplies.map((item) => String(item).trim().slice(0, 70)).filter(Boolean).slice(0, 3)
      : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions.map(cleanAction).filter(Boolean).slice(0, 2) : [],
  });
}
