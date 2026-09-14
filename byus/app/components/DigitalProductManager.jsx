'use client';

import { useEffect, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { ACCEPT_ATTR, classifyFile, kindLabel, MAX_FILES_PER_PRODUCT } from '@/lib/product-files';

function money(cents) {
  return cents == null ? 'Included with membership' : `$${(cents / 100).toFixed(2)}`;
}

function fileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function DigitalProductManager() {
  const [products, setProducts] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accessType, setAccessType] = useState('purchase');
  const [price, setPrice] = useState('');
  const [agreed, setAgreed] = useState(false);
  // Staged files that have already finished uploading straight to Blob storage
  // (see upload-token/route.js for why: the old single-request-body upload silently
  // capped everything at Vercel's 4.5MB function limit). `files` only ever holds
  // { name, size, contentType, url } for files that are *done* uploading; `pending`
  // tracks in-flight ones so the UI can show progress without touching `files` until
  // each one actually succeeds.
  const [files, setFiles] = useState([]);
  const [pending, setPending] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    const res = await fetch('/api/creator/products');
    if (res.ok) setProducts((await res.json()).products || []);
  }

  useEffect(() => { load(); }, []);

  async function handleFilePick(event) {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length) return;
    if (files.length + pending.length + picked.length > MAX_FILES_PER_PRODUCT) {
      setMessage(`A product can include at most ${MAX_FILES_PER_PRODUCT} files.`);
      return;
    }
    setMessage('');

    for (const file of picked) {
      // Fail fast client-side against the same allow-list the server enforces, so a
      // creator finds out a file type/size is unsupported instantly instead of after
      // waiting through an upload the server was always going to reject.
      const check = classifyFile(file.type, file.size);
      if (!check.ok) {
        setMessage(check.error);
        continue;
      }

      const pendingId = `${file.name}-${file.size}-${Date.now()}`;
      setPending((prev) => [...prev, { id: pendingId, name: file.name, progress: 0 }]);
      try {
        const pathname = `products/${crypto.randomUUID()}/${file.name}`;
        const blob = await upload(pathname, file, {
          access: 'private',
          handleUploadUrl: '/api/creator/products/upload-token',
          clientPayload: JSON.stringify({ contentType: file.type }),
          onUploadProgress: ({ percentage }) => {
            setPending((prev) => prev.map((p) => (p.id === pendingId ? { ...p, progress: percentage } : p)));
          },
        });
        setFiles((prev) => [...prev, { name: file.name, size: file.size, contentType: file.type, kind: check.kind, url: blob.url }]);
      } catch (err) {
        setMessage(err.message || `Could not upload ${file.name}.`);
      } finally {
        setPending((prev) => prev.filter((p) => p.id !== pendingId));
      }
    }
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setAccessType('purchase');
    setPrice('');
    setAgreed(false);
    setFiles([]);
  }

  async function publish(event) {
    event.preventDefault();
    setMessage('');
    if (!files.length) {
      setMessage('Add at least one file.');
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch('/api/creator/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, accessType, price, files }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Could not create this product.');
        return;
      }
      resetForm();
      setMessage('Product published.');
      await load();
    } catch {
      setMessage('Network error — please try again.');
    } finally {
      setPublishing(false);
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
      <h2 className="font-semibold">Sell digital products</h2>
      <p className="mt-1 text-sm text-brand-ink/65">
        PDFs, audio, video, image packs, or a zipped bundle of several files at once. Files stay private and only qualified buyers or members can download them.
      </p>

      <form onSubmit={publish} className="mt-5 grid gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} placeholder="Product title"
          className="rounded-xl border border-brand-ink/15 bg-white px-4 py-3 text-sm" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} rows={3} placeholder="What will someone receive?"
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
              <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="5" max="5000" step="0.01" required
                placeholder="10.00" className="w-full py-3 text-sm outline-none" />
            </label>
          )}
        </div>

        <label className="rounded-xl border border-dashed border-brand-ink/20 bg-white p-4 text-sm">
          <span className="mb-2 block font-medium text-brand-ink/80">
            Add files (PDF, audio, video, image, or ZIP — up to {MAX_FILES_PER_PRODUCT})
          </span>
          <input type="file" multiple accept={ACCEPT_ATTR} onChange={handleFilePick}
            className="block w-full text-sm" />
        </label>

        {(files.length > 0 || pending.length > 0) && (
          <ul className="grid gap-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-brand-ink/10 bg-white px-3 py-2 text-xs">
                <span className="truncate">
                  <span className="mr-1.5 rounded bg-brand-teal/10 px-1.5 py-0.5 font-semibold uppercase text-brand-teal">{kindLabel(f.kind)}</span>
                  {f.name} · {fileSize(f.size)}
                </span>
                <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-brand-ink/50 hover:text-brand-clay">Remove</button>
              </li>
            ))}
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-brand-ink/10 bg-brand-cream px-3 py-2 text-xs text-brand-ink/60">
                <span className="truncate">{p.name}</span>
                <span>Uploading… {Math.round(p.progress || 0)}%</span>
              </li>
            ))}
          </ul>
        )}

        <label className="flex items-start gap-2 text-xs text-brand-ink/65">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required className="mt-0.5" />
          <span>I own this content or have permission to sell it, and it follows the ByUs content guidelines.</span>
        </label>
        <button disabled={publishing || pending.length > 0}
          className="rounded-full bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:justify-self-start">
          {publishing ? 'Publishing…' : 'Publish product'}
        </button>
        {message && <p className="text-sm text-brand-ink/70">{message}</p>}
      </form>

      {products.length > 0 && (
        <div className="mt-6 space-y-3">
          {products.map((product) => (
            <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-ink/10 p-4">
              <div>
                <p className="font-medium">{product.title}</p>
                <p className="text-xs text-brand-ink/60">
                  {money(product.price_cents)} · {product.files.length} file{product.files.length === 1 ? '' : 's'}
                </p>
              </div>
              <button onClick={() => toggle(product)}
                className="rounded-full border border-brand-ink/15 px-3 py-1.5 text-xs font-semibold">
                {product.active ? 'Hide' : 'Publish'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
