'use client';

import { useEffect, useState } from 'react';

export default function CreatorDashboard() {
  const [user, setUser] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [posts, setPosts] = useState([]);
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

    const [tiersRes, postsRes] = await Promise.all([
      fetch('/api/creator/tiers'),
      fetch('/api/creator/posts'),
    ]);
    if (tiersRes.ok) setTiers((await tiersRes.json()).tiers);
    if (postsRes.ok) setPosts((await postsRes.json()).posts);
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

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Creator dashboard</h1>
      <p className="text-black/50">Welcome back, {user?.display_name || user?.email}.</p>

      {/* Stripe connection status */}
      <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
        <h2 className="font-semibold">Payments</h2>
        {user?.stripe_connect_onboarded ? (
          <p className="mt-2 text-sm text-green-700">✓ Stripe connected — you're ready to earn.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-black/60">
              Connect your Stripe account to create paid tiers and start receiving payouts.
            </p>
            <button
              onClick={handleConnectStripe}
              disabled={connecting}
              className="mt-4 rounded-full bg-[#146359] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50"
            >
              {connecting ? 'Redirecting…' : 'Connect Stripe & start earning'}
            </button>
          </>
        )}
      </div>

      {/* Tiers */}
      <TierSection tiers={tiers} onCreated={load} disabled={!user?.stripe_connect_onboarded} />

      {/* Posts */}
      <PostSection posts={posts} onCreated={load} />
    </div>
  );
}

function TierSection({ tiers, onCreated, disabled }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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

      {tiers.length === 0 && !open && (
        <p className="mt-2 text-sm text-black/40">No tiers yet.</p>
      )}

      <ul className="mt-4 space-y-2">
        {tiers.map((t) => (
          <li key={t.id} className="rounded-xl bg-black/5 p-4">
            <div className="flex justify-between">
              <span className="font-medium">{t.name}</span>
              <span className="text-[#146359] font-semibold">${(t.price_cents / 100).toFixed(2)}/mo</span>
            </div>
            {t.description && <p className="mt-1 text-sm text-black/50">{t.description}</p>}
          </li>
        ))}
      </ul>

      {open && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 border-t border-black/5 pt-4">
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
      )}
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
          <li key={p.id} className="rounded-xl bg-black/5 p-4">
            <div className="flex justify-between">
              <span className="font-medium">{p.title || '(untitled)'}</span>
              <span className="text-xs uppercase tracking-wide text-black/40">
                {p.visibility === 'subscribers_only' ? 'Subscribers only' : 'Public'}
              </span>
            </div>
            {p.media_url && (
              <img src={p.media_url} alt="" className="mt-2 max-h-64 rounded-lg object-cover" />
            )}
            <p className="mt-1 text-sm text-black/60">{p.body}</p>
          </li>
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
