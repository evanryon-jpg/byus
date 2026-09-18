'use client';

import { useState } from 'react';

// Per-subscription "get your podcast feed link" control for the fan dashboard (see
// app/fan/dashboard/page.js). Lazily fetches/creates the fan's private feed token
// for this one creator (app/api/fan/feed-token) only when clicked, rather than
// eagerly for every subscription on page load -- most fans will never use this for
// most of their subscriptions, so there's no reason to mint (or even look up) a
// token for each one up front.
export default function FeedLinkButton({ creatorId }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function fetchLink(regenerate) {
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const res = await fetch('/api/fan/feed-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, regenerate }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Could not get your feed link. Try again.');
        return;
      }
      setUrl(result.url);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen(event) {
    // This button sits inside a row that's otherwise a clickable <a> to the
    // creator's page -- stop that navigation from firing along with this click.
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
    if (!url) await fetchLink(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy automatically — select and copy the link manually.');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="mt-2 text-xs font-semibold text-[#0F766E] hover:underline"
      >
        🎙️ Get podcast feed link
      </button>
    );
  }

  return (
    <div
      className="mt-2 rounded-xl border border-brand-ink/10 bg-brand-paper p-3 text-xs"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <p className="text-brand-ink/65">
        Paste this into Apple Podcasts, Overcast, or any RSS app to get new posts automatically.
      </p>
      {loading && <p className="mt-2 text-brand-ink/60">Loading…</p>}
      {error && <p className="mt-2 text-red-700">{error}</p>}
      {url && !loading && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
            className="min-w-0 flex-1 rounded-lg border border-brand-ink/10 bg-white px-2 py-1.5 text-[11px]"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg bg-[#0F766E] px-3 py-1.5 font-semibold text-white hover:bg-[#115E59]"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => fetchLink(true)}
            className="rounded-lg border border-brand-ink/15 px-3 py-1.5 font-semibold text-brand-ink/70 hover:bg-brand-ink/5"
            title="Invalidates the current link and issues a new one — use if this link ever leaked or was shared by mistake."
          >
            Reset link
          </button>
        </div>
      )}
    </div>
  );
}
