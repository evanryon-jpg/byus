// Support desk: the limited admin page for support staff (see isSupportStaff in
// lib/admin.js). Pending videos, content reports, and a link to fan support requests --
// the day-to-day work a hired helper does -- with nothing about money, fan IP addresses,
// tax records, the waitlist, or suspensions. Admins can open it too, to see exactly what
// a helper sees.

import { getCurrentUser } from '@/lib/session';
import { isSupportStaff } from '@/lib/admin';
import { loadAdminReports, loadPendingVideoReviewQueue } from '@/lib/admin-data';
import SupportDeskClient from './SupportDeskClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Support desk | ByUs', robots: { index: false, follow: false } };

export default async function SupportDeskPage() {
  const session = await getCurrentUser();
  if (!session || !isSupportStaff(session)) {
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

  const [videos, reports] = await Promise.all([
    loadPendingVideoReviewQueue()
      .then((v) => ({ v, error: '' }))
      .catch((err) => {
        console.error('support-desk: video queue load failed:', err);
        return { v: null, error: 'Could not load pending videos.' };
      }),
    loadAdminReports()
      .then((r) => ({ r, error: '' }))
      .catch((err) => {
        console.error('support-desk: reports load failed:', err);
        return { r: null, error: 'Could not load reports.' };
      }),
  ]);

  return (
    <SupportDeskClient
      initialVideos={videos.v}
      initialVideosError={videos.error}
      initialReports={reports.r}
      initialReportsError={reports.error}
    />
  );
}
