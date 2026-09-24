'use client';

// The fan help assistant: a floating "Need help?" button on /fan/dashboard that opens
// a chat backed by app/api/fan/assistant/route.js. Same shape as PageCoach.jsx for
// creators, minus the actions -- this one is read-only, so there's nothing to apply.
// The only side effect it can have is filing a support request for a human, which the
// server does and the reply announces.

import { useState } from 'react';

const WELCOME = {
  role: 'assistant',
  content: "Hi! I can answer questions about your ByUs subscriptions and billing — what you're paying, when you're charged, how to cancel or update a card — and pass anything else to the ByUs team. What can I help with?",
  quickReplies: ['What am I subscribed to?', "When's my next charge?", 'I need a refund'],
};

export default function FanAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function send(value) {
    const content = String(value ?? text).trim();
    if (!content || sending) return;
    const next = [...messages, { role: 'user', content, quickReplies: [] }];
    setMessages(next);
    setText('');
    setSending(true);
    try {
      const res = await fetch('/api/fan/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      setMessages((current) => [...current, res.ok
        ? { role: 'assistant', content: data.reply, quickReplies: data.quickReplies || [], requestFiled: Boolean(data.requestFiled) }
        : { role: 'assistant', content: data.error || 'I could not answer right now. Please try again.', quickReplies: [] }
      ]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'I lost the connection. Please try again.', quickReplies: [] }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-[#0F766E] px-5 py-3 text-sm font-semibold text-white shadow-xl hover:bg-[#115E59]">
        Need help?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-0 sm:p-5" onClick={() => setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="ByUs help assistant"
            className="flex h-[88vh] w-full flex-col rounded-t-3xl bg-[#FFFDF8] shadow-2xl sm:h-[640px] sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-brand-ink/10 px-5 py-4">
              <div><h2 className="font-bold">ByUs help</h2><p className="text-xs text-brand-ink/60">Subscriptions, billing, and getting a human</p></div>
              <button onClick={() => setOpen(false)} aria-label="Close help" className="rounded-full p-2 text-xl">×</button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <div key={index} className={message.role === 'user' ? 'ml-10' : 'mr-6'}>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === 'user' ? 'bg-[#0F766E] text-white' : 'border border-brand-ink/10 bg-white'
                  }`}>{message.content}</div>
                  {message.requestFiled && (
                    <p className="mt-1 text-xs font-medium text-[#0F766E]">Sent to the ByUs team — you'll hear back by email.</p>
                  )}
                  {index === messages.length - 1 && message.quickReplies?.map((reply) => (
                    <button key={reply} onClick={() => send(reply)} disabled={sending}
                      className="mt-2 mr-2 rounded-full border border-[#0F766E]/30 px-3 py-1.5 text-xs font-medium text-[#0F766E]">
                      {reply}
                    </button>
                  ))}
                </div>
              ))}
              {sending && <p className="text-sm text-brand-ink/55">Thinking…</p>}
            </div>

            <form onSubmit={(event) => { event.preventDefault(); send(); }} className="border-t border-brand-ink/10 p-4">
              <div className="flex gap-2">
                <input value={text} onChange={(event) => setText(event.target.value)}
                  maxLength={1500} placeholder="Ask about your account…"
                  className="min-w-0 flex-1 rounded-full border border-brand-ink/15 bg-white px-4 py-3 text-sm" />
                <button disabled={sending || !text.trim()}
                  className="rounded-full bg-[#0F766E] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Send</button>
              </div>
              <p className="mt-2 text-center text-[10px] text-brand-ink/50">The assistant can't change your account or issue refunds — it passes those to a person.</p>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
