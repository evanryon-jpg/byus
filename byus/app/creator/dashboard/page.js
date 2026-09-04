'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import VerifyEmailBanner from '../../components/VerifyEmailBanner';
import EarningsSection from '../../components/EarningsSection';
import PayoutsSection from '../../components/PayoutsSection';

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

      <PageUrlCard />

      {!(stripeConnected && hasTier && hasPost) && (
        <GettingStartedChecklist stripeConnected={stripeConnected} hasTier={hasTier} hasPost={hasPost} />
      )}

      {/* AI setup assistant */}
      <AiSetupSection stripeConnected={stripeConnected} onProfileSaved={setUser} onTierAdded={load} />

      {/* Tiers — build these first; Stripe is the last step, once the page is worth publishing */}
      <TierSection
        tiers={tiers}
        onCreated={load}
        stripeConnected={stripeConnected}
        platformFeePercent={user?.effective_fee_percent ?? user?.platform_fee_percent ?? 10}
      />

      {/* Posts */}
      <PostSection posts={posts} onCreated={load} />

      {/* Message subscribers directly by email */}
      <BroadcastSection />

      {/* Links */}
      <LinksSection links={links} onSaved={setLinks} />

      {/* Stripe connection status — last step: connect it once there's actually a page worth
          going live with. Tiers and posts above work fine before this is done; they just stay
          drafts/hidden until it is. */}
      <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
        <h2 className="font-semibold">Payments</h2>
        {user?.stripe_connect_onboarded ? (
          <>
            <p className="mt-2 text-sm text-green-700">✓ Stripe connected — you're ready to earn.</p>
            <EarningsSection />
            <PayoutsSection />
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-black/60">
              This is the last step: tap the button, and Stripe walks you through the rest.
              That's where your money gets paid out to — any draft tiers above go live the
              moment this is done.
            </p>
            <p className="mt-2 text-xs text-black/40">
              Stripe Express is a secure, simplified checkout that lets you route money straight
              to your bank account without managing a full business profile.
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

      {/* Live streaming — its own section since it's an optional extra, not part of the
          core setup flow above. Works independently of Stripe; the gating that decides
          who can watch is "any active subscriber," same rule as subscriber-only posts. */}
      <LiveStreamSection />
    </div>
  );
}

// A short, memorable /creator/<slug> URL the creator can claim in place of their raw
// UUID link. Self-fetching, like the referral card on Settings -- loads its own state
// on mount rather than threading it through the parent. Starts in edit mode when no
// slug is claimed yet (there's nothing to show), and in display mode once one is.
function PageUrlCard() {
  const [data, setData] = useState(null);
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch('/api/creator/slug');
    if (res.ok) {
      const result = await res.json();
      setData(result);
      setValue(result.slug || '');
      setEditing(!result.claimed);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/creator/slug', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: value }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Could not save this URL.');
        return;
      }
      setData(result);
      setEditing(false);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!data?.profileUrl) return;
    try {
      await navigator.clipboard.writeText(data.profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select and copy the link manually.');
    }
  }

  if (!data) return null;

  return (
    <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
      <h2 className="font-semibold">Your page URL</h2>
      <p className="mt-1 text-sm text-black/50">
        Claim a short, memorable link fans can actually remember and share.
      </p>

      {!editing ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-black/70">
            {data.profileUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f4d45]"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-[#146359] hover:text-[#0f4d45]"
          >
            Change
          </button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-black/40">byusapp.com/creator/</span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="yourname"
            minLength={3}
            maxLength={30}
            required
            className="w-48 rounded-lg border border-black/10 px-3 py-2 text-sm"
          />
          <button
            disabled={saving}
            className="rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : data.claimed ? 'Save' : 'Claim this URL'}
          </button>
          {data.claimed && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValue(data.slug || '');
                setError('');
              }}
              className="text-sm text-black/50 hover:text-black/70"
            >
              Cancel
            </button>
          )}
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-black/40">
        3–30 characters — lowercase letters, numbers, and hyphens only.
      </p>
    </div>
  );
}

