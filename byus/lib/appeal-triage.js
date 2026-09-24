// AI-assisted triage for suspension appeals. Runs once, right after an appeal is
// filed (app/api/account/appeal/route.js), and writes a recommendation + reasoning +
// a drafted resolution note onto the suspension_appeals row for the admin to see in
// /admin/appeals. It never reinstates or denies anything itself: every suspension on
// ByUs is a manual admin decision with a free-typed reason (there's no automated
// suspension path that could produce a machine-detectable false positive), so the
// honest version of "automate appeals" is doing the reading and the first draft, and
// leaving the one-click decision to a human who can see the whole picture.
//
// What the model gets: the appeal text, the recorded suspension reason, the account's
// role and age, how many content reports it has received (by reason), and how many
// appeals it has filed before. What it does NOT get: any way to act. Best-effort
// throughout -- a triage failure is logged and the appeal simply shows up untriaged.

import { query } from '@/lib/db';
import { askForJson } from '@/lib/anthropic';

const RECOMMENDATIONS = new Set(['reinstate', 'uphold', 'needs_human']);

export async function triageAppeal(appealId) {
  try {
    const appealResult = await query(
      `SELECT a.id, a.message, a.suspension_reason, a.suspended_at, a.user_id,
              u.role, u.display_name, u.created_at AS account_created_at
       FROM suspension_appeals a
       JOIN users u ON u.id = a.user_id
       WHERE a.id = $1`,
      [appealId]
    );
    const appeal = appealResult.rows[0];
    if (!appeal) return;

    const [reportsResult, priorAppealsResult] = await Promise.all([
      query(
        `SELECT reason, COUNT(*)::int AS n FROM reports WHERE creator_id = $1 GROUP BY reason`,
        [appeal.user_id]
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE reinstated)::int AS reinstated
         FROM suspension_appeals
         WHERE user_id = $1 AND id <> $2 AND status = 'resolved'`,
        [appeal.user_id, appealId]
      ),
    ]);

    const accountAgeDays = appeal.account_created_at
      ? Math.round((Date.now() - new Date(appeal.account_created_at).getTime()) / 86400000)
      : null;

    const context = {
      role: appeal.role,
      accountAgeDays,
      suspensionReason: appeal.suspension_reason || '(not recorded)',
      suspendedAt: appeal.suspended_at,
      contentReportsReceived: reportsResult.rows,
      priorResolvedAppeals: priorAppealsResult.rows[0]?.n || 0,
      priorAppealsReinstated: priorAppealsResult.rows[0]?.reinstated || 0,
    };

    const system = `You are a trust & safety triage assistant for ByUs, a creator subscription platform. An admin suspended this account and the account holder has appealed. Your job is to read the appeal and the account context and recommend what the admin should do. You do not make the decision.

Rules:
- Recommend "reinstate" only when the appeal credibly explains a misunderstanding or shows the suspension reason no longer applies, AND the account has no pattern of reports or prior denied appeals.
- Recommend "uphold" when the appeal doesn't address the suspension reason, admits the violation without remedy, is abusive, or the account has a pattern of reports.
- Recommend "needs_human" whenever the situation is unclear, legally sensitive (e.g. claims about identity, minors, copyright, payments), or the suspension reason is missing so you can't judge.
- Be skeptical of vague promises. Be fair to people who clearly explain what happened.
- The draft resolution note is written TO the account holder, in plain warm language, 2-4 sentences, no jargon, and must never promise a refund or a specific timeline.

ACCOUNT CONTEXT:
${JSON.stringify(context)}

Reply with ONLY valid JSON in this exact shape:
{
  "recommendation": "reinstate | uphold | needs_human",
  "confidence": "low | medium | high",
  "reasoning": "2-4 sentences for the admin explaining the recommendation",
  "draftResolution": "the note to the account holder"
}`;

    const parsed = await askForJson({
      system,
      messages: [{ role: 'user', content: `APPEAL MESSAGE:\n${appeal.message}` }],
      maxTokens: 500,
      context: 'appeal-triage',
    });

    if (!parsed || !RECOMMENDATIONS.has(parsed.recommendation)) {
      console.error('appeal-triage: no usable recommendation for appeal', appealId);
      return;
    }

    await query(
      `UPDATE suspension_appeals
       SET ai_recommendation = $2, ai_confidence = $3, ai_reasoning = $4,
           ai_draft_resolution = $5, ai_triaged_at = now()
       WHERE id = $1`,
      [
        appealId,
        parsed.recommendation,
        ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low',
        String(parsed.reasoning || '').slice(0, 2000),
        String(parsed.draftResolution || '').slice(0, 1000),
      ]
    );
  } catch (err) {
    console.error('appeal-triage failed for appeal', appealId, err);
  }
}
