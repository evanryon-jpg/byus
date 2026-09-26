'use client';

// The support desk's sections are the same components /admin uses (exported from
// app/admin/AdminClient.js), so a fix to either lands in both. Reports render without the
// suspend control: suspensions pause a creator's billing and payouts, so they stay with
// admins.

import { VideoModerationSection, ReportsSection } from '../admin/AdminClient';

export default function SupportDeskClient({ initialVideos, initialVideosError, initialReports, initialReportsError }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-sm font-medium text-[#0F766E]">ByUs team</p>
      <h1 className="mt-1 text-2xl font-bold text-[#172033]">Support desk</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-ink/65">
        Review flagged videos, triage reports, and answer fans. Refunds, disputes, suspensions and anything to do
        with money go to Evan: leave a note on the item and he&rsquo;ll pick it up.
      </p>

      <a
        href="/admin/support"
        className="mt-6 flex items-center justify-between rounded-xl border border-brand-ink/10 bg-brand-paper px-4 py-3 transition hover:bg-brand-ink/5"
      >
        <span>
          <span className="block font-semibold text-[#172033]">Fan support requests</span>
          <span className="block text-xs text-brand-ink/65">Questions the help assistant passed to a person</span>
        </span>
        <span aria-hidden="true" className="text-[#0F766E]">→</span>
      </a>

      <VideoModerationSection initialVideos={initialVideos} initialError={initialVideosError} />
      <ReportsSection initialReports={initialReports} initialError={initialReportsError} canSuspend={false} />
    </div>
  );
}
