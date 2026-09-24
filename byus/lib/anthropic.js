// Thin shared wrapper around the Anthropic Messages API for the app's server-side
// "ask the model for a structured answer" jobs -- appeal triage (lib/appeal-triage.js)
// and the fan help assistant (app/api/fan/assistant). Same raw-fetch approach as
// app/api/creator/page-coach/route.js and ai-setup/route.js, which predate this file
// and still call the API inline; pulled out here so the newer callers don't each carry
// their own copy of the request/parse/error handling. Plain fetch rather than the SDK
// for the same reason lib/mux.js and lib/sms.js avoid SDKs: the GitHub-web-upload
// deploy flow never runs npm install for new packages.

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Pulls the first {...} block out of a reply, since even with "reply with ONLY JSON"
// a model will occasionally wrap it in a sentence or a code fence.
export function extractJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// Sends one request and returns the parsed JSON object from the reply, or null on any
// failure (not configured, network error, non-2xx, unparseable). Never throws: every
// caller of this treats the model as optional -- an appeal still gets filed and a fan
// still gets a fallback answer if it's down -- so a null is the whole error contract.
export async function askForJson({ system, messages, maxTokens = 600, model = DEFAULT_MODEL, context = 'anthropic' }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    });
  } catch (err) {
    console.error(`${context}: request failed:`, err);
    return null;
  }

  if (!response.ok) {
    console.error(`${context}: provider returned`, response.status, await response.text().catch(() => ''));
    return null;
  }

  const data = await response.json().catch(() => null);
  return extractJson(data?.content?.[0]?.text || '');
}
