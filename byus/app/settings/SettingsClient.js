'use client';

// All the interactive settings UI. The initial user/referral/suggestions data comes
// in as props from the server-rendered app/settings/page.js — nothing here fetches
// its own starting data anymore, only mutations (save, upload, password change,
// etc.), which are inherently user-triggered and have nothing to do with first
// paint.

import { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { CREATOR_CATEGORIES } from '@/lib/categories';
import { PRESET_AVATAR_IDS } from '@/lib/preset-avatars';

// Wrapped in Suspense because ConnectPlatformsCard reads useSearchParams (the
// discordConnected/discordError flags the OAuth callback redirects back with) — Next
// requires a Suspense boundary around any client component that does, same as this
// app's signup/reset-password pages.
export default function SettingsClient(props) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-6 py-12 text-center text-brand-ink/60">Loading…</div>}>
      <SettingsClientInner {...props} />
    </Suspense>
  );
}

function SettingsClientInner({ initialUser, initialReferral, initialSuggestions }) {
  const [user, setUser] = useState(initialUser);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-brand-ink/65">{user.email}</p>

      <AvatarCard user={user} onChanged={(profile_image_url) => setUser({ ...user, profile_image_url })} />
      {user.role === 'creator' && (
        <CoverCard user={user} onChanged={(cover_image_url) => setUser({ ...user, cover_image_url })} />
      )}
      <ProfileCard user={user} onChanged={(u) => setUser({ ...user, ...u })} />
      <NotificationsCard user={user} onChanged={(u) => setUser({ ...user, ...u })} />
      <TextNotificationsCard user={user} onChanged={(u) => setUser({ ...user, ...u })} />
      <SupportVisibilityCard user={user} onChanged={(u) => setUser({ ...user, ...u })} />
      <ConnectPlatformsCard user={user} />
      <CreatorIntegrationsCard user={user} />
      <RssImportCard user={user} onChanged={(u) => setUser({ ...user, ...u })} />
      <VideoExportCard user={user} />
      <ReferralCard role={user.role} initialData={initialReferral} />
      <SuggestionBoxCard initialSuggestions={initialSuggestions} />
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
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0F766E]/10 text-2xl font-semibold text-[#0F766E]">
            {initial}
          </div>
        )}
        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-full border border-[#0F766E] px-4 py-2 text-sm font-medium text-[#0F766E] hover:bg-[#0F766E]/5 disabled:opacity-50"
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
                className="aspect-square overflow-hidden rounded-full ring-2 ring-transparent transition hover:ring-[#0F766E]/50 disabled:opacity-50"
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

// The banner across the top of a creator's public page (app/api/me/cover/route.js).
// Shown at 3:1 there, so the preview here uses the same shape.
function CoverCard({ user, onChanged }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/me/cover', { method: 'POST', body: form });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Upload failed.');
      onChanged(result.cover_image_url);
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
      const res = await fetch('/api/me/cover', { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not remove this image.');
      onChanged(null);
    } catch (err) {
      setError(err.message || 'Could not remove this image. Try again.');
    } finally {
      setRemoving(false);
    }
  }

  const busy = uploading || removing;

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Cover image</h2>
      <p className="mt-1 text-sm text-brand-ink/65">
        A wide photo across the top of your page, like your workspace, your work, or you in action.
      </p>
      <div className="relative mt-4 aspect-[3/1] w-full overflow-hidden rounded-xl bg-brand-ink/5">
        {user.cover_image_url ? (
          // Plain <img>: a small preview of the creator's own upload, nothing for the optimizer to add.
          <img src={user.cover_image_url} alt="Your cover image" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-brand-ink/50">
            No cover image yet
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-full border border-[#0F766E] px-4 py-2 text-sm font-medium text-[#0F766E] hover:bg-[#0F766E]/5 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : user.cover_image_url ? 'Replace cover' : 'Upload cover'}
        </button>
        {user.cover_image_url && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="text-sm font-medium text-brand-ink/60 hover:text-brand-ink disabled:opacity-50"
          >
            {removing ? 'Removing…' : 'Remove cover'}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-brand-ink/60">
        Best at 1500 × 500 or wider. PNG, JPEG, or WEBP, max 8MB.
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
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
                        ? 'border-[#0F766E] bg-[#0F766E] text-white'
                        : atCap
                        ? 'cursor-not-allowed border-brand-ink/10 text-brand-ink/30'
                        : 'border-brand-ink/15 text-brand-ink/70 hover:border-[#0F766E]/40 hover:text-[#0F766E]'
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
            className="rounded-full bg-[#0F766E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
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
          <span className="block text-sm font-medium text-[#172033]">New post emails</span>
          <span className="mt-0.5 block text-xs text-brand-ink/65">
            Get an email when a creator you're subscribed to publishes something new.
          </span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={handleToggle}
          className="h-5 w-5 shrink-0 accent-[#0F766E]"
        />
      </label>
      {status && <p className="mt-2 text-xs text-red-600">{status.text}</p>}
    </section>
  );
}

// Lets a fan verify a phone number and get a text when a creator they're subscribed to
// publishes -- see database/migrations/20260919_sms_notifications.sql and
// app/api/creator/posts/route.js's notifySubscribersOfNewPostSms. Three states: no
// verified number yet (enter one, get a code), a code outstanding (enter it), and a
// verified number (toggle on/off, or remove it and start over). user.phone_last4/
// phone_verified/notify_new_posts_sms come from the shared USER_SELECT_FIELDS in
// lib/user-profile.js -- the full number itself is never sent to the browser.
function TextNotificationsCard({ user, onChanged }) {
  const [phone, setPhone] = useState('');
  const [codeSentFor, setCodeSentFor] = useState(null); // the phone a code was just sent to, or null
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [togglingSms, setTogglingSms] = useState(false);

  if (user.role !== 'fan') return null;

  async function handleSendCode(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/fan/phone/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not send a code.');
      setCodeSentFor(phone);
      setCode('');
    } catch (err) {
      setError(err.message || 'Could not send a code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/fan/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: codeSentFor, code }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not verify that code.');
      onChanged(result.user);
      setPhone('');
      setCode('');
      setCodeSentFor(null);
    } catch (err) {
      setError(err.message || 'Could not verify that code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleSms(next) {
    setTogglingSms(true);
    setError('');
    try {
      const res = await fetch('/api/fan/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify_new_posts_sms: next }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not save this setting.');
      onChanged(result.user);
    } catch (err) {
      setError(err.message || 'Could not save this setting.');
    } finally {
      setTogglingSms(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/fan/phone', { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not remove that number.');
      onChanged(result.user);
      setPhone('');
      setCode('');
      setCodeSentFor(null);
    } catch (err) {
      setError(err.message || 'Could not remove that number.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Text notifications</h2>

      {user.phone_verified ? (
        <>
          <label className="mt-4 flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-[#172033]">New post texts</span>
              <span className="mt-0.5 block text-xs text-brand-ink/65">
                Get a text at the number ending in {user.phone_last4} when a creator you're subscribed to publishes.
              </span>
            </span>
            <input
              type="checkbox"
              checked={user.notify_new_posts_sms === true}
              disabled={togglingSms}
              onChange={(e) => handleToggleSms(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[#0F766E]"
            />
          </label>
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="mt-3 text-xs font-medium text-red-600/70 hover:text-red-700 disabled:opacity-50"
          >
            Remove this number
          </button>
        </>
      ) : codeSentFor ? (
        <form onSubmit={handleVerify} className="mt-4">
          <p className="text-sm text-brand-ink/65">Enter the code we texted to {codeSentFor}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              className="w-40 rounded-lg border border-brand-ink/10 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="shrink-0 rounded-full bg-[#0F766E] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Verify'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setCodeSentFor(null);
              setCode('');
              setError('');
            }}
            className="mt-2 text-xs font-medium text-brand-ink/45 hover:text-brand-ink/70"
          >
            Use a different number
          </button>
        </form>
      ) : (
        <form onSubmit={handleSendCode} className="mt-4">
          <p className="text-sm text-brand-ink/65">
            Add a phone number to get a text when a creator you're subscribed to publishes.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+14155551234"
              className="w-48 rounded-lg border border-brand-ink/10 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !phone.trim()}
              className="shrink-0 rounded-full bg-[#0F766E] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
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
          <span className="block text-sm font-medium text-[#172033]">Show me as a top supporter</span>
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
          className="h-5 w-5 shrink-0 accent-[#0F766E]"
        />
      </label>
      {status && <p className="mt-2 text-xs text-red-600">{status.text}</p>}
    </section>
  );
}

// Lets a fan link their Discord/Telegram account so ByUs can automatically grant them
// the subscriber role / private-group access on creators they support (and remove it
// if they cancel). Discord connects can't fetch their initial status server-side the
// way most of this page does (there's no useSearchParams equivalent on the server
// component, and the OAuth round-trip only ever happens client-side anyway), so this
// one card does its own client fetch on mount -- the only card on this page that does.
function ConnectPlatformsCard({ user }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(null); // { discord: {...}, telegram: {...} } | null while loading
  const [busy, setBusy] = useState(null); // 'discord' | 'telegram' | null
  const [error, setError] = useState('');

  const discordFlag = searchParams.get('discordConnected') ? 'connected' : searchParams.get('discordError');

  useEffect(() => {
    if (user.role !== 'fan') return;
    let cancelled = false;
    fetch('/api/fan/connections')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setStatus(data || { discord: null, telegram: null });
      })
      .catch(() => {
        if (!cancelled) setStatus({ discord: null, telegram: null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);

  if (user.role !== 'fan') return null;

  if (status === null) {
    return (
      <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
        <h2 className="font-semibold">Connected accounts</h2>
        <p className="mt-2 text-sm text-brand-ink/50">Loading…</p>
      </section>
    );
  }

  async function handleDisconnect(provider) {
    setBusy(provider);
    setError('');
    try {
      const res = await fetch(`/api/fan/connections/${provider}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not disconnect.');
      setStatus({ ...status, [provider]: null });
    } catch (err) {
      setError(err.message || 'Could not disconnect. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function handleConnectTelegram() {
    setBusy('telegram');
    setError('');
    try {
      const res = await fetch('/api/fan/connections/telegram/link', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start Telegram connect.');
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || 'Could not start Telegram connect.');
      setBusy(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Connected accounts</h2>
      <p className="mt-1 text-sm text-brand-ink/65">
        Connect Discord and/or Telegram so creators you subscribe to can automatically add
        you to their private community space — no manual invites to track down.
      </p>

      {discordFlag === 'connected' && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Discord connected.</p>
      )}
      {discordFlag === 'denied' && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Discord connect was canceled.
        </p>
      )}
      {discordFlag === 'taken' && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          That Discord account is already connected to a different ByUs account.
        </p>
      )}
      {(discordFlag === 'expired' || discordFlag === 'failed' || discordFlag === 'unavailable') && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn't connect Discord — please try again.
        </p>
      )}

      <div className="mt-4 grid gap-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-ink/10 p-4">
          <div>
            <p className="font-medium">Discord</p>
            <p className="text-xs text-brand-ink/60">
              {status.discord ? `Connected as ${status.discord.provider_username || 'your account'}` : 'Not connected'}
            </p>
          </div>
          {status.discord ? (
            <button
              type="button"
              onClick={() => handleDisconnect('discord')}
              disabled={busy === 'discord'}
              className="rounded-full border border-brand-ink/15 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busy === 'discord' ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <a
              href="/api/auth/discord/start"
              className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Connect Discord
            </a>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-ink/10 p-4">
          <div>
            <p className="font-medium">Telegram</p>
            <p className="text-xs text-brand-ink/60">
              {status.telegram ? `Connected as ${status.telegram.provider_username || 'your account'}` : 'Not connected'}
            </p>
          </div>
          {status.telegram ? (
            <button
              type="button"
              onClick={() => handleDisconnect('telegram')}
              disabled={busy === 'telegram'}
              className="rounded-full border border-brand-ink/15 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busy === 'telegram' ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnectTelegram}
              disabled={busy === 'telegram'}
              className="rounded-full bg-[#26A5E4] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy === 'telegram' ? 'Opening…' : 'Connect Telegram'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

// Creator-side config for the same Discord/Telegram sync: which server/role and which
// group the bots should manage for this creator's subscribers. Plain fields, not an
// OAuth flow — the creator sets these up once after adding the bots themselves (see
// the ByUs setup guide), then ByUs takes it from there for every fan going forward.
function CreatorIntegrationsCard({ user }) {
  const [guildId, setGuildId] = useState(user.discord_guild_id || '');
  const [roleId, setRoleId] = useState(user.discord_subscriber_role_id || '');
  const [chatId, setChatId] = useState(user.telegram_chat_id || '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  if (user.role !== 'creator') return null;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/creator/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordGuildId: guildId.trim() || null,
          discordSubscriberRoleId: roleId.trim() || null,
          telegramChatId: chatId.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      setStatus({ type: 'ok', text: 'Saved.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Could not save. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Discord &amp; Telegram</h2>
      <p className="mt-1 text-sm text-brand-ink/65">
        Automatically give subscribers a role in your Discord server and access to your
        private Telegram group, and remove it when their paid subscription period ends. Add the ByUs bot to each
        first, then fill in the IDs below.
      </p>

      <form onSubmit={handleSave} className="mt-4 grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium text-[#172033]">Discord server ID</span>
          <input
            type="text"
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
            placeholder="e.g. 1234567890123456789"
            className="rounded-xl border border-brand-ink/15 bg-white px-4 py-2.5 text-sm"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium text-[#172033]">Discord subscriber role ID</span>
          <input
            type="text"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            placeholder="e.g. 1234567890123456789"
            className="rounded-xl border border-brand-ink/15 bg-white px-4 py-2.5 text-sm"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium text-[#172033]">Telegram group chat ID</span>
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="e.g. -1001234567890"
            className="rounded-xl border border-brand-ink/15 bg-white px-4 py-2.5 text-sm"
          />
        </label>
        <button
          disabled={saving}
          className="mt-1 rounded-full bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:justify-self-start"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {status && (
          <p className={`text-sm ${status.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{status.text}</p>
        )}
      </form>
    </section>
  );
}

// Lets a blogger (or any creator) connect their blog's RSS/Atom feed so their posts
// show up on their ByUs page automatically instead of copy-pasting each one in by
// hand. Saving the URL and syncing are two separate actions on purpose — saving just
// records the feed, syncing is the one that actually reads it and creates posts, so a
// creator can see the URL took before kicking off an import. No scheduled sync yet
// (see app/api/creator/rss/route.js) — "Sync now" is the only way new entries import
// today.
function RssImportCard({ user, onChanged }) {
  const [feedUrl, setFeedUrl] = useState(user.rss_feed_url || '');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }

  if (user.role !== 'creator') return null;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/creator/rss', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl: feedUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      onChanged({ rss_feed_url: feedUrl.trim() || null, rss_last_sync_error: null });
      setStatus({ type: 'ok', text: 'Saved.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Could not save. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setStatus(null);
    try {
      const res = await fetch('/api/creator/rss', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not sync.');
      onChanged({ rss_last_synced_at: new Date().toISOString(), rss_last_sync_error: null });
      setStatus({
        type: 'ok',
        text:
          data.imported > 0
            ? `Imported ${data.imported} new post${data.imported === 1 ? '' : 's'}.`
            : `Checked ${data.checked} ${data.checked === 1 ? 'entry' : 'entries'} — nothing new to import.`,
      });
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Could not sync. Try again.' });
    } finally {
      setSyncing(false);
    }
  }

  const lastSyncedLabel = user.rss_last_synced_at
    ? new Date(user.rss_last_synced_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Blog RSS import</h2>
      <p className="mt-1 text-sm text-brand-ink/65">
        Connect your blog's RSS or Atom feed and pull your posts onto your ByUs page — no
        copy-pasting. This isn't a one-time migration: come back and hit "Sync now" any time
        you publish something new, and only the new entries get imported. There's no automatic
        sync yet, so nothing pulls in until you click it.
      </p>

      <form onSubmit={handleSave} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-1">
          <span className="text-sm font-medium text-[#172033]">Feed URL</span>
          <input
            type="url"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder="https://yourblog.com/feed"
            className="rounded-xl border border-brand-ink/15 bg-white px-4 py-2.5 text-sm"
          />
        </label>
        <button
          disabled={saving}
          className="rounded-full border border-[#0F766E] px-5 py-2.5 text-sm font-semibold text-[#0F766E] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing || !user.rss_feed_url}
          className="rounded-full bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        {lastSyncedLabel && <span className="text-xs text-brand-ink/55">Last synced {lastSyncedLabel}</span>}
      </div>

      {user.rss_last_sync_error && !status && (
        <p className="mt-3 text-sm text-red-600">{user.rss_last_sync_error}</p>
      )}
      {status && (
        <p className={`mt-3 text-sm ${status.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{status.text}</p>
      )}
    </section>
  );
}

// Lets a creator pull down a full-quality copy of everything they've posted --
// handy as a personal backup, or before leaving the platform. Every status comes
// straight from a fresh Mux lookup (app/api/creator/video-export) rather than
// being cached here, so refreshing always reflects Mux's real encoding progress,
// not something that could drift stale in this component's state.
function VideoExportCard({ user }) {
  const [videos, setVideos] = useState(null); // null = still loading
  const [loadError, setLoadError] = useState('');
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }

  useEffect(() => {
    if (user.role !== 'creator') return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);

  async function refresh() {
    setLoadError('');
    try {
      const res = await fetch('/api/creator/video-export');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load export status.');
      setVideos(data.videos);
    } catch (err) {
      setLoadError(err.message || 'Could not load export status.');
    }
  }

  async function handleStart() {
    setStarting(true);
    setStatus(null);
    try {
      const res = await fetch('/api/creator/video-export', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start export.');
      setStatus({
        type: 'ok',
        text:
          data.requested > 0
            ? `Preparing ${data.requested} video${data.requested === 1 ? '' : 's'} for download. This can take a few minutes -- use "Refresh status" below to check.`
            : 'Everything is already prepared or in progress.',
      });
      await refresh();
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Could not start export. Try again.' });
    } finally {
      setStarting(false);
    }
  }

  if (user.role !== 'creator') return null;

  const readyCount = videos ? videos.filter((v) => v.status === 'ready').length : 0;

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Export your videos</h2>
      <p className="mt-1 text-sm text-brand-ink/65">
        Get a full-quality download link for every video you've posted -- handy as a backup, or if
        you ever move on from ByUs. Preparing a video for download takes a few minutes; once ready,
        the link stays good for several hours.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={starting || !videos || videos.length === 0}
          className="rounded-full bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {starting ? 'Starting…' : 'Prepare my videos'}
        </button>
        <button
          type="button"
          onClick={refresh}
          className="rounded-full border border-brand-ink/15 px-5 py-2.5 text-sm font-semibold text-brand-ink/70"
        >
          Refresh status
        </button>
        {videos && videos.length > 0 && (
          <span className="text-xs text-brand-ink/55">
            {readyCount} of {videos.length} ready
          </span>
        )}
      </div>

      {status && (
        <p className={`mt-3 text-sm ${status.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>{status.text}</p>
      )}
      {loadError && <p className="mt-3 text-sm text-red-600">{loadError}</p>}

      {videos === null && !loadError && (
        <p className="mt-4 text-sm text-brand-ink/55">Loading your videos…</p>
      )}
      {videos && videos.length === 0 && (
        <p className="mt-4 text-sm text-brand-ink/55">You haven't posted any videos yet.</p>
      )}
      {videos && videos.length > 0 && (
        <ul className="mt-4 max-h-80 divide-y divide-brand-ink/10 overflow-y-auto rounded-xl border border-brand-ink/10">
          {videos.map((v) => (
            <li key={v.postId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="truncate text-[#172033]">{v.title || 'Untitled video'}</span>
              {v.status === 'ready' && (
                <a
                  href={v.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-full bg-[#0F766E]/10 px-3 py-1 text-xs font-semibold text-[#0F766E]"
                >
                  Download
                </a>
              )}
              {v.status === 'preparing' && (
                <span className="shrink-0 rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-semibold text-[#6b5325]">
                  Preparing…
                </span>
              )}
              {v.status === 'not_requested' && (
                <span className="shrink-0 rounded-full bg-brand-ink/5 px-3 py-1 text-xs font-semibold text-brand-ink/50">
                  Not started
                </span>
              )}
              {v.status === 'errored' && (
                <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                  Error
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// initialData comes from the server-rendered page (lib/referrals.js's
// loadReferralSummary, called in app/settings/page.js) — null only if that server
// load itself failed, in which case this shows the same error message the old
// client-side fetch would have shown on failure. There's no client fetch here at
// all anymore, so "Refer a friend" has real content the instant the page paints.
function ReferralCard({ role, initialData }) {
  const [data] = useState(initialData);
  const [error] = useState(initialData ? '' : 'Could not load your referral link.');
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!data?.referralLink) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Refer a friend</h2>
      <p className="mt-1 text-sm text-brand-ink/65">
        Share your link. When someone signs up and subscribes to a creator, you both receive one
        month with no ByUs platform fee. Stripe's 3% payment-processing fee still applies
        and is deducted from each payment.
      </p>

      {role === 'creator' && (
        <p className="mt-2 rounded-lg bg-brand-gold/15 px-3 py-2 text-sm font-semibold text-brand-ink">
          Want a month with no ByUs platform fee? Invite a creator friend — when their page
          gets its first paying supporter, you receive one month at our 0% ByUs
          platform-fee tier. Stripe's 3% payment-processing fee still applies.
        </p>
      )}

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
              className="shrink-0 rounded-full bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115E59]"
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

// Open to anyone with a ByUs account, creator or fan -- a fan browsing the site has just
// as much useful perspective on layout/features as a creator running a page, so this
// isn't gated by role the way ReferralCard's creator-only blurb above is. Submissions go
// to app/api/suggestions/route.js and show up for the ByUs team on the admin overview
// page; `admin_note` (set from there) is this box's way of closing the loop back to
// whoever sent it in, so it's never just a write-only inbox.
const SUGGESTION_MAX = 2000;

const SUGGESTION_STATUS_CONFIG = {
  new: { label: 'New', className: 'bg-brand-ink/5 text-brand-ink/60' },
  reviewed: { label: 'Reviewed', className: 'bg-amber-50 text-amber-700' },
  planned: { label: 'Planned', className: 'bg-blue-50 text-blue-700' },
  shipped: { label: 'Shipped', className: 'bg-green-50 text-green-700' },
};

// initialSuggestions comes from the server-rendered page — no client fetch needed for
// the initial list anymore, only for submitting a new one.
function SuggestionBoxCard({ initialSuggestions }) {
  const [suggestions, setSuggestions] = useState(initialSuggestions || []);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not send your suggestion.');
      setSuggestions((current) => [result.suggestion, ...current]);
      setMessage('');
      setStatus({ type: 'ok', text: "Sent — thank you! We read every one." });
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Could not send your suggestion.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Suggestions</h2>
      <p className="mt-1 text-sm text-brand-ink/65">
        Your ideas are important to ByUs — help us help you! Page layout, a feature you're
        missing, anything at all — tell us what would make ByUs better for you.
      </p>

      <form onSubmit={handleSubmit} className="mt-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={SUGGESTION_MAX}
          rows={3}
          placeholder="What would make ByUs better?"
          required
          className="w-full rounded-lg border border-brand-ink/10 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="rounded-full bg-[#0F766E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send suggestion'}
          </button>
          <span className="text-xs text-brand-ink/50">
            {message.length}/{SUGGESTION_MAX}
          </span>
          {status && (
            <span className={`text-sm ${status.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
              {status.text}
            </span>
          )}
        </div>
      </form>

      {suggestions.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-brand-ink/10 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-ink/50">
            Your suggestions
          </p>
          {suggestions.map((s) => {
            const config = SUGGESTION_STATUS_CONFIG[s.status] || SUGGESTION_STATUS_CONFIG.new;
            return (
              <div key={s.id} className="rounded-lg bg-brand-ink/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-brand-ink/85">{s.message}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
                    {config.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-brand-ink/50">
                  {new Date(s.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                {s.admin_note && (
                  <p className="mt-2 rounded-md bg-brand-gold/15 px-3 py-2 text-sm text-brand-ink">
                    <span className="font-semibold">ByUs team:</span> {s.admin_note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
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
            className="rounded-full bg-[#0F766E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#115E59] disabled:opacity-50"
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
