'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { CREATOR_CATEGORIES } from '@/lib/categories';
import { PRESET_AVATAR_IDS } from '@/lib/preset-avatars';

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
    } else {
      window.location.href = '/login';
      return;
    }
    setLoading(false);
  }

  if (loading) return <div className="p-12 text-center text-brand-ink/60">Loading…</div>;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-brand-ink/65">{user.email}</p>

      <AvatarCard user={user} onChanged={(profile_image_url) => setUser({ ...user, profile_image_url })} />
      <ProfileCard user={user} onChanged={(u) => setUser({ ...user, ...u })} />
      <NotificationsCard user={user} onChanged={(u) => setUser({ ...user, ...u })} />
      <SupportVisibilityCard user={user} onChanged={(u) => setUser({ ...user, ...u })} />
      <ReferralCard />
      <PasswordCard />
    </div>
  );
}

function AvatarCard({ user, onChanged }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingPreset, setSettingPreset] = useState(null); // the id currently being applied, or null

  async function handlePickPreset(presetId) {
    setSettingPreset(presetId);
    setError('');
    try {
      const res = await fetch('/api/me/avatar/preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not set this avatar.');
      onChanged(result.profile_image_url);
      setPickerOpen(false);
    } catch (err) {
      setError(err.message || 'Could not set this avatar. Try again.');
    } finally {
      setSettingPreset(null);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/me/avatar', { method: 'POST', body: form });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Upload failed.');
      onChanged(result.profile_image_url);
    } catch (err) {
      setError(err.message || 'Could not upload this image. Try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError('');
    try {
      const res = await fetch('/api/me/avatar', { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not remove this photo.');
      onChanged(null);
    } catch (err) {
      setError(err.message || 'Could not remove this photo. Try again.');
    } finally {
      setRemoving(false);
    }
  }

  const initial = (user.display_name || user.email || '?').trim().charAt(0).toUpperCase();
  const busy = uploading || removing;

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Profile photo</h2>
      <div className="mt-4 flex items-center gap-5">
        {user.profile_image_url ? (
          <Image
            src={user.profile_image_url}
            alt="Your profile photo"
            width={80}
            height={80}
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#146359]/10 text-2xl font-semibold text-[#146359]">
            {initial}
          </div>
        )}
        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-full border border-[#146359] px-4 py-2 text-sm font-medium text-[#146359] hover:bg-[#146359]/5 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              disabled={busy}
              className="rounded-full border border-brand-ink/15 px-4 py-2 text-sm font-medium text-brand-ink/70 hover:border-brand-ink/30 hover:text-brand-ink disabled:opacity-50"
            >
              Choose an avatar
            </button>
            {user.profile_image_url && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="text-sm font-medium text-brand-ink/60 hover:text-brand-ink disabled:opacity-50"
              >
                {removing ? 'Removing…' : 'Remove photo'}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-brand-ink/60">
            Upload your own, or pick one of ours. PNG, JPEG, WEBP, or GIF uploads, max 5MB.
          </p>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {pickerOpen && (
        <div className="mt-5 border-t border-brand-ink/10 pt-5">
          <p className="text-xs font-medium text-brand-ink/60">Pick an avatar</p>
          <div className="mt-3 grid grid-cols-5 gap-3 sm:grid-cols-8">
            {PRESET_AVATAR_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handlePickPreset(id)}
                disabled={settingPreset !== null}
                aria-label={`Use this avatar`}
                className="aspect-square overflow-hidden rounded-full ring-2 ring-transparent transition hover:ring-[#146359]/50 disabled:opacity-50"
              >
                {/* Plain <img>, not next/image -- these are small built-in static
                    assets, not remote/user content, so there's nothing next/image's
                    optimizer would meaningfully add here. */}
                <img
                  src={`/images/avatars/${id}.svg`}
                  alt=""
                  className={`h-full w-full object-cover ${settingPreset === id ? 'opacity-50' : ''}`}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ProfileCard({ user, onChanged }) {
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [bio, setBio] = useState(user.bio || '');
  const [tags, setTags] = useState(user.tags || []);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }
  const isCreator = user.role === 'creator';

  // Categories are a fixed pick-list (see lib/categories.js) rather than free text --
  // toggling just adds/removes from the selected set, capped at 8 to match what
  // app/api/me/route.js enforces server-side.
  function toggleTag(tag) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : current.length >= 8
        ? current
        : [...current, tag]
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const body = { display_name: displayName, bio };
      if (isCreator) {
        body.tags = tags;
      }
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not save changes.');
      onChanged(result.user);
      setStatus({ type: 'ok', text: 'Saved.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Could not save changes.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Profile</h2>
      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-brand-ink/10 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-brand-ink/10 px-3 py-2 text-sm"
          />
        </div>
        {isCreator && (
          <div>
            <label className="text-sm font-medium">Categories</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CREATOR_CATEGORIES.map((cat) => {
                const active = tags.includes(cat);
                const atCap = !active && tags.length >= 8;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleTag(cat)}
                    disabled={atCap}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-[#146359] bg-[#146359] text-white'
                        : atCap
                        ? 'cursor-not-allowed border-brand-ink/10 text-brand-ink/30'
                        : 'border-brand-ink/15 text-brand-ink/70 hover:border-[#146359]/40 hover:text-[#146359]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-brand-ink/60">
              Pick up to 8 — shown as filter chips on the Browse page. {tags.length}/8 selected.
            </p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#146359] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          {status && (
            <span className={`text-sm ${status.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
              {status.text}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

// New-post email notifications only ever go to fans (creators don't get emailed about
// their own posts), so this only shows for that role — a creator would have no use for
// a toggle that controls nothing on their account.
function NotificationsCard({ user, onChanged }) {
  const [enabled, setEnabled] = useState(user.notify_new_posts !== false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  if (user.role !== 'fan') return null;

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next); // optimistic — this is a single boolean, not worth a pending state
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify_new_posts: next }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not save this setting.');
      onChanged(result.user);
    } catch (err) {
      setEnabled(!next); // revert on failure
      setStatus({ type: 'error', text: err.message || 'Could not save this setting.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Notifications</h2>
      <label className="mt-4 flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium text-[#2B2420]">New post emails</span>
          <span className="mt-0.5 block text-xs text-brand-ink/65">
            Get an email when a creator you're subscribed to publishes something new.
          </span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={handleToggle}
          className="h-5 w-5 shrink-0 accent-[#146359]"
        />
      </label>
      {status && <p className="mt-2 text-xs text-red-600">{status.text}</p>}
    </section>
  );
}

// Off by default -- this is the only setting that puts a fan's name and photo on a page
// other people browse, so it should never turn on without them actively choosing it. One
// account-level switch rather than a per-creator one: simpler to reason about, and a fan
// who's fine being shown supporting one creator is very likely fine being shown on all of
// them. See show_support_publicly in app/api/me/route.js and the "Top supporters" widget
// on app/creator/[creatorId]/page.js for where this actually shows up.
function SupportVisibilityCard({ user, onChanged }) {
  const [enabled, setEnabled] = useState(user.show_support_publicly === true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  if (user.role !== 'fan') return null;

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next); // optimistic — this is a single boolean, not worth a pending state
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_support_publicly: next }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not save this setting.');
      onChanged(result.user);
    } catch (err) {
      setEnabled(!next); // revert on failure
      setStatus({ type: 'error', text: err.message || 'Could not save this setting.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Support visibility</h2>
      <label className="mt-4 flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium text-[#2B2420]">Show me as a top supporter</span>
          <span className="mt-0.5 block text-xs text-brand-ink/65">
            Your name and photo appear in the "Top supporters" row on the page of any
            creator you're actively subscribed to. Off by default — nobody sees this
            unless you turn it on.
          </span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={handleToggle}
          className="h-5 w-5 shrink-0 accent-[#146359]"
        />
      </label>
      {status && <p className="mt-2 text-xs text-red-600">{status.text}</p>}
    </section>
  );
}

function ReferralCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch('/api/me/referral');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not load your referral link.');
      setData(result);
    } catch (err) {
      setError(err.message || 'Could not load your referral link.');
    }
  }

  async function handleCopy() {
    if (!data?.referralLink) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select and copy the link manually.');
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Refer a friend</h2>
      <p className="mt-1 text-sm text-brand-ink/65">
        Share your link. When someone signs up and subscribes to a creator, you both get a
        free month.
      </p>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {data && (
        <>
          <div className="mt-4 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={data.referralLink}
              onClick={(e) => e.target.select()}
              className="w-full rounded-lg border border-brand-ink/10 bg-brand-ink/[0.02] px-3 py-2 text-sm text-brand-ink/80"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f4d45]"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>

          <div className="mt-4 flex gap-6 text-sm">
            <div>
              <span className="font-semibold text-brand-ink">{data.referredCount}</span>{' '}
              <span className="text-brand-ink/65">{data.referredCount === 1 ? 'friend' : 'friends'} referred</span>
            </div>
            <div>
              <span className="font-semibold text-brand-ink">{data.rewardedCount}</span>{' '}
              <span className="text-brand-ink/65">free {data.rewardedCount === 1 ? 'month' : 'months'} earned</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not change your password.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatus({ type: 'ok', text: 'Password changed.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Could not change your password.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Password</h2>
      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-brand-ink/10 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-lg border border-brand-ink/10 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-lg border border-brand-ink/10 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#146359] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Change password'}
          </button>
          {status && (
            <span className={`text-sm ${status.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
              {status.text}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
