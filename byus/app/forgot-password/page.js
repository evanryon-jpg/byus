'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      setMessage(data.message);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Forgot your password?</h1>
      <p className="mt-2 text-sm text-black/50">
        Enter your email and we'll send you a link to reset it.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-black/70">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-black/10 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#146359]"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#146359] py-3 font-semibold text-white hover:bg-[#0f4d45] disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-black/50">
        Remembered it? <a href="/login" className="text-[#146359] underline">Log in</a>
      </p>
    </div>
  );
}
