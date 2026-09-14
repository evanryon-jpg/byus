'use client';

import { useState } from 'react';

const WELCOME = {
  role: 'assistant',
  content: "Hi! I’m your ByUs Page Coach. I can help build your profile, plan membership tiers, create post ideas, or simply show you around. What would you like help with?",
  quickReplies: ['Help me build my page', 'Review my tiers', 'Show me around'],
  actions: [],
};

export default function PageCoach({ onChanged }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState('');

  async function send(value) {
    const content = String(value ?? text).trim();
    if (!content || sending) return;
    const next = [...messages, { role: 'user', content, actions: [], quickReplies: [] }];
    setMessages(next);
    setText('');
    setSending(true);
    try {
      const res = await fetch('/api/creator/page-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      setMessages((current) => [...current, res.ok
        ? { role: 'assistant', content: data.reply, actions: data.actions || [], quickReplies: data.quickReplies || [] }
        : { role: 'assistant', content: data.error || 'I could not answer right now. Please try again.', actions: [], quickReplies: [] }
      ]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'I lost the connection. Please try again.', actions: [], quickReplies: [] }]);
    } finally {
      setSending(false);
    }
  }

  async function apply(action, index) {
    const key = `${index}-${action.type}`;
    setActionBusy(key);
    try {
      if (action.type === 'navigate') {
        window.location.href = action.payload.href;
        return;
      }
      const endpoint = action.type === 'update_profile' ? '/api/me' : '/api/creator/tiers';
      const method = action.type === 'update_profile' ? 'PATCH' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'That change could not be saved.');
      setMessages((current) => [...current, {
        role: 'assistant',
        content: action.type === 'update_profile'
          ? 'Your profile changes are saved. Would you like help with the next part?'
          : `Your ${action.payload.name} tier is created. Would you like to plan another tier or work on your first post?`,
        actions: [],
        quickReplies: ['Help with the next step', 'Review my page'],
      }]);
      onChanged?.();
    } catch (err) {
      setMessages((current) => [...current, { role: 'assistant', content: err.message, actions: [], quickReplies: [] }]);
    } finally {
      setActionBusy('');
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-[#0F766E] px-5 py-3 text-sm font-semibold text-white shadow-xl hover:bg-[#115E59]">
        Need help? Ask the Page Coach
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-0 sm:p-5" onClick={() => setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="ByUs Page Coach"
            className="flex h-[88vh] w-full flex-col rounded-t-3xl bg-[#FFFDF8] shadow-2xl sm:h-[680px] sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-brand-ink/10 px-5 py-4">
              <div><h2 className="font-bold">ByUs Page Coach</h2><p className="text-xs text-brand-ink/60">Patient, step-by-step help</p></div>
              <button onClick={() => setOpen(false)} aria-label="Close Page Coach" className="rounded-full p-2 text-xl">×</button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <div key={index} className={message.role === 'user' ? 'ml-10' : 'mr-6'}>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === 'user' ? 'bg-[#0F766E] text-white' : 'border border-brand-ink/10 bg-white'
                  }`}>{message.content}</div>
                  {message.actions?.map((action) => (
                    <button key={action.label} onClick={() => apply(action, index)}
                      disabled={Boolean(actionBusy)}
                      className="mt-2 mr-2 rounded-full bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      {actionBusy === `${index}-${action.type}` ? 'Saving…' : action.label}
                    </button>
                  ))}
                  {index === messages.length - 1 && message.quickReplies?.map((reply) => (
                    <button key={reply} onClick={() => send(reply)} disabled={sending}
                      className="mt-2 mr-2 rounded-full border border-[#0F766E]/30 px-3 py-1.5 text-xs font-medium text-[#0F766E]">
                      {reply}
                    </button>
                  ))}
                </div>
              ))}
              {sending && <p className="text-sm text-brand-ink/55">Page Coach is thinking…</p>}
            </div>

            <form onSubmit={(event) => { event.preventDefault(); send(); }} className="border-t border-brand-ink/10 p-4">
              <div className="flex gap-2">
                <input value={text} onChange={(event) => setText(event.target.value)}
                  maxLength={2000} placeholder="Ask for help in your own words…"
                  className="min-w-0 flex-1 rounded-full border border-brand-ink/15 bg-white px-4 py-3 text-sm" />
                <button disabled={sending || !text.trim()}
                  className="rounded-full bg-[#0F766E] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Send</button>
              </div>
              <p className="mt-2 text-center text-[10px] text-brand-ink/50">You approve profile and tier changes before they are saved.</p>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
