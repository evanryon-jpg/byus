'use client';

import { useEffect, useState } from 'react';

export default function DigitalProductShop({ creatorId }) {
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/creators/${creatorId}/products`)
      .then((res) => res.ok ? res.json() : { products: [] })
      .then((data) => setProducts(data.products || []))
      .catch(() => {});
  }, [creatorId]);

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
      if (data.downloadUrl) {
        window.location.href = data.downloadUrl;
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
      <p className="mt-1 text-sm text-brand-ink/65">PDFs delivered securely through ByUs.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <article key={product.id} className="rounded-2xl border border-brand-ink/10 bg-brand-paper p-5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#146359]">PDF download</span>
            <h3 className="mt-2 font-semibold">{product.title}</h3>
            {product.description && <p className="mt-1 text-sm text-brand-ink/65">{product.description}</p>}
            <p className="mt-3 text-sm font-semibold">
              {product.access_type === 'purchase'
                ? `$${(product.price_cents / 100).toFixed(2)} one time`
                : 'Included with membership'}
            </p>
            {product.downloadable ? (
              <a href={`/api/products/${product.id}/download`}
                className="mt-4 inline-flex rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white">
                Download PDF
              </a>
            ) : product.access_type === 'purchase' ? (
              <button onClick={() => purchase(product.id)} disabled={busy === product.id}
                className="mt-4 rounded-full bg-[#146359] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy === product.id ? 'Opening checkout…' : 'Buy PDF'}
              </button>
            ) : (
              <a href="#tiers" className="mt-4 inline-flex rounded-full border border-[#146359] px-4 py-2 text-sm font-semibold text-[#146359]">
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
