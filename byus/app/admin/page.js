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
  loadCreatorWaitlist,
  loadCreatorReviewQueue,
  loadPendingVideoReviewQueue,
  loadAdminTasks,
} from '@/lib/admin-data';
import { listPendingSmsBroadcastHolds, SMS_HOLD_THRESHOLD } from '@/lib/sms-holds';
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

  // All seven queries used to run as one awaited alone (overview) followed by a
  // Promise.all for the rest -- two sequential round trips to Neon back to back on
  // every single load, for no reason: none of the other six loaders read anything
  // from the overview result, so there was nothing to wait for. That extra round
  // trip was pure added latency on the server's response, which pushes out TTFB
  // and therefore this page's Real Experience Score. Running all seven together
  // cuts it to one round trip's worth of wall-clock time.
  const [overviewResult, reportsResult, suggestionsResult, outreachResult, siteFeedbackResult, waitlistResult, reviewQueueResult, videoReviewResult, tasksResult, smsHoldsResult] =
    await Promise.all([
      loadAdminOverview().catch((err) => {
        console.error('admin: overview load failed:', err);
        return null;
      }),
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
      loadCreatorWaitlist()
        .then((waitlist) => ({ waitlist, error: '' }))
        .catch((err) => {
          console.error('admin: creator waitlist load failed:', err);
          return { waitlist: null, error: 'Could not load the creator waitlist.' };
        }),
      loadCreatorReviewQueue()
        .then((reviewQueue) => ({ reviewQueue, error: '' }))
        .catch((err) => {
          console.error('admin: creator review queue load failed:', err);
          return { reviewQueue: null, error: 'Could not load the creator review queue.' };
        }),
      loadPendingVideoReviewQueue()
        .then((videos) => ({ videos, error: '' }))
        .catch((err) => {
          console.error('admin: video moderation queue load failed:', err);
          return { videos: null, error: 'Could not load pending videos.' };
        }),
      loadAdminTasks()
        .then((tasks) => ({ tasks, error: '' }))
        .catch((err) => {
          console.error('admin: tasks load failed:', err);
          return { tasks: null, error: 'Could not load the task list.' };
        }),
      listPendingSmsBroadcastHolds()
        .then((holds) => ({ holds, error: '' }))
        .catch((err) => {
          console.error('admin: pending SMS holds load failed:', err);
          return { holds: null, error: 'Could not load pending SMS sends.' };
        }),
    ]);

  if (!overviewResult) {
    return (
      <div className="p-12 text-center text-brand-ink/60">Could not load the platform overview.</div>
    );
  }

  return (
    <AdminClient
      data={overviewResult}
      initialReports={reportsResult.reports}
      initialReportsError={reportsResult.error}
      initialSuggestions={suggestionsResult.suggestions}
      initialSuggestionsError={suggestionsResult.error}
      initialOutreachContacts={outreachResult.contacts}
      initialOutreachError={outreachResult.error}
      initialSiteFeedback={siteFeedbackResult.feedback}
      initialSiteFeedbackError={siteFeedbackResult.error}
      initialWaitlist={waitlistResult.waitlist}
      initialWaitlistError={waitlistResult.error}
      initialReviewQueue={reviewQueueResult.reviewQueue}
      initialReviewQueueError={reviewQueueResult.error}
      initialVideoReviewQueue={videoReviewResult.videos}
      initialVideoReviewError={videoReviewResult.error}
      initialTasks={tasksResult.tasks}
      initialTasksError={tasksResult.error}
      initialSmsHolds={smsHoldsResult.holds}
      initialSmsHoldsError={smsHoldsResult.error}
      smsHoldThreshold={SMS_HOLD_THRESHOLD}
    />
  );
}
