'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

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

  if (loading) return <div className="p-12 text-center text-black/40">Loading…</div>;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-black/50">{user.email}</p>

      <AvatarCard user={user} onChanged={(profile_image_url) => setUser({ ...user, profile_image_url })} />
      <ProfileCard user={user} onChanged={(u) => setUser({ ...user, ...u })} />
      <PasswordCard />
    </div>
  );
}

function AvatarCard({ user, onChanged }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

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

  const initial = (user.display_name || user.email || '?').trim().charAt(0).toUpperCase();

  return (
    <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
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
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-full border border-[#146359] px-4 py-2 text-sm font-medium text-[#146359] hover:bg-[#146359]/5 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload photo'}
          </button>
          <p className="mt-2 text-xs text-black/40">PNG, JPEG, WEBP, or GIF. Max 5MB.</p>
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
    </section>
  );
}

function ProfileCard({ user, onChanged }) {
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [bio, setBio] = useState(user.bio || '');
  const [tagsText, setTagsText] = useState((user.tags || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }
  const isCreator = user.role === 'creator';

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const body = { display_name: displayName, bio };
      if (isCreator) {
        body.tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
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
    <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
      <h2 className="font-semibold">Profile</h2>
      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
          />
        </div>
        {isCreator && (
          <div>
            <label className="text-sm font-medium">Categories</label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="e.g. photography, cooking, fitness"
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-black/40">
              Comma-separated. Shown as filter chips on the Browse page — up to 8.
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
    <section className="mt-6 rounded-2xl border border-black/5 bg-white p-6">
      <h2 className="font-semibold">Password</h2>
      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
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
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
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
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
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
