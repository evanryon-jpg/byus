export const dynamic = 'force-dynamic';

// POST /api/creator/ai-setup
// Turns a creator's plain-English description of themselves into starter suggestions --
// a bio, a few category tags, and three tier ideas with names/prices/descriptions.
// Nothing here is saved automatically; the dashboard shows the suggestions and the
// creator applies (or edits) each one themselves via the existing /api/me and
// /api/creator/tiers endpoints, same as picking a tier preset.
//
// Requires the ANTHROPIC_API_KEY environment variable (Vercel project settings).

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

const DESCRIPTION_MAX = 500;
const BIO_MAX = 280;
const TAG_MAX = 30;
const MIN_PRICE_CENTS = 100;
const MAX_PRICE_CENTS = 200000; // keep in sync with app/api/creator/tiers/route.js

// Configurable so a model rename/retirement doesn't require a code change --
// see https://docs.claude.com/en/docs/about-claude/models for current IDs.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

function cleanTag(raw) {
  const tag = String(raw || '').trim().toLowerCase().slice(0, TAG_MAX);
  return /^[a-z0-9][a-z0-9 -]*$/.test(tag) ? tag : null;
}

function cleanPriceCents(raw) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < MIN_PRICE_CENTS) return MIN_PRICE_CENTS;
  return Math.min(n, MAX_PRICE_CENTS);
}

// The model can wrap its JSON in prose or a code fence despite instructions -- pull out
// the first {...} block rather than trusting the whole response body to be valid JSON.
function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function POST(request) {
  const session = await getCurrentUser();
  if (!session || session.role !== 'creator') {
    return NextResponse.json({ error: 'Only creators can use the setup assistant.' }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'The setup assistant is not configured yet. Try again later.' },
      { status: 503 }
    );
  }

  const rateCheck = await checkRateLimit('ai-setup', `user:${session.userId}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck);

  const { description } = await request.json();
  const trimmed = (description || '').trim();
  if (!trimmed) {
    return NextResponse.json({ error: 'Describe what you make or post about first.' }, { status: 400 });
  }
  const safeDescription = trimmed.slice(0, DESCRIPTION_MAX);

  const prompt = `A creator on a subscription platform described themselves like this:
"""
${safeDescription}
"""

Suggest a starter profile for them. Reply with ONLY a JSON object, no other text, matching exactly this shape:
{
  "bio": "a warm, specific 1-2 sentence bio under 280 characters, written in the creator's voice (first person)",
  "tags": ["2 to 5 short lowercase category words, e.g. cooking, fitness, photography"],
  "tiers": [
    { "name": "short tier name", "priceCents": 500, "description": "one short sentence of what this tier gets a fan" },
    { "name": "short tier name", "priceCents": 1000, "description": "one short sentence" },
    { "name": "short tier name", "priceCents": 2500, "description": "one short sentence" }
  ]
}
The three tiers should be a sensible low/mid/high ladder for this specific creator, priced in whole-dollar cents (e.g. 500 = $5.00).`;

  let aiResponse;
  try {
    aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    console.error('ai-setup: request to Anthropic failed:', err);
    return NextResponse.json({ error: 'Could not reach the setup assistant. Try again.' }, { status: 502 });
  }

  if (!aiResponse.ok) {
    console.error('ai-setup: Anthropic API returned', aiResponse.status, await aiResponse.text().catch(() => ''));
    return NextResponse.json({ error: 'Could not generate suggestions. Try again.' }, { status: 502 });
  }

  const data = await aiResponse.json();
  const text = data?.content?.[0]?.text || '';
  const parsed = extractJson(text);
  if (!parsed || typeof parsed.bio !== 'string' || !Array.isArray(parsed.tiers)) {
    console.error('ai-setup: unexpected model output:', text.slice(0, 500));
    return NextResponse.json({ error: 'Could not generate suggestions. Try again.' }, { status: 502 });
  }

  const bio = parsed.bio.trim().slice(0, BIO_MAX);
  const tags = Array.isArray(parsed.tags)
    ? [...new Set(parsed.tags.map(cleanTag).filter(Boolean))].slice(0, 5)
    : [];
  const tiers = parsed.tiers.slice(0, 3).map((t, i) => ({
    name: String(t?.name || `Tier ${i + 1}`).trim().slice(0, 60) || `Tier ${i + 1}`,
    description: String(t?.description || '').trim().slice(0, 200),
    priceCents: cleanPriceCents(t?.priceCents),
  }));

  if (!bio || tiers.length === 0) {
    return NextResponse.json({ error: 'Could not generate suggestions. Try again.' }, { status: 502 });
  }

  return NextResponse.json({ bio, tags, tiers });
}