// Self-fetching, same pattern as PageUrlCard above. Sets up (once) a reusable Mux live
// stream and shows the RTMP URL + stream key a creator pastes into OBS/streaming
// software, plus whether they're currently live. Status comes from Mux webhooks
// updating the DB in the background, so this polls lightly while mounted rather than
// requiring a manual refresh every time a creator starts or stops streaming.
function LiveStreamSection() {
  const [data, setData] = useState(null);
  const [settingUp, setSettingUp] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // catches "went live" / "went offline" without a manual refresh
    return () => clearInterval(interval);
  }, []);

  async function load() {
    const res = await fetch('/api/creator/live');
    if (res.ok) setData(await res.json());
  }

  async function handleSetUp() {
    setSettingUp(true);
    setError('');
    try {
      const res = await fetch('/api/creator/live', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Could not set up live streaming.');
        return;
      }
      setData((prev) => ({ ...prev, ...result }));
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSettingUp(false);
    }
  }

  async function handleCopy(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setError('Could not copy — select and copy it manually.');
    }
  }

  if (!data) return null;

  return (
    <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Live streaming</h2>
        {data.isLive && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 motion-safe:animate-pulse" aria-hidden="true" />
            LIVE
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-black/50">
        Go live from your camera or screen using free streaming software — it shows up on your
        page in real time, gated to your active subscribers, the same as a subscriber-only post.
      </p>

      {/* Most creators land here having never used streaming software before, so name the
          tool, say what it is in one line, and hand them a download link before asking them
          to do anything else. */}
      <p className="mt-2 rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-black/50">
        Don't have streaming software yet? We recommend{' '}
        <a
          href="https://obsproject.com/download"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#146359] underline"
        >
          OBS Studio
        </a>{' '}
        — it's free and works on Mac, Windows, and Linux. It lets you point your camera, screen,
        or both at a live broadcast and send it to your page.
      </p>

      {!data.configured ? (
        <button
          type="button"
          onClick={handleSetUp}
          disabled={settingUp}
          className="mt-4 rounded-full bg-[#146359] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50"
        >
          {settingUp ? 'Setting up…' : 'Set up live streaming'}
        </button>
      ) : (
        <div className="mt-4 space-y-4 text-sm">
          {/* The two values below are meaningless out of context to a first-time streamer, so
              lead with the numbered steps that tell them exactly where each one goes, instead
              of assuming they already know what "Server" and "Stream key" refer to. */}
          <ol className="list-decimal space-y-1.5 rounded-xl border border-black/5 bg-black/[0.02] px-4 py-3 pl-8 text-xs text-black/60 marker:text-black/30">
            <li>Open OBS (or your streaming app) and go to Settings → Stream.</li>
            <li>
              Set "Service" to <span className="font-medium text-black/70">Custom</span>.
            </li>
            <li>Copy the Server and Stream Key below into the matching fields.</li>
            <li>Click "Start Streaming" in OBS.</li>
            <li>
              Your page shows <span className="font-medium text-black/70">LIVE</span> within a
              few seconds — no need to refresh, and it switches back automatically when you stop.
            </li>
          </ol>

          <Field
            label="Server"
            value={data.rtmpUrl}
            onCopy={() => handleCopy('url', data.rtmpUrl)}
            copied={copied === 'url'}
          />
          <div>
            <p className="mb-1 font-medium text-black/70">Stream key</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-black/70">
                {showKey ? data.streamKey : '•'.repeat(24)}
              </code>
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="text-xs font-medium text-[#146359] hover:text-[#0f4d45]"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button
                type="button"
                onClick={() => handleCopy('key', data.streamKey)}
                className="rounded-full border border-[#146359] px-3 py-1.5 text-xs font-semibold text-[#146359] hover:bg-[#146359]/5"
              >
                {copied === 'key' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="mt-1 text-xs text-black/40">
              Treat this like a password — anyone with it can stream to your page.
            </p>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Field({ label, value, onCopy, copied }) {
  return (
    <div>
      <p className="mb-1 font-medium text-black/70">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-black/70">
          {value}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-full border border-[#146359] px-3 py-1.5 text-xs font-semibold text-[#146359] hover:bg-[#146359]/5"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

// Self-fetching, same pattern as PageUrlCard/LiveStreamSection. Emails every active
// subscriber a free-text update -- no scheduling, no drafts, just "write something,
// send it" for creators who want to reach people who might not check the page daily.
function BroadcastSection() {
  const [subscriberCount, setSubscriberCount] = useState(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch('/api/creator/broadcast');
    if (res.ok) setSubscriberCount((await res.json()).subscriberCount);
  }

  async function handleSend(e) {
    e.preventDefault();
    setError('');
    setSent(null);
    setSending(true);
    try {
      const res = await fetch('/api/creator/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not send this update.');
        return;
      }
      setSent(data.sent);
      setSubject('');
      setMessage('');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
      <h2 className="font-semibold">Message your subscribers</h2>
      <p className="mt-1 text-sm text-black/50">
        {subscriberCount === null
          ? 'Send a quick update by email — good for anyone who might not check your page every day.'
          : subscriberCount === 0
          ? "You don't have any active subscribers yet — updates will be ready to send once you do."
          : `Sends an email to your ${subscriberCount} active subscriber${subscriberCount === 1 ? '' : 's'}.`}
      </p>

      <form onSubmit={handleSend} className="mt-4 space-y-3">
        <input
          placeholder="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={150}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="What do you want to tell your subscribers?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          maxLength={5000}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {sent !== null && !error && (
          <p className="text-sm text-green-700">Sent to {sent} subscriber{sent === 1 ? '' : 's'}.</p>
        )}
        <button
          disabled={sending || subscriberCount === 0}
          className="rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send update'}
        </button>
      </form>
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
              <p className="mt-1 text-xs text-black/40">
                Added as drafts — they'll go live once you connect Stripe below.
              </p>
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
                    disabled={addingTierIndex === i || addedTiers.includes(i)}
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

// Three steps between "just signed up" and "earning" — build the page first (a tier,
// a post), then connect Stripe last as the "go live" step. Tiers and posts don't need
// Stripe to create; Stripe is just what turns a draft tier into one fans can actually
// subscribe to. Shown until all three are done, then it gets out of the way.
function GettingStartedChecklist({ stripeConnected, hasTier, hasPost }) {
  const steps = [
    { label: 'Create a tier', done: hasTier },
    { label: 'Publish a post', done: hasPost },
    { label: 'Connect Stripe', done: stripeConnected },
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

function TierSection({ tiers, onCreated, stripeConnected, platformFeePercent }) {
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
  const previewKeptCents = Math.round(previewPriceCents * (1 - platformFeePercent / 100));

  return (
    <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Subscription tiers</h2>
        <button onClick={() => setOpen(!open)} className="text-sm font-medium text-[#146359]">
          {open ? 'Cancel' : '+ New tier'}
        </button>
      </div>
      {!stripeConnected && (
        <p className="mt-2 text-sm text-black/40">
          You can build tiers now — they'll save as drafts and go live once you connect Stripe
          below.
        </p>
      )}

      {tiers.length === 0 && !open && (
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
              <div>
                <input placeholder="Price per month (e.g. 10.00)" type="number" step="0.01" min="1" value={price}
                  onChange={(e) => setPrice(e.target.value)} required
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
                {previewPriceCents > 0 && (
                  <p className="mt-1 text-xs text-black/40">
                    You keep ${(previewKeptCents / 100).toFixed(2)}/mo ({100 - platformFeePercent}% — {platformFeePercent}% ByUs fee)
                  </p>
                )}
              </div>
              {!stripeConnected && (
                <p className="text-xs text-black/40">
                  Saves as a draft — hidden from your profile until Stripe is connected.
                </p>
              )}
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
                <p className="mt-1 text-xs text-black/40">
                  You keep ${(previewKeptCents / 100).toFixed(2)}/mo
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
  // A brand-new creator with zero posts lands on an empty section and a "+ New post"
  // button they have to know to click. Opening the composer by default the first time
  // turns that into "here's where you write your first thing" instead of a blank page —
  // it collapses back to the compact list view as soon as there's at least one post.
  const [open, setOpen] = useState(posts.length === 0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [file, setFile] = useState(null);
  const [isPoll, setIsPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function updatePollOption(i, value) {
    setPollOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  function addPollOption() {
    setPollOptions((prev) => (prev.length >= 4 ? prev : [...prev, '']));
  }

  function removePollOption(i) {
    setPollOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }

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
        body: JSON.stringify({
          title,
          body,
          mediaUrl,
          visibility,
          pollOptions: isPoll ? pollOptions : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create this post.');
        setSaving(false);
        return;
      }
      setTitle(''); setBody(''); setVisibility('public'); setFile(null);
      setIsPoll(false); setPollOptions(['', '']); setOpen(false);
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

      {posts.length === 0 && !open && (
        <p className="mt-2 text-sm text-black/40">
          No posts yet — your profile is visible without one, but a first post is what makes it
          feel active instead of empty when someone new shows up.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {posts.map((p) => (
          <PostRow key={p.id} post={p} onChanged={onCreated} />
        ))}
      </ul>

      {open && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 border-t border-black/5 pt-4">
          {posts.length === 0 && (
            <p className="text-sm text-black/50">
              Write a quick welcome note to get started — who you are and what people can expect.
            </p>
          )}
          <input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" />
          <textarea
            placeholder={posts.length === 0 ? "Hey, I'm excited to be here — here's what I'll be sharing…" : "What's on your mind?"}
            value={body} onChange={(e) => setBody(e.target.value)} required rows={4}
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

          <label className="flex items-center gap-2 text-sm text-black/60">
            <input type="checkbox" checked={isPoll} onChange={(e) => setIsPoll(e.target.checked)} />
            Add a poll (fans vote from a few options — your post text above is the question)
          </label>

          {isPoll && (
            <div className="space-y-2 rounded-lg border border-black/10 bg-black/[0.02] p-3">
              {pollOptions.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    placeholder={`Option ${i + 1}`}
                    value={option}
                    onChange={(e) => updatePollOption(i, e.target.value)}
                    maxLength={80}
                    required={isPoll}
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePollOption(i)}
                      className="shrink-0 text-xs font-medium text-black/40 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={addPollOption}
                  className="text-xs font-medium text-[#146359] hover:text-[#0f4d45]"
                >
                  + Add option
                </button>
              )}
            </div>
          )}

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
        <span className="font-medium">
          {post.title || '(untitled)'}
          {post.poll && (
            <span className="ml-2 rounded-full bg-[#146359]/10 px-2 py-0.5 text-xs font-medium text-[#146359]">
              Poll
            </span>
          )}
        </span>
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
      {post.poll && <PollTally poll={post.poll} />}
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

// Read-only results view for a creator looking at their own poll -- no voting controls
// here, they're not a participant, just a percentage bar per option and the total.
function PollTally({ poll }) {
  const total = poll.votes.reduce((sum, v) => sum + v, 0);
  return (
    <div className="mt-2 space-y-1.5">
      {poll.options.map((option, i) => {
        const count = poll.votes[i] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={i} className="text-xs">
            <div className="flex justify-between text-black/60">
              <span>{option}</span>
              <span className="text-black/40">{count} ({pct}%)</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
              <div className="h-full rounded-full bg-[#146359]/60" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-black/30">{total} vote{total === 1 ? '' : 's'}</p>
    </div>
  );
}
