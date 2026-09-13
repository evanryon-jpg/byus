'use client';

import { useEffect, useState } from 'react';

function money(cents) {
  return cents == null ? 'Included with membership' : `$${(cents / 100).toFixed(2)}`;
}

export default function DigitalProductManager() {
  const [products, setProducts] = useState([]);
  const [accessType, setAccessType] = useState('purchase');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    const res = await fetch('/api/creator/products');
    if (res.ok) setProducts((await res.json()).products || []);
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const form = new FormData(event.currentTarget);
      form.set('accessType', accessType);
      const res = await fetch('/api/creator/products', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Could not add this PDF.');
        return;
      }
      event.target.reset();
      setAccessType('purchase');
      setMessage('PDF added successfully.');
      await load();
    } catch {
      setMessage('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(product) {
    const res = await fetch(`/api/creator/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !product.active }),
    });
    if (res.ok) await load();
  }

  return (
    <section className="mt-8 rounded-2xl border border-brand-ink/5 bg-brand-paper p-6">
      <h2 className="font-semibold">Sell downloadable PDFs</h2>
      <p className="mt-1 text-sm text-brand-ink/65">
        Upload a guide, ebook, worksheet, pattern, or lesson. Files stay private and only qualified buyers or members can download them.
      </p>

      <form onSubmit={submit} className="mt-5 grid gap-3">
        <input name="title" required maxLength={160} placeholder="PDF title"
          className="rounded-xl border border-brand-ink/15 bg-white px-4 py-3 text-sm" />
        <textarea name="description" maxLength={3000} rows={3} placeholder="What will someone receive?"
          className="rounded-xl border border-brand-ink/15 bg-white px-4 py-3 text-sm" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={accessType} onChange={(e) => setAccessType(e.target.value)}
            className="rounded-xl border border-brand-ink/15 bg-white px-4 py-3 text-sm">
            <option value="purchase">Sell as a one-time purchase</option>
            <option value="subscribers_only">Include with membership</option>
          </select>
          {accessType === 'purchase' && (
            <label className="flex items-center rounded-xl border border-brand-ink/15 bg-white px-4">
              <span className="mr-1 text-sm">$</span>
              <input name="price" type="number" min="1" max="5000" step="0.01" required
                placeholder="10.00" className="w-full py-3 text-sm outline-none" />
            </label>
          )}
        </div>
        <input name="file" type="file" accept="application/pdf,.pdf" required
          className="rounded-xl border border-dashed border-brand-ink/20 bg-white p-4 text-sm" />
        <label className="flex items-start gap-2 text-xs text-brand-ink/65">
          <input type="checkbox" required className="mt-0.5" />
          <span>I own this content or have permission to sell it, and it follows the ByUs content guidelines.</span>
        </label>
        <button disabled={saving}
          className="rounded-full bg-[#146359] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:justify-self-start">
          {saving ? 'Uploading…' : 'Add PDF'}
        </button>
        {message && <p className="text-sm text-brand-ink/70">{message}</p>}
      </form>

      {products.length > 0 && (
        <div className="mt-6 space-y-3">
          {products.map((product) => (
            <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-ink/10 p-4">
              <div>
                <p className="font-medium">{product.title}</p>
                <p className="text-xs text-brand-ink/60">{money(product.price_cents)} · {product.file_name}</p>
              </div>
              <div className="flex gap-2">
                <a href={`/api/products/${product.id}/download`}
                  className="rounded-full border border-[#146359]/30 px-3 py-1.5 text-xs font-semibold text-[#146359]">Preview</a>
                <button onClick={() => toggle(product)}
                  className="rounded-full border border-brand-ink/15 px-3 py-1.5 text-xs font-semibold">
                  {product.active ? 'Hide' : 'Publish'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
