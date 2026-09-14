// Server Component: loads the platform overview, reports, and suggestions on the
// server (after checking the same lib/admin.js email allowlist /api/admin/overview
// itself checks) instead of shipping an empty shell that fetches everything
// client-side after hydration. See lib/admin-data.js for the shared query logic.

import { getCurrentUser } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import {
  loadAdminOverview,
  loadAdminReports,
  loadAdminSuggestions,
  loadOutreachContacts,
  loadSiteFeedback,
} from '@/lib/admin-data';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Deliberately not a redirect: a fan or creator hitting /admin isn't "not logged
  // in", they're just not authorized to see it — same "Not authorized" message
  // /api/admin/overview's 403 always produced client-side, shown directly here
  // instead of round-tripping through a fetch to find out.
  const session = await getCurrentUser();
  if (!session || !isAdmin(session)) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-semibold text-[#172033]">Not authorized</h1>
        <p className="mt-2 text-sm text-brand-ink/65">This page is only visible to the ByUs team.</p>
        <a href="/" className="mt-6 inline-block text-sm font-semibold text-[#0F766E] hover:underline">
          Back to ByUs →
        </a>
      </div>
    );
  }

  let data = null;
  try {
    data = await loadAdminOverview();
  } catch (err) {
    console.error('admin: overview load failed:', err);
  }

  if (!data) {
    return (
      <div className="p-12 text-center text-brand-ink/60">Could not load the platform overview.</div>
    );
  }

  const [reportsResult, suggestionsResult, outreachResult, siteFeedbackResult] = await Promise.all([
    loadAdminReports()
      .then((reports) => ({ reports, error: '' }))
      .catch((err) => {
        console.error('admin: reports load failed:', err);
        return { reports: null, error: 'Could not load reports.' };
      }),
    loadAdminSuggestions()
      .then((suggestions) => ({ suggestions, error: '' }))
      .catch((err) => {
        console.error('admin: suggestions load failed:', err);
        return { suggestions: null, error: 'Could not load suggestions.' };
      }),
    loadOutreachContacts()
      .then((contacts) => ({ contacts, error: '' }))
      .catch((err) => {
        console.error('admin: creator opinion invitations load failed:', err);
        return { contacts: null, error: 'Could not load creator opinion invitations.' };
      }),
    loadSiteFeedback()
      .then((feedback) => ({ feedback, error: '' }))
      .catch((err) => {
        console.error('admin: site feedback load failed:', err);
        return { feedback: null, error: 'Could not load visitor feedback.' };
      }),
  ]);

  return (
    <AdminClient
      data={data}
      initialReports={reportsResult.reports}
      initialReportsError={reportsResult.error}
      initialSuggestions={suggestionsResult.suggestions}
      initialSuggestionsError={suggestionsResult.error}
      initialOutreachContacts={outreachResult.contacts}
      initialOutreachError={outreachResult.error}
      initialSiteFeedback={siteFeedbackResult.feedback}
      initialSiteFeedbackError={siteFeedbackResult.error}
    />
  );
}
