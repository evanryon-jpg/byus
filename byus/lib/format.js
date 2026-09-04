// Shared money-formatting helpers for the creator and admin dashboards, so the two
// don't drift into slightly different rounding/compacting rules.

export function formatUSD(cents) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Auto-compact per the dataviz stat-tile contract: 1,284 / 12.9K / $4.2M. Round numbers
// drop the trailing ".0" -- $10K reads better than $10.0K -- while anything that actually
// needs the precision (12.9K) keeps it.
export function formatCompactUSD(cents) {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000) return `$${trimTrailingZero((dollars / 1_000_000).toFixed(1))}M`;
  if (Math.abs(dollars) >= 10_000) return `$${trimTrailingZero((dollars / 1_000).toFixed(1))}K`;
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function trimTrailingZero(str) {
  return str.endsWith('.0') ? str.slice(0, -2) : str;
}
