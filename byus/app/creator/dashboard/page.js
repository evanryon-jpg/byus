'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import VerifyEmailBanner from '../../components/VerifyEmailBanner';

export default function CreatorDashboard() {
  const [user, setUser] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const meRes = await fetch('/api/me');
    if (!meRes.ok) {
      window.location.href = '/login';
      return;
    }
    const { user } = await meRes.json();
    setUser(user);

    const [tiersRes, postsRes, linksRes] = await Promise.all([
      fetch('/api/creator/tiers'),
      fetch('/api/creator/posts'),
      fetch('/api/creator/links'),
    ]);
    if (tiersRes.ok) setTiers((await tiersRes.json()).tiers);
    if (postsRes.ok) setPosts((await postsRes.json()).posts);
    if (linksRes.ok) setLinks((await linksRes.json()).links);
    setLoading(false);
  }

  async function handleConnectStripe() {
    setConnecting(true);
    const res = await fetch('/api/creator/connect-stripe', { method: 'POST' });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url; // redirect to Stripe-hosted onboarding
    } else {
      alert(data.error || 'Could not start Stripe onboarding.');
      setConnecting(false);
    }
  }

  if (loading) return <div className="p-12 text-center text-black/40">Loading…</div>;

  const stripeConnected = Boolean(user?.stripe_connect_onboarded);
  const hasTier = tiers.length > 0;
  const hasPost = posts.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Creator dashboard</h1>
      <p className="text-black/50">Welcome back, {user?.display_name || user?.email}.</p>

      {user && !user.email_verified && <VerifyEmailBanner email={user.email} />}

      {!(stripeConnected && hasTier && hasPost) && (
        <GettingStartedChecklist stripeConnected={stripeConnected} hasTier={hasTier} hasPost={hasPost} />
      )}

      {/* AI setup assistant */}
      <AiSetupSection stripeConnected={stripeConnected} onProfileSaved={setUser} onTierAdded={load} />

      {/* Stripe connection status */}
      <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
        <h2 className="font-semibold">Payments</h2>
        {user?.stripe_connect_onboarded ? (
          <p className="mt-2 text-sm text-green-700">✓ Stripe connected — you're ready to earn.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-black/60">
              This is the only setup step that matters: tap the button, and Stripe walks
              you through the rest. That's where your money gets paid out to.
            </p>
            {user && !user.email_verified ? (
              <p className="mt-4 text-sm text-black/40">Verify your email above before connecting Stripe.</p>
            ) : (
              <button
                onClick={handleConnectStripe}
                disabled={connecting}
                className="mt-4 w-full rounded-2xl bg-[#146359] px-6 py-5 text-lg font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50 sm:w-auto sm:px-10"
              >
                {connecting ? 'Redirecting…' : 'Connect Stripe & start earning →'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Tiers */}
      <TierSection tiers={tiers} onCreated={load} disabled={!user?.stripe_connect_onboarded} />

      {/* Links */}
      <LinksSection links={links} onSaved={setLinks} />

      {/* Posts */}
      <PostSection posts={posts} onCreated={load} />
    </div>
  );
}

// Turns a plain-English description into a starter bio, categories, and three tier
// ideas via /api/creator/ai-setup. Nothing is saved until the creator clicks one of
// the "Use"/"Add" buttons below -- this only ever proposes, never writes on its own.
function AiSetupSection({ stripeConnected, onProfileSaved, onTierAdded }) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const [bioApplied, setBioApplied] = useState(false);
  const [applyingBio, setApplyingBio] = useState(false);
  const [addedTiers, setAddedTiers] = useState([]);
  const [addingTierIndex, setAddingTierIndex] = useState(null);

  async function handleGenerate(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSuggestions(null);
    try {
      const res = await fetch('/api/creator/ai-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not generate suggestions.');
        return;
      }
      setSuggestions(data);
      setBioApplied(false);
      setAddedTiers([]);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function applyBio() {
    setApplyingBio(true);
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: suggestions.bio, tags: suggestions.tags }),
    });
    setApplyingBio(false);
    if (res.ok) {
      const data = await res.json();
      onProfileSaved(data.user);
      setBioApplied(true);
    }
  }

  async function addTier(tier, i) {
    setAddingTierIndex(i);
    const res = await fetch('/api/creator/tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: tier.name,
        description: tier.description,
        priceCents: tier.priceCents,
      }),
    });
    setAddingTierIndex(null);
    if (res.ok) {
      setAddedTiers((prev) => [...prev, i]);
      onTierAdded();
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#146359]/15 bg-[#146359]/5 p-5">
      <h2 className="text-sm font-semibold text-[#146359]">AI setup assistant</h2>
      <p className="mt-1 text-sm text-black/60">
        Describe what you make or post about and get a starter bio, categories, and tier ideas —
        review and use whichever ones fit.
      </p>

      <form onSubmit={handleGenerate} className="mt-3 space-y-2">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. I'm a home baker who shares recipes, technique videos, and behind-the-scenes content."
          rows={3}
          maxLength={500}
          required
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3">
          <button
            disabled={loading}
            className="rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Thinking…' : 'Suggest my setup'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      {suggestions && (
        <div className="mt-5 space-y-5 border-t border-[#146359]/15 pt-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-black/40">Suggested bio</p>
            <p className="mt-1 rounded-xl bg-white p-3 text-sm text-black/70">{suggestions.bio}</p>
            {suggestions.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.tags.map((t) => (
                  <span key={t} className="rounded-full bg-white px-2.5 py-1 text-xs text-black/50">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={applyBio}
              disabled={applyingBio || bioApplied}
              className="mt-2 rounded-full border border-[#146359] px-3 py-1.5 text-xs font-semibold text-[#146359] hover:bg-white disabled:opacity-50"
            >
              {bioApplied ? 'Applied ✓' : applyingBio ? 'Applying…' : 'Use this bio & categories'}
            </button>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-black/40">Suggested tiers</p>
            {!stripeConnected && (
              <p className="mt-1 text-xs text-black/40">Connect Stripe above before adding tiers.</p>
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {suggestions.tiers?.map((tier, i) => (
                <div key={i} className="rounded-xl bg-white p-3">
                  <p className="text-sm font-semibold">{tier.name}</p>
                  <p className="text-xs text-black/50">{tier.description}</p>
                  <p className="mt-1 text-sm font-bold text-[#146359]">
                    ${(tier.priceCents / 100).toFixed(2)}
                    <span className="text-xs font-normal text-black/40">/mo</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => addTier(tier, i)}
                    disabled={!stripeConnected || addingTierIndex === i || addedTiers.includes(i)}
                    className="mt-2 w-full rounded-full border border-[#146359] py-1 text-xs font-semibold text-[#146359] hover:bg-[#146359]/5 disabled:opacity-50"
                  >
                    {addedTiers.includes(i) ? 'Added ✓' : addingTierIndex === i ? 'Adding…' : 'Add this tier'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Three steps between "just signed up" and "earning": connect Stripe so payouts
// have somewhere to go, add a tier so fans have something to subscribe to, then
// publish a post so the profile isn't empty when they arrive. Shown until all
// three are done, then it gets out of the way.
function GettingStartedChecklist({ stripeConnected, hasTier, hasPost }) {
  const steps = [
    { label: 'Connect Stripe', done: stripeConnected },
    { label: 'Create a tier', done: hasTier },
    { label: 'Publish a post', done: hasPost },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="mt-6 rounded-2xl border border-[#146359]/15 bg-[#146359]/5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#146359]">Get set up to earn</h2>
        <span className="text-xs font-medium text-[#146359]/70">{doneCount} of {steps.length} done</span>
      </div>
      <ol className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-4">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-2 text-sm">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done ? 'bg-[#146359] text-white' : 'border border-[#146359]/30 text-[#146359]/60'
              }`}
              aria-hidden="true"
            >
              {step.done ? '✓' : i + 1}
            </span>
            <span className={step.done ? 'text-black/40 line-through' : 'font-medium text-black/80'}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Quick-start templates so a creator can go from a blank page to a live tier in one
// click instead of guessing what to type — most creators land on something close to
// one of these anyway. Clicking one just pre-fills the form; nothing is saved until
// they hit "Create tier", so it's still easy to tweak the name, price, or description.
const TIER_PRESETS = [
  { label: 'Supporter', name: 'Supporter', price: '5.00', description: 'Support my work and get a warm thank-you.' },
  { label: 'Fan club', name: 'Fan club', price: '10.00', description: 'Access to subscriber-only posts and updates.' },
  { label: 'VIP', name: 'VIP', price: '25.00', description: 'Everything in Fan club, plus first access to new work.' },
];

function TierSection({ tiers, onCreated, disabled }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [quickSetupError, setQuickSetupError] = useState('');
  const [quickSetupBusy, setQuickSetupBusy] = useState(false);

  function applyPreset(preset) {
    setName(preset.name);
    setDescription(preset.description);
    setPrice(preset.price);
    setOpen(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const priceCents = Math.round(parseFloat(price) * 100);
    const res = await fetch('/api/creator/tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, priceCents }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setName(''); setDescription(''); setPrice(''); setOpen(false);
    onCreated();
  }

  // Sets up the whole starter ladder (Supporter / Fan club / VIP) in one go, for a
  // creator who'd rather start from a sensible default than build each tier by hand.
  // Everything it creates can still be renamed, re-priced (via deactivate + recreate),
  // or deactivated afterward — this is a starting point, not a commitment.
  async function handleQuickSetup() {
    setQuickSetupError('');
    setQuickSetupBusy(true);
    for (const preset of TIER_PRESETS) {
      const res = await fetch('/api/creator/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: preset.name,
          description: preset.description,
          priceCents: Math.round(parseFloat(preset.price) * 100),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setQuickSetupError(data.error || `Could not create the "${preset.label}" tier. Try again.`);
        break;
      }
    }
    setQuickSetupBusy(false);
    onCreated();
  }

  const previewPriceCents = Math.round((parseFloat(price) || 0) * 100);

  return (
    <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Subscription tiers</h2>
        {!disabled && (
          <button onClick={() => setOpen(!open)} className="text-sm font-medium text-[#146359]">
            {open ? 'Cancel' : '+ New tier'}
          </button>
        )}
      </div>
      {disabled && <p className="mt-2 text-sm text-black/40">Connect Stripe first to create tiers.</p>}

      {tiers.length === 0 && !open && !disabled && (
        <div className="mt-2">
          <p className="text-sm text-black/40">No tiers yet — start from a template, or use one to fill in the form:</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {TIER_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-full bg-[#146359]/10 px-3 py-1.5 text-xs font-medium text-[#146359] hover:bg-[#146359]/20"
              >
                {preset.label} — ${preset.price}/mo
              </button>
            ))}
            <span className="text-xs text-black/30">or</span>
            <button
              type="button"
              onClick={handleQuickSetup}
              disabled={quickSetupBusy}
              className="rounded-full border border-[#146359] px-3 py-1.5 text-xs font-semibold text-[#146359] hover:bg-[#146359]/5 disabled:opacity-50"
            >
              {quickSetupBusy ? 'Setting up…' : 'Add all three'}
            </button>
          </div>
          {quickSetupError && <p className="mt-2 text-sm text-red-600">{quickSetupError}</p>}
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {tiers.map((t) => (
          <TierRow key={t.id} tier={t} onChanged={onCreated} />
        ))}
      </ul>

      {open && (
        <div className="mt-4 border-t border-black/5 pt-4">
          <div className="flex flex-wrap gap-2">
            {TIER_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-full border border-[#146359]/25 px-3 py-1 text-xs font-medium text-[#146359] hover:bg-[#146359]/5"
              >
                Use "{preset.label}"
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <form onSubmit={handleCreate} className="space-y-3">
              <input placeholder="Tier name" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
              <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
              <input placeholder="Price per month (e.g. 10.00)" type="number" step="0.01" min="1" value={price}
                onChange={(e) => setPrice(e.target.value)} required
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button disabled={saving} className="rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Creating…' : 'Create tier'}
              </button>
            </form>

            {/* Live preview — the exact card fans see on the public profile page, so a
                creator can see what they're publishing before they publish it. */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-black/40">
                How fans will see it
              </p>
              <div className="rounded-2xl border border-black/5 bg-[#FAF8F4] p-6">
                <h3 className="font-semibold">{name || 'Tier name'}</h3>
                {description && <p className="mt-1 text-sm text-black/50">{description}</p>}
                <p className="mt-3 text-lg font-bold text-[#146359]">
                  ${(previewPriceCents / 100).toFixed(2)}
                  <span className="text-sm font-normal text-black/40">/mo</span>
                </p>
                <div className="mt-4 w-full rounded-full bg-[#146359] py-2 text-center text-sm font-semibold text-white opacity-90">
                  Subscribe
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TierRow({ tier, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tier.name);
  const [description, setDescription] = useState(tier.description || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch(`/api/creator/tiers/${tier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Could not save changes.');
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function handleToggleActive() {
    const nextActive = !tier.active;
    if (
      !nextActive &&
      !confirm(`Deactivate "${tier.name}"? It disappears from your public profile and can't take new subscribers — current subscribers keep it.`)
    ) {
      return;
    }
    setWorking(true);
    const res = await fetch(`/api/creator/tiers/${tier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: nextActive }),
    });
    setWorking(false);
    if (res.ok) {
      onChanged();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Could not update this tier.');
    }
  }

  if (editing) {
    return (
      <li className="rounded-xl bg-black/5 p-4">
        <form onSubmit={handleSave} className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
          <p className="text-xs text-black/40">
            Price is fixed at ${(tier.price_cents / 100).toFixed(2)}/mo. To charge something different, deactivate this tier and create a new one.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button disabled={saving} className="rounded-full bg-[#146359] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-black/50 hover:text-black/70">
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`rounded-xl bg-black/5 p-4 ${tier.active ? '' : 'opacity-50'}`}>
      <div className="flex justify-between">
        <span className="font-medium">
          {tier.name}
          {!tier.active && (
            <span className="ml-2 text-xs font-normal uppercase tracking-wide text-black/40">Inactive</span>
          )}
        </span>
        <span className="text-[#146359] font-semibold">${(tier.price_cents / 100).toFixed(2)}/mo</span>
      </div>
      {tier.description && <p className="mt-1 text-sm text-black/50">{tier.description}</p>}
      <div className="mt-2 flex gap-4 text-xs font-medium">
        <button onClick={() => setEditing(true)} className="text-[#146359] hover:text-[#0f4d45]">
          Edit
        </button>
        <button onClick={handleToggleActive} disabled={working} className="text-black/50 hover:text-red-600 disabled:opacity-50">
          {working ? 'Working…' : tier.active ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
    </li>
  );
}

// Any link works here -- TikTok, YouTube, Instagram, a personal site, whatever a creator
// wants fans to find. Saved as one array in a single request, so reordering, editing,
// and removing a row are all just "edit this state, then Save" rather than separate
// per-link API calls that could race or partially fail.
const MAX_LINKS = 8;

// The four platforms almost every creator already posts on. A tap fills in a row with
// the domain already typed out and drops the cursor right after it, so all that's left
// to do is type a username and hit save -- no one has to remember or type a URL format.
const QUICK_PLATFORMS = [
  { key: 'tiktok', name: 'TikTok', domain: 'tiktok.com', prefix: 'https://www.tiktok.com/@', badgeClass: 'bg-black text-white' },
  { key: 'youtube', name: 'YouTube', domain: 'youtube.com', prefix: 'https://www.youtube.com/@', badgeClass: 'bg-[#FF0000] text-white' },
  { key: 'instagram', name: 'Instagram', domain: 'instagram.com', prefix: 'https://www.instagram.com/', badgeClass: 'bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white' },
  { key: 'x', name: 'X', domain: 'x.com', prefix: 'https://x.com/', badgeClass: 'bg-black text-white' },
];

function LinksSection({ links: savedLinks, onSaved }) {
  const [rows, setRows] = useState(savedLinks.length ? savedLinks : [{ label: '', url: '' }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [focusIndex, setFocusIndex] = useState(null);
  const inputRefs = useRef([]);

  // Keep the form in sync if links load in after the form has already rendered
  // (e.g. the initial empty-array render before the fetch resolves).
  useEffect(() => {
    setRows(savedLinks.length ? savedLinks : [{ label: '', url: '' }]);
  }, [savedLinks]);

  // After a quick-add tile inserts a row, jump the cursor into it (right after the
  // domain that's already filled in) so the next thing anyone does is type their handle.
  useEffect(() => {
    if (focusIndex === null) return;
    const el = inputRefs.current[focusIndex];
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
    setFocusIndex(null);
  }, [focusIndex, rows]);

  function updateRow(i, field, value) {
    setSaved(false);
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setSaved(false);
    setRows((prev) => (prev.length >= MAX_LINKS ? prev : [...prev, { label: '', url: '' }]));
  }

  function removeRow(i) {
    setSaved(false);
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addQuickPlatform(platform) {
    setSaved(false);
    const existingIndex = rows.findIndex((r) => (r.url || '').toLowerCase().includes(platform.domain));
    if (existingIndex !== -1) {
      setFocusIndex(existingIndex);
      return;
    }
    // Drop the still-empty starter row instead of leaving it dangling above the new one.
    const base = rows.length === 1 && !rows[0].label && !rows[0].url ? [] : rows;
    if (base.length >= MAX_LINKS) return;
    setRows([...base, { label: platform.name, url: platform.prefix }]);
    setFocusIndex(base.length);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/creator/links', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links: rows }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Could not save your links.');
      return;
    }
    onSaved(data.links);
    setSaved(true);
  }

  return (
    <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
      <h2 className="font-semibold">Links</h2>
      <p className="mt-1 text-sm text-black/50">
        Tap where you already post — add your username, then save. Fans will see these on your profile.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {QUICK_PLATFORMS.map((platform) => {
          const added = rows.some((r) => (r.url || '').toLowerCase().includes(platform.domain));
          return (
            <button
              key={platform.key}
              type="button"
              onClick={() => addQuickPlatform(platform)}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-base font-semibold transition ${
                added
                  ? 'border-2 border-[#146359] bg-[#146359]/5 text-[#146359]'
                  : `${platform.badgeClass} hover:opacity-90`
              }`}
            >
              {added ? `✓ ${platform.name}` : platform.name}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSave} className="mt-5 space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <input
              placeholder="Label (optional)"
              value={row.label}
              onChange={(e) => updateRow(i, 'label', e.target.value)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm sm:w-40"
            />
            <input
              ref={(el) => (inputRefs.current[i] = el)}
              placeholder="tiktok.com/@you"
              value={row.url}
              onChange={(e) => updateRow(i, 'url', e.target.value)}
              className="w-full flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="shrink-0 text-sm font-medium text-black/40 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= MAX_LINKS}
            className="text-sm font-medium text-[#146359] disabled:opacity-40"
          >
            + Add another link
          </button>
          <button
            disabled={saving}
            className="rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save links'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && !error && <p className="text-sm text-green-700">Saved.</p>}
      </form>
    </div>
  );
}

function PostSection({ posts, onCreated }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let mediaUrl = null;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        const uploadRes = await fetch('/api/creator/upload', { method: 'POST', body: form });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          setError(uploadData.error || 'Could not upload the image.');
          setSaving(false);
          return;
        }
        mediaUrl = uploadData.pathname;
      }

      const res = await fetch('/api/creator/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, mediaUrl, visibility }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create this post.');
        setSaving(false);
        return;
      }
      setTitle(''); setBody(''); setVisibility('public'); setFile(null); setOpen(false);
      onCreated();
    } catch (err) {
      setError('Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Posts</h2>
        <button onClick={() => setOpen(!open)} className="text-sm font-medium text-[#146359]">
          {open ? 'Cancel' : '+ New post'}
        </button>
      </div>

      {posts.length === 0 && !open && <p className="mt-2 text-sm text-black/40">No posts yet.</p>}

      <ul className="mt-4 space-y-2">
        {posts.map((p) => (
          <PostRow key={p.id} post={p} onChanged={onCreated} />
        ))}
      </ul>

      {open && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 border-t border-black/5 pt-4">
          <input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
          <textarea placeholder="What's on your mind?" value={body} onChange={(e) => setBody(e.target.value)} required rows={4}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
          <div>
            <label className="mb-1 block text-sm text-black/60">Image (optional)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </div>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm">
            <option value="public">Public</option>
            <option value="subscribers_only">Subscribers only</option>
          </select>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={saving} className="rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? (file ? 'Uploading…' : 'Posting…') : 'Post'}
          </button>
        </form>
      )}
    </div>
  );
}

function PostRow({ post, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title || '');
  const [body, setBody] = useState(post.body);
  const [visibility, setVisibility] = useState(post.visibility);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch(`/api/creator/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, visibility }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Could not save changes.');
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(true);
    const res = await fetch(`/api/creator/posts/${post.id}`, { method: 'DELETE' });
    if (res.ok) {
      onChanged();
    } else {
      setDeleting(false);
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Could not delete this post.');
    }
  }

  if (editing) {
    return (
      <li className="rounded-xl bg-black/5 p-4">
        <form onSubmit={handleSave} className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm">
            <option value="public">Public</option>
            <option value="subscribers_only">Subscribers only</option>
          </select>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button disabled={saving} className="rounded-full bg-[#146359] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-black/50 hover:text-black/70">
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-xl bg-black/5 p-4">
      <div className="flex justify-between">
        <span className="font-medium">{post.title || '(untitled)'}</span>
        <span className="text-xs uppercase tracking-wide text-black/40">
          {post.visibility === 'subscribers_only' ? 'Subscribers only' : 'Public'}
        </span>
      </div>
      {post.media_url && (
        // Same reasoning as the public creator feed: this route authorizes per viewer
        // session and serves privately/no-cache, so it stays unoptimized and browser-
        // fetched directly rather than routed through Next's server-side image
        // optimizer (which never sees the viewer's cookies).
        <div className="relative mt-2 aspect-[16/10] w-full max-w-sm overflow-hidden rounded-lg">
          <Image
            src={post.media_url}
            alt={post.title ? `Photo for "${post.title}"` : 'Post photo'}
            fill
            unoptimized
            className="object-cover"
          />
        </div>
      )}
      <p className="mt-1 text-sm text-black/60">{post.body}</p>
      <div className="mt-2 flex gap-4 text-xs font-medium">
        <button onClick={() => setEditing(true)} className="text-[#146359] hover:text-[#0f4d45]">
          Edit
        </button>
        <button onClick={handleDelete} disabled={deleting} className="text-black/50 hover:text-red-600 disabled:opacity-50">
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </li>
  );
}
