'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

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
          <TierRow key={t.id} tier={t} onChanged={onCreated} />
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
