import {
  TERMS_VERSION,
  PRIVACY_VERSION,
  CREATOR_AGREEMENT_VERSION,
  CONTENT_POLICY_VERSION,
} from '@/lib/legal';

export function signupDocuments(role) {
  const documents = {
    terms: TERMS_VERSION,
    privacy: PRIVACY_VERSION,
  };
  if (role === 'creator') {
    documents.creatorAgreement = CREATOR_AGREEMENT_VERSION;
    documents.contentPolicy = CONTENT_POLICY_VERSION;
  }
  return documents;
}

export function requestAcceptanceEvidence(request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  return {
    ipAddress: forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || null,
    userAgent: request.headers.get('user-agent')?.slice(0, 1000) || null,
  };
}

export async function recordLegalAcceptance(client, {
  userId,
  role,
  source,
  request,
  documents = signupDocuments(role),
}) {
  const { ipAddress, userAgent } = requestAcceptanceEvidence(request);
  // The checked-in migration remains the canonical schema. This idempotent guard makes
  // rollout safe on an existing deployment too: the first acceptance after deploy can
  // create the append-only ledger before inserting, rather than allowing signup to fail
  // during the brief window between application and migration rollout.
  await client.query(`
    CREATE TABLE IF NOT EXISTS legal_acceptances (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_at_acceptance text NOT NULL CHECK (role_at_acceptance IN ('creator', 'fan')),
      source text NOT NULL CHECK (source IN ('email_signup', 'google_signup', 'apple_signup', 'creator_onboarding', 'policy_reacceptance')),
      documents jsonb NOT NULL,
      ip_address text,
      user_agent text,
      accepted_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS legal_acceptances_user_date_idx
      ON legal_acceptances (user_id, accepted_at DESC)
  `);
  await client.query(
    `INSERT INTO legal_acceptances
       (user_id, role_at_acceptance, source, documents, ip_address, user_agent)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
    [userId, role, source, JSON.stringify(documents), ipAddress, userAgent]
  );
}
