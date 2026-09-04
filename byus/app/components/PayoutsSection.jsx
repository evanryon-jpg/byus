'use client';

import { useEffect, useState } from 'react';
import { formatUSD } from '@/lib/format';

// Tax & payout reporting card for the creator dashboard: a year-by-year breakdown of
// gross/fee/net (the shape that matters at tax time) plus a CSV download per year or
// for all time. Self-fetching, same pattern as EarningsSection.
//
// ByUs never files anything on a creator's behalf — payouts land directly in the
// creator's own connected Stripe account, so Stripe is the one that issues each
// creator their 1099-K (US creators, once they cross the federal/state reporting
// threshold) straight from that account. This card exists so a creator always has a
// second, always-available paper trail on ByUs's own side without needing to dig
// through Stripe's dashboard.
export default function PayoutsSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/creator/payouts')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return null;
  if (!data) return null;

  const { years } = data;

  return (
    <div className="mt-4 rounded-xl border border-black/5 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Tax & payout reporting</h3>
        {years.length > 0 && (
          <a
            href="/api/creator/payouts/export"
            className="text-xs font-medium text-[#146359] hover:underline"
          >
            Download all-time CSV
          </a>
        )}
      </div>

      <p className="mt-1 text-xs text-black/50">
        Every payment lands directly in your connected Stripe account, so Stripe — not
        ByUs — issues your 1099-K each year once you cross the reporting threshold.
        This is your paper trail on our side: a year-by-year breakdown you can hand to
        a bookkeeper or use to double-check what Stripe reports.
      </p>

      {years.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-black/10 px-4 py-6 text-center">
          <p className="text-sm text-black/50">Your yearly breakdown will show up here once you've been paid.</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 text-xs text-black/40">
                <th className="py-2 pr-3 font-medium">Year</th>
                <th className="py-2 pr-3 font-medium">Payments</th>
                <th className="py-2 pr-3 font-medium tabular-nums">Gross</th>
                <th className="py-2 pr-3 font-medium tabular-nums">Platform fee</th>
                <th className="py-2 pr-3 font-medium tabular-nums">Net paid</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year} className="border-b border-black/5 last:border-0">
                  <td className="py-2 pr-3 font-medium text-[#1A1A1A]">{y.year}</td>
                  <td className="py-2 pr-3 tabular-nums text-black/60">{y.paymentCount.toLocaleString()}</td>
                  <td className="py-2 pr-3 tabular-nums text-black/60">{formatUSD(y.grossCents)}</td>
                  <td className="py-2 pr-3 tabular-nums text-black/60">{formatUSD(y.feeCents)}</td>
                  <td className="py-2 pr-3 tabular-nums font-semibold text-[#1A1A1A]">{formatUSD(y.netCents)}</td>
                  <td className="py-2 text-right">
                    <a
                      href={`/api/creator/payouts/export?year=${y.year}`}
                      className="text-xs font-medium text-[#146359] hover:underline"
                    >
                      CSV
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-black/35">
        Not tax advice — ByUs isn't a tax advisor or accountant. Talk to one about how
        this income should be reported for your situation.
      </p>
    </div>
  );
}
