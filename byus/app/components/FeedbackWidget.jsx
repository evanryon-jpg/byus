'use client';

import { useState } from 'react';

// Floating "how's this page?" tab — fixed near the top of the viewport so it's visible
// the instant someone lands, without competing with the hero's own CTA buttons or
// requiring a scroll to find. Anonymous on purpose (see app/api/feedback/route.js): the
// whole point is catching a first-time visitor's gut reaction before they've signed up
// for anything, which the existing account-gated suggestion box (app/api/suggestions,
// Settings page) can never see.
export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — real visitors never see or fill this
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorText, setErrorText] = useState('');

  async function submit() {
    if (!reaction && !message.trim()) {
      setErrorText('Pick a reaction or add a note first.');
      return;
    }
    setStatus('sending');
    setErrorText('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reaction,
          message: message.trim(),
          pagePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send your feedback.');
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorText(err.message || 'Could not send your feedback. Try again.');
    }
  }

  function closeAndReset() {
    setOpen(false);
    // Small delay so the panel doesn't visibly reset mid-close-animation-less collapse.
    setTimeout(() => {
      setReaction(null);
      setMessage('');
      setStatus('idle');
      setErrorText('');
    }, 200);
  }

  return (
    <div className="fixed right-0 top-24 z-40 print:hidden">
      {open ? (
        <div className="mr-3 w-72 rounded-xl border border-brand-ink/10 bg-white p-4 shadow-lg sm:w-80">
          {status === 'sent' ? (
            <div className="py-2 text-center">
              <p className="text-sm font-semibold text-[#172033]">Thanks for the feedback!</p>
              <p className="mt-1 text-xs text-brand-ink/60">It goes straight to the ByUs team.</p>
              <button
                type="button"
                onClick={closeAndReset}
                className="mt-3 text-xs font-semibold text-[#0F766E] hover:underline"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#172033]">How&rsquo;s this page?</p>
                <button
                  type="button"
                  onClick={closeAndReset}
                  aria-label="Close feedback"
                  className="text-brand-ink/40 hover:text-brand-ink/70"
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setReaction(reaction === 'up' ? null : 'up')}
                  aria-pressed={reaction === 'up'}
                  className={`flex-1 rounded-lg border py-2 text-lg ${
                    reaction === 'up'
                      ? 'border-[#0F766E] bg-[#0F766E]/10'
                      : 'border-brand-ink/10 hover:bg-brand-ink/5'
                  }`}
                >
                  👍
                </button>
                <button
                  type="button"
                  onClick={() => setReaction(reaction === 'down' ? null : 'down')}
                  aria-pressed={reaction === 'down'}
                  className={`flex-1 rounded-lg border py-2 text-lg ${
                    reaction === 'down'
                      ? 'border-[#B24A34] bg-[#B24A34]/10'
                      : 'border-brand-ink/10 hover:bg-brand-ink/5'
                  }`}
                >
                  👎
                </button>
              </div>

              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, 500))}
                placeholder="Anything you liked or didn't? (optional)"
                rows={3}
                className="mt-3 w-full resize-none rounded-lg border border-brand-ink/15 px-3 py-2 text-sm"
              />

              {/* Honeypot — hidden from real visitors via CSS, present in the DOM for bots
                  that fill every field they can find. Off the tab order and out of screen readers. */}
              <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                <label htmlFor="feedback-website">Leave this field blank</label>
                <input
                  id="feedback-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              {errorText && <p className="mt-2 text-xs text-red-600">{errorText}</p>}

              <button
                type="button"
                onClick={submit}
                disabled={status === 'sending'}
                className="mt-3 w-full rounded-full bg-[#0F766E] py-2 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
              >
                {status === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
              <p className="mt-2 text-center text-[11px] text-brand-ink/45">No account needed — totally anonymous.</p>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-l-full border border-r-0 border-brand-ink/10 bg-white py-2.5 pl-3.5 pr-3 text-xs font-semibold text-[#172033] shadow-md hover:bg-brand-ink/5"
        >
          💬 Feedback
        </button>
      )}
    </div>
  );
}
