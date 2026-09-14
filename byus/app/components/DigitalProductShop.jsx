'use client';

import { useEffect, useState } from 'react';
import { kindLabel } from '@/lib/product-files';

function fileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function DigitalProductShop({ creatorId }) {
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  function load() {
    fetch(`/api/creators/${creatorId}/products`)
      .then((res) => res.ok ? res.json() : { products: [] })
      .then((data) => setProducts(data.products || []))
      .catch(() => {});
  }

  useEffect(() => { load(); }, [creatorId]);

  async function purchase(productId) {
    setBusy(productId);
    setError('');
    try {
      const res = await fetch(`/api/products/${productId}/checkout`, { method: 'POST' });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/creator/${creatorId}`)}`;
        return;
      }
      if (data.alreadyOwned) {
        load();
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || 'Could not start checkout.');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(null);
    }
  }

  if (!products.length) return null;

  return (
    <section className="mt-8" id="downloads">
      <h2 className="text-xl font-bold">Downloads</h2>
      <p className="mt-1 text-sm text-brand-ink/65">Delivered securely through ByUs.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <article key={product.id} className="rounded-2xl border border-brand-ink/10 bg-brand-paper p-5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#0F766E]">
              {product.files.length > 1 ? `${product.files.length}-file bundle` : kindLabel(product.files[0]?.kind)}
            </span>
            <h3 className="mt-2 font-semibold">{product.title}</h3>
            {product.description && <p className="mt-1 text-sm text-brand-ink/65">{product.description}</p>}
            <p className="mt-3 text-sm font-semibold">
              {product.access_type === 'purchase'
                ? `$${(product.price_cents / 100).toFixed(2)} one time`
                : 'Included with membership'}
            </p>
            {product.downloadable ? (
              <ul className="mt-4 grid gap-2">
                {product.files.map((file) => (
                  <li key={file.id}>
                    <a href={`/api/products/${product.id}/files/${file.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-[#0F766E]/10 px-3 py-2 text-sm font-medium text-[#0F766E] hover:bg-[#0F766E]/15">
                      <span className="truncate">{file.file_name}</span>
                      <span className="shrink-0 text-xs font-normal text-[#0F766E]/70">{fileSize(file.file_size_bytes)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : product.access_type === 'purchase' ? (
              <button onClick={() => purchase(product.id)} disabled={busy === product.id}
                className="mt-4 rounded-full bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy === product.id ? 'Opening checkout…' : 'Buy now'}
              </button>
            ) : (
              <a href="#tiers" className="mt-4 inline-flex rounded-full border border-[#0F766E] px-4 py-2 text-sm font-semibold text-[#0F766E]">
                Join to download
              </a>
            )}
          </article>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
