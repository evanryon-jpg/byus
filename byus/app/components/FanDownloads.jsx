'use client';

import { useEffect, useState } from 'react';

function fileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function FanDownloads() {
  const [downloads, setDownloads] = useState([]);

  useEffect(() => {
    fetch('/api/fan/downloads')
      .then((res) => res.ok ? res.json() : { downloads: [] })
      .then((data) => setDownloads(data.downloads || []))
      .catch(() => {});
  }, []);

  if (!downloads.length) return null;

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Your downloads</h2>
      <p className="mt-1 text-sm text-brand-ink/65">Things you purchased are kept here for easy access.</p>
      <div className="mt-4 space-y-3">
        {downloads.map((item) => (
          <div key={item.id} className="rounded-2xl border border-brand-ink/10 bg-brand-paper p-5">
            <p className="font-medium">{item.title}</p>
            <p className="text-sm text-brand-ink/60">by {item.creator_name}</p>
            <ul className="mt-3 grid gap-2">
              {item.files.map((file) => (
                <li key={file.id}>
                  <a href={`/api/products/${item.id}/files/${file.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[#0F766E]/10 px-3 py-2 text-sm font-medium text-[#0F766E] hover:bg-[#0F766E]/15">
                    <span className="truncate">{file.file_name}</span>
                    <span className="shrink-0 text-xs font-normal text-[#0F766E]/70">{fileSize(file.file_size_bytes)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
