'use client';

// All the interactive admin UI. The platform overview, reports, and suggestions all
// arrive as props from the server-rendered app/admin/page.js — nothing here fetches
// its own starting data anymore, only mutations (suspend, clear review, status
// changes, notes), which are inherently admin-triggered and have nothing to do with
// first paint.

import { useState } from 'react';
import MonthlyBarChart from '../components/charts/MonthlyBarChart';
import PostVideoPlayer from '../components/PostVideoPlayer';
import { formatUSD, formatCompactUSD } from '@/lib/format';
import { CREATOR_SIGNUP_PAUSED } from '@/lib/creator-signup';
import { creatorCountryName, creatorCountryStatus } from '@/lib/creator-countries';

export default function AdminClient({
  data,
  initialReports,
  initialReportsError,
  initialSuggestions,
  initialSuggestionsError,
  initialSiteFeedback,
  initialSiteFeedbackError,
  initialWaitlist,
  initialWaitlistError,
  initialReviewQueue,
  initialReviewQueueError,
  initialVideoReviewQueue,
  initialVideoReviewError,
  initialTasks,
  initialTasksError,
  initialSmsHolds,
  initialSmsHoldsError,
  smsHoldThreshold,
}) {
  const {
    creatorCount,
    recentCreatorCount,
    fanCount,
    recentFanCount,
    instagramSignupCount,
    recentInstagramSignupCount,
    instagramCreatorCount,
    instagramFanCount,
    instagramWaitlistCount,
    instagramCampaignMetrics = {},
    activeSubscriberCount,
    followerCount,
    recentFollowerCount,
    convertedFollowerCount,
    recentConvertedFollowerCount,
    followerConversionPercent,
    lifetimeGrossCents,
    lifetimePlatformFeeCents,
    lifetimePaymentCount,
    estimatedProcessorCents,
    estimatedContributionCents,
    openDisputeCount,
    needsReviewCount,
    monthly,
    creators,
    disputes,
  } = data;
  const campaignRecent = (event) => Number(instagramCampaignMetrics[event]?.recent || 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">Platform overview</h1>
      <p className="text-brand-ink/65">What ByUs itself has earned, and how the platform is growing.</p>

      <nav aria-label="Admin sections" className="mt-4 grid gap-3 sm:grid-cols-2">
        <a
          href="/admin/accounting"
          className="flex items-center justify-between rounded-xl border border-[#0F766E]/20 bg-[#0F766E]/5 px-4 py-3 transition hover:bg-[#0F766E]/10"
        >
          <span>
            <span className="block font-semibold text-[#172033]">Accounting</span>
            <span className="block text-xs text-brand-ink/65">Real Stripe fees, statements, creators, payouts, tax, CSV exports</span>
          </span>
          <span aria-hidden="true" className="text-[#0F766E]">→</span>
        </a>
        <a
          href="/admin/disputes"
          className="flex items-center justify-between rounded-xl border border-brand-ink/10 bg-brand-paper px-4 py-3 transition hover:bg-brand-ink/5"
        >
          <span>
            <span className="block font-semibold text-[#172033]">Disputes</span>
            <span className="block text-xs text-brand-ink/65">Chargebacks ordered by response deadline</span>
          </span>
          <span aria-hidden="true" className="text-[#0F766E]">→</span>
        </a>
        <a
          href="/admin/appeals"
          className="flex items-center justify-between rounded-xl border border-brand-ink/10 bg-brand-paper px-4 py-3 transition hover:bg-brand-ink/5"
        >
          <span>
            <span className="block font-semibold text-[#172033]">Suspension appeals</span>
            <span className="block text-xs text-brand-ink/65">Tracked appeals, oldest open case first</span>
          </span>
          <span aria-hidden="true" className="text-[#0F766E]">→</span>
        </a>
        <a
          href="/admin/compliance"
          className="flex items-center justify-between rounded-xl border border-brand-ink/10 bg-brand-paper px-4 py-3 transition hover:bg-brand-ink/5"
        >
          <span>
            <span className="block font-semibold text-[#172033]">Compliance snapshot</span>
            <span className="block text-xs text-brand-ink/65">Live enforcement stats, ready for a processor review</span>
          </span>
          <span aria-hidden="true" className="text-[#0F766E]">→</span>
        </a>
        <a
          href="/admin/risk"
          className="flex items-center justify-between rounded-xl border border-brand-ink/10 bg-brand-paper px-4 py-3 transition hover:bg-brand-ink/5"
        >
          <span>
            <span className="block font-semibold text-[#172033]">Checkout risk review</span>
            <span className="block text-xs text-brand-ink/65">Fans whose checkouts scored risky on account signals Stripe can't see</span>
          </span>
          <span aria-hidden="true" className="text-[#0F766E]">→</span>
        </a>
        <a
          href="/admin/support"
          className="flex items-center justify-between rounded-xl border border-brand-ink/10 bg-brand-paper px-4 py-3 transition hover:bg-brand-ink/5"
        >
          <span>
            <span className="block font-semibold text-[#172033]">Fan support requests</span>
            <span className="block text-xs text-brand-ink/65">Refunds and billing questions the help assistant passed to you</span>
          </span>
          <span aria-hidden="true" className="text-[#0F766E]">→</span>
        </a>
      </nav>

      <VideoModerationSection
        initialVideos={initialVideoReviewQueue}
        initialError={initialVideoReviewError}
      />

      <PendingSmsSendsSection
        initialHolds={initialSmsHolds}
        initialError={initialSmsHoldsError}
        threshold={smsHoldThreshold}
      />

      <TasksSection initialTasks={initialTasks} initialError={initialTasksError} />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="ByUs fees collected" value={formatCompactUSD(lifetimePlatformFeeCents)} hero />
        <StatTile label="Estimated contribution" value={formatCompactUSD(estimatedContributionCents)} flag={estimatedContributionCents < 0} />
        <StatTile label="Estimated processor costs" value={formatCompactUSD(estimatedProcessorCents)} />
        <StatTile label="Recorded payments" value={lifetimePaymentCount.toLocaleString()} />
        <StatTile label="Gross processed, lifetime" value={formatCompactUSD(lifetimeGrossCents)} />
        <StatTile
          label="Creators"
          value={creatorCount.toLocaleString()}
          detail={`+${recentCreatorCount.toLocaleString()} in the last 7 days`}
        />
        <StatTile
          label="Fans"
          value={fanCount.toLocaleString()}
          detail={`+${recentFanCount.toLocaleString()} in the last 7 days`}
        />
        <StatTile
          label="Instagram-attributed signups"
          value={instagramSignupCount.toLocaleString()}
          detail={`+${recentInstagramSignupCount.toLocaleString()} in 7 days · ${instagramCreatorCount.toLocaleString()} creators · ${instagramFanCount.toLocaleString()} fans`}
        />
        <StatTile
          label="Instagram waitlist applications (historical)"
          value={instagramWaitlistCount.toLocaleString()}
          detail="Frozen count from before /waitlist redirected to signup — not still growing"
        />
        <StatTile
          label="Free creator follows"
          value={followerCount.toLocaleString()}
          detail={`+${recentFollowerCount.toLocaleString()} in the last 7 days`}
        />
        <StatTile
          label="Follower-to-paid conversion"
          value={`${followerConversionPercent.toLocaleString()}%`}
          detail={`${convertedFollowerCount.toLocaleString()} total · +${recentConvertedFollowerCount.toLocaleString()} in the last 7 days`}
        />
        <StatTile label="Active subscriptions" value={activeSubscriberCount.toLocaleString()} />
        <StatTile
          label="Open disputes"
          value={openDisputeCount.toLocaleString()}
          flag={openDisputeCount > 0}
        />
        <StatTile
          label="Creators awaiting review"
          value={needsReviewCount.toLocaleString()}
          flag={needsReviewCount > 0}
        />
        <StatTile
          label="Creator waitlist"
          value={initialWaitlist === null ? '—' : initialWaitlist.length.toLocaleString()}
          detail={
            initialWaitlist === null
              ? 'Could not load'
              : `+${initialWaitlist.filter((w) => new Date(w.createdAt) >= new Date(Date.now() - 7 * 86400000)).length.toLocaleString()} in the last 7 days`
          }
        />
      </div>

      <section className="mt-6 rounded-2xl border border-[#0F766E]/15 bg-brand-paper p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold text-[#172033]">Instagram campaign funnel</h2>
            <p className="mt-1 text-sm text-brand-ink/60">Anonymous activity totals from the last 7 days</p>
          </div>
          <p className="text-sm font-semibold text-[#0F766E]">
            {recentInstagramSignupCount.toLocaleString()} completed account {recentInstagramSignupCount === 1 ? 'signup' : 'signups'}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CampaignMetric label="Page visits" value={campaignRecent('view')} />
          <CampaignMetric label="Demo clicks" value={campaignRecent('demo_click')} />
          <CampaignMetric label="Browse clicks" value={campaignRecent('browse_click')} />
          <CampaignMetric label="Signup clicks" value={campaignRecent('signup_click')} />
        </div>
        <p className="mt-3 text-xs text-brand-ink/50">
          Counts begin when this tracker was enabled. Reloads can count as another visit; no personal visitor data is stored.
        </p>
      </section>

      <CreatorWaitlistSection initialWaitlist={initialWaitlist} initialError={initialWaitlistError} />

      <div className="mt-3 rounded-xl border border-[#2563EB]/15 bg-[#2563EB]/5 px-4 py-3 text-xs text-brand-ink/65">
        Estimates use standard domestic card pricing of 2.9% + 30¢ plus 0.7% Billing.
        They exclude Connect account/payout fees, refunds, dispute fees, international costs,
        taxes, and negotiated Stripe pricing. Stripe statements remain the source of truth —{' '}
        <a href="/admin/accounting" className="font-semibold text-[#0F766E] hover:underline">Accounting</a> shows the real figures.
      </div>

      <div className="mt-6 space-y-4">
        <ChartCard title="ByUs revenue" subtitle="Platform fee income, by month">
          <MonthlyBarChart data={monthly} valueKey="platformFeeCents" formatValue={formatUSD} formatAxisTick={formatUSD} />
        </ChartCard>
        <ChartCard title="Estimated contribution" subtitle="ByUs fees minus estimated Payments + Billing costs">
          <MonthlyBarChart data={monthly} valueKey="estimatedContributionCents" formatValue={formatUSD} formatAxisTick={formatUSD} color="#0F766E" hoverColor="#115E59" />
        </ChartCard>
        <div className="grid gap-4 md:grid-cols-3">
          <ChartCard title="New creators" subtitle="Signups, by month">
            <MonthlyBarChart
              data={monthly}
              valueKey="newCreators"
              formatValue={(n) => `${n.toLocaleString()} new`}
              formatAxisTick={(n) => n.toLocaleString()}
            />
          </ChartCard>
          <ChartCard title="New fans" subtitle="Signups, by month">
            <MonthlyBarChart
              data={monthly}
              valueKey="newFans"
              formatValue={(n) => `${n.toLocaleString()} new`}
              formatAxisTick={(n) => n.toLocaleString()}
              color="#0F766E"
              hoverColor="#a5854a"
            />
          </ChartCard>
          <ChartCard title="New free follows" subtitle="Creator follows, by month">
            <MonthlyBarChart
              data={monthly}
              valueKey="newFollows"
              formatValue={(n) => `${n.toLocaleString()} new`}
              formatAxisTick={(n) => n.toLocaleString()}
              color="#B45309"
              hoverColor="#92400E"
            />
          </ChartCard>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold">Disputes</h2>
        <p className="mt-1 text-sm text-brand-ink/65">
          A fan's bank disputing a charge — most need a response through Stripe's own dispute
          flow before they're resolved one way or the other.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-left text-xs font-medium uppercase tracking-wide text-brand-ink/60">
                <th className="py-2 pr-4">Fan</th>
                <th className="py-2 pr-4">Creator</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2 pr-4">Reason</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Opened</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id} className="border-b border-brand-ink/5">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[#172033]">{d.fanName || 'Unknown fan'}</div>
                    <div className="text-xs text-brand-ink/60">{d.fanEmail || '—'}</div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[#172033]">{d.creatorName || 'Unknown creator'}</div>
                    <div className="text-xs text-brand-ink/60">{d.creatorEmail || '—'}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium text-[#172033]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatUSD(d.amountCents)}
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">{d.reason ? formatDisputeLabel(d.reason) : '—'}</td>
                  <td className="py-2.5 pr-4">
                    <DisputeStatusBadge status={d.status} />
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">
                    {new Date(d.openedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
              {disputes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-brand-ink/60">
                    No disputes — nothing to review.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReviewQueueSection initialQueue={initialReviewQueue} initialError={initialReviewQueueError} />

      <div className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold">Recent creators</h2>
        <p className="mt-1 text-sm text-brand-ink/65">
          Most recent signups first — worth a look if Stripe was never connected or earnings stayed at $0.
          Follow → paid counts active memberships that started after the supporter followed. A creator
          flagged &ldquo;Needs review&rdquo; has no posts live and can&rsquo;t accept a fan&rsquo;s first
          payment yet — see the Review column.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-left text-xs font-medium uppercase tracking-wide text-brand-ink/60">
                <th className="py-2 pr-4">Creator</th>
                <th className="py-2 pr-4">Joined</th>
                <th className="py-2 pr-4">Stripe</th>
                <th className="py-2 pr-4">Fee</th>
                <th className="py-2 pr-4 text-right">Free followers</th>
                <th className="py-2 pr-4 text-right">Follow → paid</th>
                <th className="py-2 pr-4 text-right">Lifetime gross</th>
                <th className="py-2 pr-4 text-right">Est. contribution</th>
                <th className="py-2 pr-4">Review</th>
                <th className="py-2 pr-4">Account</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c) => (
                <tr key={c.id} className="border-b border-brand-ink/5">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[#172033]">
                      {c.displayName || 'Unnamed creator'}
                      {c.bioFlagged && (
                        <span
                          className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                          title="This creator's bio contains something that looks like a link — worth a look."
                        >
                          Bio has a link
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-brand-ink/60">{c.email}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">
                    {new Date(c.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-2.5 pr-4">
                    {c.stripeConnectOnboarded ? (
                      <span className="rounded-full bg-[#0F766E]/10 px-2 py-0.5 text-xs font-medium text-[#0F766E]">Connected</span>
                    ) : (
                      <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-xs font-medium text-brand-ink/60">Not connected</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">{c.platformFeePercent}%</td>
                  <td className="py-2.5 pr-4 text-right font-medium text-[#172033]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {c.followerCount.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <div className="font-medium text-[#172033]">
                      {c.convertedFollowerCount.toLocaleString()} of {c.followerCount.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-brand-ink/55">
                      {c.followerCount >= 10
                        ? `${c.followerConversionPercent.toLocaleString()}%`
                        : c.followerCount > 0
                          ? 'Early data'
                          : 'No followers yet'}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium text-[#172033]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatUSD(c.lifetimeGrossCents)}
                  </td>
                  <td className={`py-2.5 pr-4 text-right font-medium ${c.estimatedContributionCents < 0 ? 'text-red-700' : 'text-[#0F766E]'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatUSD(c.estimatedContributionCents)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <ReviewControl userId={c.id} initialNeedsReview={c.needsReview} />
                  </td>
                  <td className="py-2.5 pr-4">
                    <SuspendControl
                      userId={c.id}
                      initialSuspended={c.isSuspended}
                      initialReason={c.suspensionReason}
                      protectedAccount={c.isProtectedAdmin}
                    />
                  </td>
                </tr>
              ))}
              {creators.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-brand-ink/60">
                    No creators have signed up yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SiteFeedbackSection initialFeedback={initialSiteFeedback} initialError={initialSiteFeedbackError} />
            <ReportsSection initialReports={initialReports} initialError={initialReportsError} />
      <SuggestionsSection initialSuggestions={initialSuggestions} initialError={initialSuggestionsError} />
    </div>
  );
}

function VideoModerationSection({ initialVideos, initialError }) {
  const [videos, setVideos] = useState(initialVideos || []);
  const [error, setError] = useState(initialError || '');
  const [pendingId, setPendingId] = useState(null);

  async function moderate(video, action) {
    if (action === 'reject' && !confirm('Reject and permanently delete this video? This cannot be undone.')) {
      return;
    }

    setPendingId(video.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/posts/${video.id}/moderation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not review this video.');
      setVideos((current) => current.filter((item) => item.id !== video.id));
    } catch (err) {
      setError(err.message || 'Could not review this video.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-[#172033]">Pending video moderation</h2>
          <p className="mt-1 max-w-2xl text-sm text-brand-ink/65">
            Mux AI clears straightforward uploads automatically. Flagged, uncertain, and failed
            scans stay hidden here for a human decision.
          </p>
        </div>
        <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-bold text-amber-900">
          {videos.length} waiting
        </span>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}

      <div className="mt-4 space-y-4">
        {videos.map((video) => (
          <article key={video.id} className="rounded-xl border border-amber-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-[#172033]">{video.title || '(untitled video)'}</h3>
                <p className="text-xs text-brand-ink/55">
                  {video.creatorName || video.creatorEmail} · {video.visibility === 'subscribers_only' ? 'Subscribers only' : 'Public'} · {new Date(video.createdAt).toLocaleString()}
                </p>
              </div>
              {!video.creatorReviewCleared && (
                <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                  Creator account review still pending
                </span>
              )}
              <ModerationBadge video={video} />
            </div>

            <div className="mt-3 max-w-xl overflow-hidden rounded-xl bg-black">
              <PostVideoPlayer playbackId={video.video.playbackId} playbackToken={video.video.playbackToken} />
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-brand-ink/75">{video.body}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pendingId === video.id || !video.creatorReviewCleared}
                onClick={() => moderate(video, 'approve')}
                className="rounded-full bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {pendingId === video.id ? 'Working…' : 'Approve and publish'}
              </button>
              <button
                type="button"
                disabled={pendingId === video.id}
                onClick={() => moderate(video, 'reject')}
                className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
              >
                Reject and delete
              </button>
            </div>
          </article>
        ))}

        {videos.length === 0 && !error && (
          <p className="rounded-xl border border-dashed border-amber-300 px-4 py-5 text-center text-sm text-brand-ink/60">
            No videos are waiting for review.
          </p>
        )}
      </div>
    </section>
  );
}

function ModerationBadge({ video }) {
  const statusLabels = {
    queued: 'AI scan queued',
    scanning: 'AI scanning',
    rescan_starting: 'AI preparing deeper scan',
    rescanning: 'AI checking again',
    flagged: 'AI flagged',
    scan_failed: 'AI scan failed',
    manual_review: 'Human review required',
    approved_creator_pending: 'AI cleared · creator pending',
  };
  const scores = video.moderationScores;

  return (
    <div className="text-right">
      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
        video.moderationStatus === 'flagged'
          ? 'bg-red-100 text-red-700'
          : 'bg-amber-100 text-amber-800'
      }`}>
        {statusLabels[video.moderationStatus] || 'Human review required'}
      </span>
      {scores && (
        <p className="mt-1 text-[11px] text-brand-ink/55">
          Sexual {Math.round((scores.sexual || 0) * 100)}% · Violence {Math.round((scores.violence || 0) * 100)}%
        </p>
      )}
    </div>
  );
}

const FEEDBACK_REACTION_LABELS = { up: '👍 Liked it', down: '👎 Didn’t like it' };

// Everyone who's joined the creator waitlist (see lib/admin-data.js's loadCreatorWaitlist
// and the comment there for how this differs from the frozen "Instagram waitlist
// applications (historical)" stat above). The one action here is reopening day's
// "Email the waitlist" button (app/api/admin/waitlist/notify-reopen), which stays
// disabled until CREATOR_SIGNUP_PAUSED in lib/creator-signup.js is flipped to false and
// emails each person at most once.
const WAITLIST_SOURCE_LABELS = {
  instagram: 'Instagram',
  instagram_campaign: 'Instagram (legacy)',
  blogger: 'Bloggers page',
};

function CreatorWaitlistSection({ initialWaitlist, initialError }) {
  const [waitlist, setWaitlist] = useState(initialWaitlist);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [sendError, setSendError] = useState('');
  // The reopening email only goes to people in countries where creator accounts are open
  // (US at launch -- see app/api/admin/waitlist/notify-reopen/route.js).
  const openNow = (w) => creatorCountryStatus(w.country) === 'launch';
  const notYetEmailed = (waitlist || []).filter((w) => !w.reopenNotifiedAt && openNow(w)).length;
  const waitingOnCountry = (waitlist || []).filter((w) => creatorCountryStatus(w.country) === 'soon').length;

  async function emailWaitlist() {
    if (!window.confirm(`Email ${notYetEmailed} ${notYetEmailed === 1 ? 'person' : 'people'} that creator signups are open?`)) return;
    setSending(true);
    setSendError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/waitlist/notify-reopen', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || '');
      setNotice(
        `Sent ${body.sent.toLocaleString()}.` +
          (body.failed ? ` ${body.failed} failed and can be retried.` : '') +
          (body.remaining ? ` ${body.remaining} still to email; press again.` : '')
      );
      if (body.sent > 0 && body.remaining === 0 && !body.failed) {
        const now = new Date().toISOString();
        setWaitlist((current) => (current || []).map((w) => (w.reopenNotifiedAt || !openNow(w) ? w : { ...w, reopenNotifiedAt: now })));
      }
    } catch (err) {
      setSendError(err.message || 'Could not send the emails. Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-[#172033]">Creator waitlist</h2>
        {waitlist && waitlist.length > 0 && (
          <span className="rounded-full bg-brand-ink/5 px-2.5 py-1 text-xs font-medium text-brand-ink/60">
            {waitlist.length.toLocaleString()} total
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-brand-ink/65">
        Everyone who's asked to be notified when creator signup reopens (see the "I'm a creator" tab on{' '}
        <code className="text-xs">/signup</code>). When signup reopens, one button emails each of them a link
        to claim their spot.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={emailWaitlist}
          disabled={CREATOR_SIGNUP_PAUSED || sending || notYetEmailed === 0}
          className="rounded-full bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#115E59] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? 'Sending…' : 'Email the waitlist: signups are open'}
        </button>
        <span className="text-xs text-brand-ink/60">
          {CREATOR_SIGNUP_PAUSED
            ? 'Available once creator signup reopens.'
            : notYetEmailed === 0
              ? 'Everyone on the list has been emailed.'
              : `${notYetEmailed.toLocaleString()} not emailed yet.`}
        </span>
      </div>
      {waitingOnCountry > 0 && (
        <p className="mt-2 text-xs text-brand-ink/60">
          {waitingOnCountry.toLocaleString()} {waitingOnCountry === 1 ? 'person is' : 'people are'} in the UK, Europe or
          Canada and won't get this email until creator accounts open in their country.
        </p>
      )}
      {notice && <p className="mt-2 text-xs text-[#0F766E]">{notice}</p>}
      {sendError && <p className="mt-2 text-xs text-red-600">{sendError}</p>}

      {initialError && <p className="mt-3 text-xs text-red-600">{initialError}</p>}

      {waitlist === null ? (
        <p className="mt-4 text-sm text-brand-ink/60">Could not load the creator waitlist.</p>
      ) : waitlist.length === 0 ? (
        <p className="mt-4 text-sm text-brand-ink/60">Nobody's joined the waitlist yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-left text-xs font-medium uppercase tracking-wide text-brand-ink/60">
                <th className="py-2 pr-4">Contact</th>
                <th className="py-2 pr-4">Country</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Referral</th>
                <th className="py-2 pr-4">Joined</th>
                <th className="py-2 pr-4">Reopening email</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.map((w) => (
                <tr key={w.id} className="border-b border-brand-ink/5">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-[#172033]">{w.displayName || 'No name given'}</div>
                    <a href={`mailto:${w.email}`} className="text-xs text-[#0F766E] hover:underline">
                      {w.email}
                    </a>
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">
                    {w.country ? creatorCountryName(w.country) : 'United States*'}
                    {creatorCountryStatus(w.country) === 'soon' && (
                      <span className="ml-1.5 rounded-full bg-[#C9A961]/20 px-2 py-0.5 text-[11px] font-semibold text-[#6B531F]">Later</span>
                    )}
                    {creatorCountryStatus(w.country) === 'unsupported' && (
                      <span className="ml-1.5 rounded-full bg-brand-ink/10 px-2 py-0.5 text-[11px] font-semibold text-brand-ink/60">Not supported</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">
                    {w.source ? WAITLIST_SOURCE_LABELS[w.source] || w.source : '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">{w.referralCode || '—'}</td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">
                    {new Date(w.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="py-2.5 pr-4 text-brand-ink/70">
                    {w.reopenNotifiedAt
                      ? new Date(w.reopenNotifiedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-brand-ink/50">* Joined before the country question was added; treated as US.</p>
        </div>
      )}
    </section>
  );
}

// Guardrail for the automatic new-post text blast (see lib/sms-holds.js and
// notifySubscribersOfNewPostBySms in app/api/creator/posts/route.js) -- sent.dm bills
// per contact per month plus per-text carrier cost, so anything over the threshold is
// held here instead of sent automatically. Sits above the task list since a pending
// hold is real, waiting money, not a to-do item; unlike the task list it's meant to sit
// empty most of the time, so it stays visually quiet (no border/tint) when there's
// nothing waiting rather than permanently claiming attention on an otherwise calm page.
function PendingSmsSendsSection({ initialHolds, initialError, threshold }) {
  const [holds, setHolds] = useState(initialHolds); // null = failed to load
  const [error, setError] = useState(initialError || '');
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({}); // id -> outcome message, shown briefly after approve

  async function resolve(id, action) {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/admin/sms-holds/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || '');
      setHolds((current) => current.filter((h) => h.id !== id));
      if (action === 'approve') {
        setNotes((current) => ({
          ...current,
          [id]: `Sent to ${body.sent.toLocaleString()} of ${body.eligible.toLocaleString()} currently opted-in fans.`,
        }));
      }
    } catch (err) {
      setError(err.message || `Could not ${action === 'approve' ? 'send' : 'dismiss'} that — try again.`);
    } finally {
      setBusyId(null);
    }
  }

  const hasPending = holds !== null && holds.length > 0;

  return (
    <section className={`mt-6 rounded-2xl border p-6 ${hasPending ? 'border-amber-300 bg-amber-50/50' : 'border-brand-ink/10 bg-brand-paper'}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#172033]">Pending SMS sends</h2>
        {hasPending && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
            {holds.length} waiting
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-brand-ink/65">
        A new-post text blast over {threshold?.toLocaleString() || '2,000'} recipients costs real money and waits
        here for approval instead of sending itself.
      </p>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {holds === null ? (
        <p className="mt-4 text-sm text-brand-ink/60">Could not load pending SMS sends.</p>
      ) : holds.length === 0 ? (
        <p className="mt-4 text-sm text-brand-ink/50">Nothing waiting.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {holds.map((hold) => (
            <div key={hold.id} className="rounded-xl border border-amber-300/70 bg-brand-paper p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#172033]">
                    {hold.creatorName}
                    {hold.postTitle ? <> &mdash; &ldquo;{hold.postTitle}&rdquo;</> : null}
                  </p>
                  <p className="mt-1 text-sm text-brand-ink/65">
                    Would text{' '}
                    <span className="font-bold tabular-nums text-amber-800">
                      {hold.recipientCount.toLocaleString()}
                    </span>{' '}
                    subscribers &middot; held {new Date(hold.createdAt).toLocaleString()}
                  </p>
                  {notes[hold.id] && <p className="mt-1 text-sm font-medium text-green-700">{notes[hold.id]}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => resolve(hold.id, 'approve')}
                    disabled={busyId === hold.id}
                    className="rounded-full bg-[#0F766E] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
                  >
                    {busyId === hold.id ? 'Working…' : 'Approve & send'}
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve(hold.id, 'reject')}
                    disabled={busyId === hold.id}
                    className="rounded-full border border-brand-ink/20 px-4 py-1.5 text-sm font-semibold text-brand-ink/70 hover:bg-brand-ink/5 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// The team's own internal punch-list (see database/migrations/20260919_admin_tasks.sql)
// -- a running list of what still needs doing as the platform grows, replacing tracking
// it by hand across chat/notes. Sits right under PendingSmsSendsSection -- that one
// holds real waiting money and gets first look, this is the next thing meant to be
// checked and updated constantly.
const TASK_STATUSES = ['todo', 'doing', 'done'];
const TASK_STATUS_LABELS = { todo: 'To do', doing: 'Doing', done: 'Done' };
const TASK_STATUS_STYLES = {
  todo: 'bg-brand-ink/5 text-brand-ink/60',
  doing: 'bg-amber-50 text-amber-700',
  done: 'bg-green-50 text-green-700',
};

function TasksSection({ initialTasks, initialError }) {
  const [tasks, setTasks] = useState(initialTasks); // null = failed to load
  const [error, setError] = useState(initialError || '');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [hideDone, setHideDone] = useState(true);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed, category: category.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || '');
      setTasks((current) => [body.task, ...(current || [])]);
      setTitle('');
      setCategory('');
    } catch (err) {
      setError(err.message || 'Could not add that task — try again.');
    } finally {
      setAdding(false);
    }
  }

  async function updateTask(id, patch) {
    const previous = tasks;
    setTasks((current) => current.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const res = await fetch(`/api/admin/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTasks(previous);
      setError('Could not save that change — try again.');
    }
  }

  async function deleteTask(id) {
    const previous = tasks;
    setTasks((current) => current.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/admin/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setTasks(previous);
      setError('Could not remove that task — try again.');
    }
  }

  const openCount = tasks?.filter((t) => t.status !== 'done').length ?? 0;
  const visibleTasks = tasks?.filter((t) => !hideDone || t.status !== 'done') ?? null;

  return (
    <section className="mt-6 rounded-2xl border border-[#0F766E]/15 bg-brand-paper p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#172033]">Task list</h2>
        {tasks !== null && (
          <span className="rounded-full bg-[#0F766E]/10 px-2.5 py-1 text-xs font-medium text-[#0F766E]">
            {openCount} open
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-brand-ink/65">Your own running punch-list — visible only to you.</p>

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          maxLength={200}
          className="min-w-[200px] flex-1 rounded-lg border border-brand-ink/10 px-3 py-1.5 text-sm"
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (optional)"
          maxLength={60}
          className="w-40 rounded-lg border border-brand-ink/10 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={adding || !title.trim()}
          className="shrink-0 rounded-full bg-[#0F766E] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {tasks !== null && tasks.some((t) => t.status === 'done') && (
        <label className="mt-4 flex items-center gap-2 text-xs text-brand-ink/60">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          Hide done tasks
        </label>
      )}

      {tasks === null ? (
        <p className="mt-4 text-sm text-brand-ink/60">Could not load the task list.</p>
      ) : visibleTasks.length === 0 ? (
        <p className="mt-4 text-sm text-brand-ink/60">
          {tasks.length === 0 ? 'Nothing on the list yet.' : 'Nothing open — everything is done.'}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleTasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onUpdate={(patch) => updateTask(t.id, patch)}
              onDelete={() => deleteTask(t.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskRow({ task, onUpdate, onDelete }) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(task.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);

  async function handleSaveNotes() {
    setSavingNotes(true);
    await onUpdate({ notes });
    setSavingNotes(false);
    setEditingNotes(false);
  }

  return (
    <div className={`rounded-lg border p-3 ${task.status === 'done' ? 'border-brand-ink/5 bg-brand-ink/[0.015]' : 'border-brand-ink/10'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={task.status === 'done' ? 'text-sm text-brand-ink/45 line-through' : 'text-sm font-medium text-[#172033]'}>
            {task.title}
          </span>
          {task.category && (
            <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-[11px] font-medium text-brand-ink/55">
              {task.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={task.status}
            onChange={(e) => onUpdate({ status: e.target.value })}
            className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${TASK_STATUS_STYLES[task.status]}`}
          >
            {TASK_STATUSES.map((st) => (
              <option key={st} value={st}>
                {TASK_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setEditingNotes((v) => !v)}
            className="text-xs font-medium text-brand-ink/45 hover:text-brand-ink/70"
          >
            {task.notes ? 'Notes' : '+ Note'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs font-medium text-red-600/70 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      {!editingNotes && task.notes && (
        <p className="mt-2 text-sm text-brand-ink/70">{task.notes}</p>
      )}

      {editingNotes && (
        <div className="mt-2 flex items-start gap-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes…"
            rows={2}
            maxLength={4000}
            className="w-full rounded-lg border border-brand-ink/10 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="shrink-0 rounded-full border border-[#0F766E] px-3 py-1.5 text-xs font-medium text-[#0F766E] hover:bg-[#0F766E]/5 disabled:opacity-50"
          >
            {savingNotes ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

function SiteFeedbackSection({ initialFeedback, initialError }) {
  const [feedback, setFeedback] = useState(initialFeedback); // null = failed to load
  const [error, setError] = useState(initialError || '');

  async function toggleReviewed(id, nextStatus) {
    const previous = feedback;
    setFeedback((current) => current.map((f) => (f.id === id ? { ...f, status: nextStatus } : f)));
    try {
      const res = await fetch(`/api/admin/site-feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFeedback(previous);
      setError('Could not save that change — try again.');
    }
  }

  const newCount = feedback?.filter((f) => f.status === 'new').length ?? 0;
  const upCount = feedback?.filter((f) => f.reaction === 'up').length ?? 0;
  const downCount = feedback?.filter((f) => f.reaction === 'down').length ?? 0;

  return (
    <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#172033]">Visitor feedback</h2>
        {newCount > 0 && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            {newCount} new
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-brand-ink/65">
        What visitors said via the feedback tab on the homepage — anonymous, no account required.
        {feedback && feedback.length > 0 && (
          <> {upCount} 👍 · {downCount} 👎 · {feedback.length} total.</>
        )}
      </p>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {feedback === null ? (
        <p className="mt-4 text-sm text-brand-ink/60">Could not load visitor feedback.</p>
      ) : feedback.length === 0 ? (
        <p className="mt-4 text-sm text-brand-ink/60">Nothing submitted yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {feedback.map((f) => (
            <div
              key={f.id}
              className={`rounded-lg border p-4 ${
                f.status === 'new' ? 'border-brand-ink/10' : 'border-brand-ink/5 bg-brand-ink/[0.015]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  {f.reaction && (
                    <span className="font-medium text-[#172033]">{FEEDBACK_REACTION_LABELS[f.reaction]}</span>
                  )}
                  {f.pagePath && <span className="text-xs text-brand-ink/45">{f.pagePath}</span>}
                  <span className="text-xs text-brand-ink/45">
                    {new Date(f.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleReviewed(f.id, f.status === 'new' ? 'reviewed' : 'new')}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    f.status === 'new' ? 'bg-red-50 text-red-700' : 'bg-brand-ink/5 text-brand-ink/60'
                  }`}
                >
                  {f.status === 'new' ? 'Mark reviewed' : 'Reviewed'}
                </button>
              </div>
              {f.message && <p className="mt-2 text-sm leading-relaxed text-brand-ink/75">{f.message}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Trust & safety queue — renders first among the two self-contained sections below the
// main tables: a flagged creator/post is something the team needs to act on, not just
// read when convenient. See app/api/admin/reports/route.js and
// app/api/admin/reports/[id]/route.js, and app/creator/[creatorId]/page.js's
// ReportButton for the submitter-facing side. This is the actual enforcement mechanism
// behind the no-adult-content policy in Section 5 of app/terms/page.js -- without a
// queue like this, that policy is just a sentence nobody can act on.
//
// initialReports/initialError come from the server-rendered page (lib/admin-data.js's
// loadAdminReports, called in app/admin/page.js) — no client fetch for the initial
// list anymore, only for the per-row status/note mutations.
const REPORT_STATUSES = ['new', 'reviewed', 'resolved', 'dismissed'];
const REPORT_STATUS_STYLES = {
  new: 'bg-red-50 text-red-700',
  reviewed: 'bg-amber-50 text-amber-700',
  resolved: 'bg-green-50 text-green-700',
  dismissed: 'bg-brand-ink/5 text-brand-ink/60',
};
const REPORT_REASON_LABELS = {
  adult_content: 'Adult / sexual content',
  illegal_content: 'Illegal content',
  harassment: 'Harassment or endangerment',
  ip_infringement: 'Copyright / IP infringement',
  hate_violence: 'Hate speech or violent extremism',
  other: 'Something else',
};

function ReportsSection({ initialReports, initialError }) {
  const [reports, setReports] = useState(initialReports); // null = failed to load
  const [error, setError] = useState(initialError || '');

  async function updateReport(id, patch) {
    // Optimistic, same trade-off as SuggestionsSection below — this is an admin-only
    // triage action, not worth a spinner per row; revert on failure instead.
    const previous = reports;
    setReports((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      setReports(previous);
      setError('Could not save that change — try again.');
    }
  }

  const openCount = reports?.filter((r) => r.status === 'new').length ?? 0;

  return (
    <div className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Reports</h2>
        {openCount > 0 && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            {openCount} new
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-brand-ink/65">
        Content flagged by creators or fans — a page or a specific post someone thinks
        breaks the content guidelines.
      </p>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {reports === null ? (
        <p className="mt-4 text-sm text-brand-ink/60">Could not load reports.</p>
      ) : reports.length === 0 ? (
        <p className="mt-4 text-sm text-brand-ink/60">No reports — nothing's been flagged.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} onUpdate={(patch) => updateReport(r.id, patch)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportRow({ report, onUpdate }) {
  const [note, setNote] = useState(report.admin_note || '');
  const [savingNote, setSavingNote] = useState(false);

  async function handleSaveNote() {
    setSavingNote(true);
    await onUpdate({ admin_note: note });
    setSavingNote(false);
  }

  return (
    <div className="rounded-lg border border-brand-ink/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-[#172033]">
            <a href={`/creator/${report.creator_slug || report.creator_id}`} target="_blank" className="hover:underline">
              {report.creator_name || 'Unnamed creator'}
            </a>
            {report.post_id && (
              <span className="font-normal text-brand-ink/50"> — post: {report.post_title || '(untitled)'}</span>
            )}
          </div>
          <div className="text-xs text-brand-ink/60">
            Reported by {report.reporter_name || 'someone'} ({report.reporter_email})
          </div>
          <div className="mt-2">
            <SuspendControl
              userId={report.creator_id}
              initialSuspended={report.creator_is_suspended}
              initialReason={report.creator_suspension_reason}
            />
          </div>
        </div>
        <select
          value={report.status}
          onChange={(e) => onUpdate({ status: e.target.value })}
          className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${REPORT_STATUS_STYLES[report.status]}`}
        >
          {REPORT_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st.charAt(0).toUpperCase() + st.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-sm font-medium text-[#172033]">
        {REPORT_REASON_LABELS[report.reason] || report.reason}
      </p>
      {report.details && <p className="mt-1 text-sm text-brand-ink/80">{report.details}</p>}
      <p className="mt-1 text-xs text-brand-ink/50">
        {new Date(report.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </p>

      <div className="mt-3 flex items-start gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Internal note — what you found, what you did"
          className="w-full rounded-lg border border-brand-ink/10 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={handleSaveNote}
          disabled={savingNote || note === (report.admin_note || '')}
          className="shrink-0 rounded-full border border-[#0F766E] px-3 py-1.5 text-xs font-medium text-[#0F766E] hover:bg-[#0F766E]/5 disabled:opacity-50"
        >
          {savingNote ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  );
}

// The actual enforcement action, embedded wherever an admin might decide to use it --
// the Recent creators table (spotting a problem account) and each report row (acting on
// what was just flagged). Each instance manages its own local state rather than syncing
// through the parent's data/reports state: this mirrors ReportsSection/SuggestionsSection
// being independent of each other on this same page, and a full reload always shows the
// current truth regardless. See app/api/admin/users/[id]/route.js for what this actually
// does -- notably, it does NOT touch Stripe subscriptions or payouts.
function SuspendControl({ userId, initialSuspended, initialReason, protectedAccount = false }) {
  const [suspended, setSuspended] = useState(Boolean(initialSuspended));
  const [reason, setReason] = useState(initialReason || '');
  const [open, setOpen] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (protectedAccount) {
    return (
      <span
        className="rounded-full bg-[#0F766E]/10 px-2 py-0.5 text-xs font-medium text-[#0F766E]"
        title="Admin/owner accounts can't be suspended from the admin dashboard."
      >
        Protected
      </span>
    );
  }

  async function submit(nextSuspended, nextReason) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_suspended: nextSuspended, suspension_reason: nextReason || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save that change.');
      setSuspended(nextSuspended);
      setReason(nextReason || '');
      setOpen(false);
      setReasonInput('');
    } catch (err) {
      setError(err.message || 'Could not save that change.');
    } finally {
      setSaving(false);
    }
  }

  if (suspended) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
          title={reason || undefined}
        >
          Suspended
        </span>
        <button
          type="button"
          onClick={() => submit(false, '')}
          disabled={saving}
          className="text-xs font-medium text-[#0F766E] hover:underline disabled:opacity-50"
        >
          {saving ? 'Reinstating…' : 'Reinstate'}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-red-600 hover:underline">
        Suspend
      </button>
    );
  }

  return (
    <div className="w-64 rounded-lg border border-brand-ink/10 bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold text-[#172033]">Suspend this account?</p>
      <p className="mt-1 text-xs text-brand-ink/60">
        Blocks login immediately and hides their public page from Browse and search. Doesn&rsquo;t
        touch Stripe — cancel subscriptions or payouts there separately if that&rsquo;s warranted.
      </p>
      <textarea
        value={reasonInput}
        onChange={(e) => setReasonInput(e.target.value)}
        placeholder="Reason (required, internal only)"
        rows={2}
        className="mt-2 w-full rounded-lg border border-brand-ink/15 px-2 py-1.5 text-xs"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => submit(true, reasonInput)}
          disabled={saving || !reasonInput.trim()}
          className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? 'Suspending…' : 'Confirm suspend'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError('');
          }}
          className="text-xs text-brand-ink/50 hover:text-brand-ink/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ByUs's one-time initial review gate (Stripe compliance asked for a real hold on a new
// creator's first payout, not just a policy saying someone will eventually look --
// see lib/content-policy.js's header comment and app/api/admin/users/[id]/clear-review/route.js).
// Until an admin clears a creator, their posts stay unpublished and /api/subscribe + the
// tip route refuse to let any fan pay them. Clearing is one-way, same as SuspendControl's
// reinstate-only-in-that-direction pattern -- there's no "un-clear."
function ReviewControl({ userId, initialNeedsReview, onCleared }) {
  const [needsReview, setNeedsReview] = useState(Boolean(initialNeedsReview));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function clearReview() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/clear-review`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not clear this creator for review.');
      setNeedsReview(false);
      onCleared?.();
    } catch (err) {
      setError(err.message || 'Could not clear this creator for review.');
    } finally {
      setSaving(false);
    }
  }

  if (!needsReview) {
    return <span className="text-xs text-brand-ink/40">Cleared</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          Needs review
        </span>
        <button
          type="button"
          onClick={clearReview}
          disabled={saving}
          className="text-xs font-medium text-[#0F766E] hover:underline disabled:opacity-50"
        >
          {saving ? 'Clearing…' : 'Clear for review'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Every creator still waiting on ByUs's one-time initial review, oldest-pending-first --
// see lib/admin-data.js's loadCreatorReviewQueue for why this is a separate list from
// "Recent creators" below rather than reusing it: that one is capped and sorted by signup
// recency, so once more than its cap had ever signed up, an old pending creator had no
// row anywhere on this page to actually clear them from, even though needsReviewCount
// (in the stats above) still counted them. A row disappears from this list the moment
// it's cleared -- unlike the "Recent creators" table, this one exists purely to work
// through the queue, so there's no reason to keep showing a row once it's done.
function ReviewQueueSection({ initialQueue, initialError }) {
  const [queue, setQueue] = useState(initialQueue); // null = failed to load
  const error = initialError || '';

  if (error) {
    return (
      <div className="mt-8 rounded-2xl border border-red-100 bg-red-50 p-6">
        <h2 className="font-semibold text-[#172033]">Creators awaiting review</h2>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!queue || queue.length === 0) {
    return null; // nothing pending -- no need to take up space on an otherwise-busy page
  }

  return (
    <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/40 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#172033]">Creators awaiting review</h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
          {queue.length} pending
        </span>
      </div>
      <p className="mt-1 text-sm text-brand-ink/65">
        Oldest first — every creator whose posts stay unpublished and can&rsquo;t yet accept a fan&rsquo;s
        first payment until cleared here, not just the most recent signups.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-ink/10 text-left text-xs font-medium uppercase tracking-wide text-brand-ink/60">
              <th className="py-2 pr-4">Creator</th>
              <th className="py-2 pr-4">Joined</th>
              <th className="py-2 pr-4">Stripe</th>
              <th className="py-2 pr-4">Review</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((c) => (
              <tr key={c.id} className="border-b border-brand-ink/5">
                <td className="py-2.5 pr-4">
                  <div className="font-medium text-[#172033]">
                    {c.displayName || 'Unnamed creator'}
                    {c.bioFlagged && (
                      <span
                        className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                        title="This creator's bio contains something that looks like a link — worth a look."
                      >
                        Bio has a link
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-brand-ink/60">{c.email}</div>
                </td>
                <td className="py-2.5 pr-4 text-brand-ink/70">
                  {new Date(c.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
                <td className="py-2.5 pr-4">
                  {c.stripeConnectOnboarded ? (
                    <span className="rounded-full bg-[#0F766E]/10 px-2 py-0.5 text-xs font-medium text-[#0F766E]">Connected</span>
                  ) : (
                    <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-xs font-medium text-brand-ink/60">Not connected</span>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <ReviewControl
                    userId={c.id}
                    initialNeedsReview
                    onCleared={() => setQueue((current) => current.filter((row) => row.id !== c.id))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Separate from the platform-revenue overview above -- suggestions are unrelated to
// those numbers, and this section needs its own optimistic per-row update logic
// (status change, admin reply) that has no business living in that response shape.
// See app/api/admin/suggestions/route.js and app/api/admin/suggestions/[id]/route.js,
// and app/settings/SettingsClient.js's SuggestionBoxCard for the submitter-facing side
// of the same loop.
//
// initialSuggestions/initialError come from the server-rendered page (lib/admin-data.js's
// loadAdminSuggestions, called in app/admin/page.js) — no client fetch for the initial
// list anymore, only for the per-row status/note mutations.
const SUGGESTION_STATUSES = ['new', 'reviewed', 'planned', 'shipped'];
const SUGGESTION_STATUS_STYLES = {
  new: 'bg-brand-ink/5 text-brand-ink/60',
  reviewed: 'bg-amber-50 text-amber-700',
  planned: 'bg-blue-50 text-blue-700',
  shipped: 'bg-green-50 text-green-700',
};

function SuggestionsSection({ initialSuggestions, initialError }) {
  const [suggestions, setSuggestions] = useState(initialSuggestions); // null = failed to load
  const [error, setError] = useState(initialError || '');

  async function updateSuggestion(id, patch) {
    // Optimistic -- this is a low-stakes admin-only triage action, not worth a spinner
    // per row; revert to the previous list on failure instead.
    const previous = suggestions;
    setSuggestions((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      const res = await fetch(`/api/admin/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSuggestions(previous);
      setError('Could not save that change — try again.');
    }
  }

  const openCount = suggestions?.filter((s) => s.status === 'new').length ?? 0;

  return (
    <div className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Suggestions</h2>
        {openCount > 0 && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            {openCount} new
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-brand-ink/65">
        What creators and fans have sent in from Settings — reply and it shows up right
        back on their end.
      </p>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {suggestions === null ? (
        <p className="mt-4 text-sm text-brand-ink/60">Could not load suggestions.</p>
      ) : suggestions.length === 0 ? (
        <p className="mt-4 text-sm text-brand-ink/60">No suggestions yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {suggestions.map((s) => (
            <SuggestionRow key={s.id} suggestion={s} onUpdate={(patch) => updateSuggestion(s.id, patch)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionRow({ suggestion, onUpdate }) {
  const [note, setNote] = useState(suggestion.admin_note || '');
  const [savingNote, setSavingNote] = useState(false);

  async function handleSaveNote() {
    setSavingNote(true);
    await onUpdate({ admin_note: note });
    setSavingNote(false);
  }

  return (
    <div className="rounded-lg border border-brand-ink/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-[#172033]">
            {suggestion.display_name || 'Unnamed'}{' '}
            <span className="font-normal text-brand-ink/50">({suggestion.role})</span>
          </div>
          <div className="text-xs text-brand-ink/60">{suggestion.email}</div>
        </div>
        <select
          value={suggestion.status}
          onChange={(e) => onUpdate({ status: e.target.value })}
          className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${SUGGESTION_STATUS_STYLES[suggestion.status]}`}
        >
          {SUGGESTION_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st.charAt(0).toUpperCase() + st.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-sm text-brand-ink/85">{suggestion.message}</p>
      <p className="mt-1 text-xs text-brand-ink/50">
        {new Date(suggestion.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </p>

      <div className="mt-3 flex items-start gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reply — shows up on their Settings page"
          className="w-full rounded-lg border border-brand-ink/10 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={handleSaveNote}
          disabled={savingNote || note === (suggestion.admin_note || '')}
          className="shrink-0 rounded-full border border-[#0F766E] px-3 py-1.5 text-xs font-medium text-[#0F766E] hover:bg-[#0F766E]/5 disabled:opacity-50"
        >
          {savingNote ? 'Saving…' : 'Save reply'}
        </button>
      </div>
    </div>
  );
}

function CampaignMetric({ label, value }) {
  return (
    <div className="rounded-xl bg-[#0F766E]/5 px-3 py-3 text-center">
      <p className="text-2xl font-semibold tabular-nums text-[#172033]">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-brand-ink/60">{label}</p>
    </div>
  );
}

// `flag`: this number is something the owner should actually go look at (e.g. one or
// more open disputes) -- shifts the tile to a warm border/value color instead of the
// neutral default, the same "don't make them hunt for it" reasoning as the dashboard's
// other status pills.
function StatTile({ label, value, detail, hero, flag, className = '' }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        flag ? 'border-amber-300/60 bg-amber-50' : 'border-brand-ink/5 bg-brand-paper'
      } ${className}`}
    >
      <p className="text-xs text-brand-ink/65">{label}</p>
      <p
        className={`mt-1 font-semibold ${flag ? 'text-amber-700' : 'text-[#172033]'} ${
          hero ? 'text-2xl' : 'text-xl'
        }`}
      >
        {value}
      </p>
      {detail && <p className="mt-1 text-[11px] text-brand-ink/55">{detail}</p>}
    </div>
  );
}

// Stripe's raw dispute status strings ('needs_response', 'warning_under_review', etc.)
// aren't something to show a human as-is. Won/lost/refunded are the terminal states
// (color-coded so they read as resolved at a glance); everything else still needs
// action, so it stays amber rather than trying to enumerate every in-between status.
function DisputeStatusBadge({ status }) {
  const terminal = {
    won: { label: 'Won', className: 'bg-green-50 text-green-700' },
    lost: { label: 'Lost', className: 'bg-red-50 text-red-700' },
    charge_refunded: { label: 'Refunded', className: 'bg-brand-ink/5 text-brand-ink/65' },
  };
  const config = terminal[status] || { label: formatDisputeLabel(status), className: 'bg-amber-50 text-amber-700' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>{config.label}</span>;
}

function formatDisputeLabel(value) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-brand-ink/5 bg-brand-paper p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[#172033]">{title}</h3>
        <span className="text-xs text-brand-ink/60">{subtitle}</span>
      </div>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </div>
  );
}
