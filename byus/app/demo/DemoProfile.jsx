'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function DemoProfile({ creator }) {
  const [creatorView, setCreatorView] = useState(false);
  const [joinedTier, setJoinedTier] = useState('');

  return (
    <div className="min-h-screen bg-brand-cream pb-16">
      <div className="bg-brand-ink px-6 py-2 text-center text-xs font-medium text-brand-paper/80">
        Interactive demo — {creator.name} is fictional and no real payment is processed.
      </div>
      <div className="mx-auto max-w-4xl px-6 pt-8">
        <div className="flex justify-center gap-1 rounded-full bg-brand-ink/5 p-1 sm:ml-auto sm:w-fit">
          {['Fan view', 'Creator view'].map((label, i) => <button key={label} type="button" onClick={() => setCreatorView(i === 1)} aria-pressed={creatorView === (i === 1)} className={`rounded-full px-4 py-2 text-sm font-semibold ${(creatorView === (i === 1)) ? 'bg-brand-paper text-brand-teal shadow-sm' : 'text-brand-ink/60'}`}>{label}</button>)}
        </div>

        {creatorView && <section className="mt-6 grid gap-3 rounded-2xl border border-brand-teal/15 bg-brand-teal/5 p-5 sm:grid-cols-3"><Stat label="Earned this month" value={`$${creator.monthly.toLocaleString()}`} /><Stat label="Members" value={creator.members.toLocaleString()} /><Stat label="Posts" value={creator.posts} /></section>}

        <section className="mt-6 overflow-hidden rounded-2xl border border-brand-ink/10 bg-brand-paper shadow-sm">
          {/* object-top keeps the crop anchored to the top of the source photo instead of
              the default center -- these are wide, landscape-orientation portraits and this
              h-64/h-80 banner is much shorter and wider than they are, so a center crop was
              cutting heads off for most of the six (everyone except whoever happened to be
              framed with their face already centered vertically in the shot). Anchoring top
              keeps the whole head in frame for all of them and only trims a bit more of the
              background/torso at the bottom instead. */}
          <div className="relative h-64 sm:h-80"><Image src={creator.image} alt={`${creator.name}, fictional ${creator.craft}`} fill priority sizes="(min-width: 896px) 896px, 100vw" className="object-cover object-top" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-wider text-brand-gold">{creator.craft}</p><h1 className="mt-1 font-display text-3xl font-bold">{creator.name}</h1><p className="text-sm text-white/75">{creator.handle}</p></div></div>
          <div className="p-6 sm:p-8"><p className="max-w-2xl leading-relaxed text-brand-ink/75">{creator.bio}</p><p className="mt-3 text-sm text-brand-ink/55">{creator.members.toLocaleString()} members · {creator.posts} posts</p></div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
          <section><h2 className="font-display text-2xl font-bold">Recent posts</h2><div className="mt-4 space-y-3">{creator.samples.map((sample, i) => <article key={sample} className="rounded-xl border border-brand-ink/10 bg-brand-paper p-5"><p className="text-xs font-bold uppercase tracking-wide text-brand-clay">{i === 1 ? 'Members only' : 'Public post'}</p><h3 className="mt-1 font-display text-lg font-semibold">{sample}</h3><p className="mt-2 text-sm text-brand-ink/60">A sample of how this update would appear on a creator’s ByUs page.</p></article>)}</div></section>
          <aside><h2 className="font-display text-xl font-bold">Support {creator.name.split(' ')[0]}</h2><div className="mt-4 space-y-3">{creator.tiers.map(([name, price, detail]) => <div key={name} className={`rounded-xl border bg-brand-paper p-4 ${joinedTier === name ? 'border-brand-teal ring-2 ring-brand-teal/15' : 'border-brand-ink/10'}`}><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{name}</h3><strong>${price}/mo</strong></div><p className="mt-2 text-sm text-brand-ink/65">{detail}</p><button type="button" onClick={() => setJoinedTier(name)} className="mt-4 w-full rounded-full bg-brand-teal px-4 py-2 text-sm font-semibold text-white">{joinedTier === name ? 'Demo membership active ✓' : `Try ${name}`}</button></div>)}</div><p className="mt-3 text-center text-xs text-brand-ink/50">Free to browse · Membership optional</p></aside>
        </div>
        <div className="mt-12 text-center"><a href="/signup?role=creator" className="inline-flex rounded-full bg-brand-clay px-6 py-3 font-semibold text-white">Create your own page →</a></div>
      </div>
    </div>
  );
}

function Stat({ label, value }) { return <div className="rounded-xl bg-brand-paper p-4"><p className="text-xs text-brand-ink/55">{label}</p><p className="mt-1 font-display text-2xl font-bold text-brand-teal">{value}</p></div>; }
